import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Image, Video, Layers, History,
  LogOut, LineChart, Menu, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const nav = [
  { to: '/poster',  label: 'Ad Poster', icon: Image     },
  { to: '/reels',   label: 'Reels',     icon: Video     },
  { to: '/stories', label: 'Stories',   icon: Layers    },
  { to: '/market',  label: 'Markets',   icon: LineChart },
  { to: '/history', label: 'History',   icon: History   }
]

export default function Layout() {
  const navigate   = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  console.log("In Layout display"); 
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky
                         top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img
            src="/icon.png"
            alt="logo"
            className="h-8 w-auto object-contain"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <span className="text-base font-medium text-gray-800 flex-1">
            AI Marketing Studio
          </span>

          {/* Desktop nav — shown on md and above */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   text-xs font-medium transition-colors
                   ${isActive
                     ? 'bg-blue-50 text-blue-600'
                     : 'text-gray-500 hover:bg-gray-100'}`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Logout — desktop */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-1.5 text-xs
                       text-gray-500 hover:text-red-600 transition-colors
                       px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <LogOut size={14} />
            Logout
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden p-1.5 rounded-lg text-gray-500
                       hover:bg-gray-100 transition-colors"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden mt-2 border-t border-gray-100 pt-2
                          max-w-2xl mx-auto">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl
                   text-sm transition-colors mb-0.5
                   ${isActive
                     ? 'bg-blue-50 text-blue-600 font-medium'
                     : 'text-gray-600 hover:bg-gray-50'}`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5
                         rounded-xl text-sm text-red-600 hover:bg-red-50
                         transition-colors mt-1 border-t border-gray-100 pt-3"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* ── Bottom nav — mobile only, 5 items with smaller text ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white
                      border-t border-gray-100 z-30 safe-area-pb">
        <div className="flex justify-around items-center px-1 py-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1.5
                 rounded-xl flex-1 transition-colors
                 ${isActive
                   ? 'text-blue-600'
                   : 'text-gray-400'}`
              }
            >
              <Icon size={19} />
              <span className="text-[10px] font-medium leading-none">
                {label}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}