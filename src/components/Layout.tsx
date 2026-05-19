import { NavLink, Outlet } from 'react-router-dom';
import { Image, Video, Layers, History } from 'lucide-react';

const nav = [
  { to: '/poster', label: 'Ad Poster', icon: Image },
  { to: '/reels', label: 'Reels', icon: Video },
  { to: '/stories', label: 'Stories', icon: Layers },
  { to: '/history', label: 'History', icon: History },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-800">
          AI Marketing Studio
        </h1>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t
                      flex justify-around py-2"
      >
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-lg
               text-xs ${
                 isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
               }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
