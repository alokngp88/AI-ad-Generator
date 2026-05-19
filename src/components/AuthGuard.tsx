import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Login from '../pages/Login';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) =>
      setSession(session)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading)
    return (
      <div
        className="min-h-screen flex items-center justify-center
                    text-sm text-gray-400"
      >
        Loading...
      </div>
    );

  return session ? <>{children}</> : <Login />;
}
