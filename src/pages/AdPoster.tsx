import { useState } from 'react'
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm'
import UsageGuard from '../components/UsageGuard'
import { generateJSON, generateImage } from '../lib/ai_util'
import { saveAsset, logUsage } from '../lib/assets'
import { downloadPosterZip } from '../lib/download'
import { useUsage} from '../context/UsageContext'
import { useResults } from '../context/ResultsContext'
import ErrorMessage from '../components/ErrorMessage'
import { getFriendlyMessage, type AppErrorCode } from '../lib/errors'

export default function AdPoster() {
  const [loading, setLoading] = useState(false)
  const { poster, setPoster } = useResults()
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<AppErrorCode>('UNKNOWN')
  const [dlLoading, setDlLoading] = useState(false)
  const { decrement, refetch } = useUsage()

  function handleError(e: unknown) {
    const { message, code } = getFriendlyMessage(e)
    setError(message)
    setErrorCode(code)
    setLoading(false)
  }
  
  function clearError() {
    setError('')
  }
  async function handleGenerate(brief: string) {
    setLoading(true)
    clearError()
    try {
      // ── 1. Check + log usage FIRST (gate before AI call) ────────
      const { usageId } = await logUsage('poster')
      decrement()
      const copy = await generateJSON(brief) as {
        headline: string, tagline: string, cta: string
      }
      const imageData = await generateImage(
        `Professional advertising poster for: ${brief}. Clean modern design, vibrant colors.`
      )
      const isSvg = imageData.trimStart().startsWith('<svg') ||
        imageData.startsWith('data:image/svg')

      const result = { ...copy, imageData, isSvg }
      setPoster(result)
      // ── 3. Save asset linked to usage row ────────────────────────
      await saveAsset(
        'poster',
        brief,
        result as Record<string, unknown>,
        usageId
      )
      await refetch()
    } catch (e: unknown) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!poster) return
    setDlLoading(true)
    try { await downloadPosterZip(poster) }
    finally { setDlLoading(false) }
  }

  function renderImage() {
    if (!poster) return null
    if (poster.isSvg) {
      const svg = poster.imageData.startsWith('data:image/svg+xml;base64,')
        ? atob(poster.imageData.split(',')[1]) : poster.imageData
      return (
        <div className="w-full aspect-square bg-gray-50 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: svg }} />
      )
    }
    return <img src={poster.imageData} alt="Generated poster"
      className="w-full aspect-square object-cover" />
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Ad Poster</h2>
      <p className="text-sm text-gray-500">
        Describe your brand or campaign to generate ad copy and a poster image.
      </p>

      <UsageGuard>
        <PromptForm onGenerate={handleGenerate} loading={loading}
          placeholder="e.g. A paneer specialised restaurant..." />
      </UsageGuard>

      {error && (
        <ErrorMessage
        message={error}
        code={errorCode}
        onRetry={() => {
          clearError()
          // optionally re-trigger last prompt
        }}
      />
      )}

      {poster && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {renderImage()}
          <div className="p-4 space-y-2">
            <h3 className="text-lg font-bold text-gray-900">{poster.headline}</h3>
            <p className="text-sm text-gray-600">{poster.tagline}</p>
            <span className="inline-block bg-blue-600 text-white
                             text-xs font-medium px-3 py-1 rounded-full">
              {poster.cta}
            </span>
          </div>
          <div className="px-4 pb-4">
            <button onClick={handleDownload} disabled={dlLoading}
              className="w-full flex items-center justify-center gap-2
                         border border-gray-200 py-2 rounded-xl text-sm
                         text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <Download size={15} />
              {dlLoading ? 'Preparing zip...' : 'Download all assets (.zip)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}