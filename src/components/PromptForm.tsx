import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useUsage } from '../context/UsageContext'

type Props = {
  onGenerate:  (text: string) => void
  loading:     boolean
  placeholder: string
}

export default function PromptForm({ onGenerate, loading, placeholder }: Props) {
  const [text, setText]   = useState('')
  const { isExhausted }   = useUsage()
  const disabled          = loading || !text.trim() || isExhausted

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (!disabled) onGenerate(text.trim())
    }} className="space-y-3">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={isExhausted}
        className="w-full p-3 border border-gray-200 rounded-xl text-sm
                   resize-none focus:outline-none focus:ring-2
                   focus:ring-blue-500 disabled:bg-gray-50
                   disabled:text-gray-400"
      />
      <button
        type="submit"
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2
                   bg-blue-600 text-white py-2.5 rounded-xl text-sm
                   font-medium disabled:opacity-40 disabled:cursor-not-allowed
                   hover:bg-blue-700 transition-colors"
      >
        <Sparkles size={16} />
        {loading
          ? 'Generating...'
          : isExhausted
          ? 'Daily limit reached'
          : 'Generate'}
      </button>
    </form>
  )
}