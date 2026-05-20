import { supabase } from '../lib/supabase';
import { Globe } from 'lucide-react';

export default function Login() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error('OAuth error:', error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl border border-gray-200
                      p-8 w-full max-w-sm space-y-6 text-center"
      >
        <h1 className="text-2xl font-semibold text-gray-900">
          AI Marketing Studio
        </h1>
        <p className="text-sm text-gray-500">
          Sign in to start creating marketing assets
        </p>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3
                     border border-gray-200 py-3 rounded-xl
                     text-sm font-medium hover:bg-gray-50 transition"
        >
          <Globe size={18} />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
