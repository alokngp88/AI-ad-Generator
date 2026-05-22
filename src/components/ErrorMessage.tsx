import { AlertCircle, WifiOff, Clock, RefreshCw, LogOut } from 'lucide-react'
import type { AppErrorCode } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

type Props = {
  message:  string
  code?:    AppErrorCode
  onRetry?: () => void
}

const iconMap: Record<AppErrorCode, React.ReactNode> = {
  LIMIT_REACHED:  <Clock size={15} />,
  UNAUTHORIZED:   <LogOut size={15} />,
  NETWORK_ERROR:  <WifiOff size={15} />,
  AI_UNAVAILABLE: <AlertCircle size={15} />,
  SAVE_FAILED:    <AlertCircle size={15} />,
  UNKNOWN:        <AlertCircle size={15} />,
}

const colorMap: Record<AppErrorCode, string> = {
  LIMIT_REACHED:  'bg-amber-50 border-amber-100 text-amber-800',
  UNAUTHORIZED:   'bg-red-50 border-red-100 text-red-700',
  NETWORK_ERROR:  'bg-gray-50 border-gray-200 text-gray-700',
  AI_UNAVAILABLE: 'bg-red-50 border-red-100 text-red-700',
  SAVE_FAILED:    'bg-amber-50 border-amber-100 text-amber-800',
  UNKNOWN:        'bg-red-50 border-red-100 text-red-700',
}

export default function ErrorMessage({ message, code = 'UNKNOWN', onRetry }: Props) {
  const navigate  = useNavigate()
  const colorClass = colorMap[code]
  const icon       = iconMap[code]

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className={`p-3 rounded-xl border text-sm ${colorClass}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <p className="flex-1 leading-relaxed">{message}</p>
      </div>

      {/* Action buttons based on error type */}
      {(code === 'AI_UNAVAILABLE' || code === 'NETWORK_ERROR' || code === 'UNKNOWN')
        && onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium
                     underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          <RefreshCw size={12} /> Try again
        </button>
      )}

      {code === 'UNAUTHORIZED' && (
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium
                     underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          <LogOut size={12} /> Log out and sign in again
        </button>
      )}
    </div>
  )
}