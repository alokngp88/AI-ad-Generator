import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Image, Video, Layers, History, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

const nav = [
  { to: '/poster',  label: 'Ad Poster', icon: Image   },
  { to: '/reels',   label: 'Reels',     icon: Video   },
  { to: '/stories', label: 'Stories',   icon: Layers  },
  { to: '/history', label: 'History',   icon: History },
]

export default function Layout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Company logo"
            className="h-8 w-auto object-contain"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <span className="text-base font-medium text-gray-800 flex-1">
            AI Marketing Studio
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500
                       hover:text-red-600 transition-colors px-2 py-1
                       rounded-lg hover:bg-red-50"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 max-w-lg mx-auto w-full">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t
                      border-gray-100 flex justify-around py-2 z-10">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg
               text-xs ${isActive
                 ? 'text-blue-600 font-medium'
                 : 'text-gray-400'}`
            }>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}