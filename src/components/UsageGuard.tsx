import { useUsage } from '../context/UsageContext'

type Props = { children: React.ReactNode }

export default function UsageGuard({ children }: Props) {
  const { remaining, isExhausted, loading } = useUsage()
  // limit intentionally not destructured — not needed in UI

  const showWarning = !loading && remaining <= 3
  //console.log(`showWarning: ${showWarning} remaining: ${remaining}`)

  return (
    <div className="space-y-3">
      {showWarning && !isExhausted && (
        <div className="text-xs px-3 py-1.5 rounded-lg inline-flex
                        items-center gap-1.5 bg-amber-50 text-amber-700">
          <span className="font-medium">{remaining}</span>
          <span>more request{remaining === 1 ? '' : 's'} left for the day</span>
        </div>
      )}

      {children}

      {isExhausted && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl
                        text-sm text-red-700 text-center leading-relaxed">
          You have reached the maximum limits of your request!!
          Please wait for next day to again make a request.
        </div>
      )}
    </div>
  )
}