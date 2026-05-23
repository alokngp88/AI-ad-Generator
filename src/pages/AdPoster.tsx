import { useState } from 'react'
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm'
import UsageGuard from '../components/UsageGuard'
import { generateJSON, generateImage } from '../lib/ai_util'
import { saveAsset, logUsage } from '../lib/assets'
import { downloadPosterZip } from '../lib/download'
import { useUsage } from '../context/UsageContext'
import { useResults } from '../context/ResultsContext'
import ErrorMessage from '../components/ErrorMessage'
import { getFriendlyMessage, type AppErrorCode } from '../lib/errors'

// ── Poster image + text download ─────────────────────────────────
async function downloadPosterImage(poster: {
  imageData: string
  isSvg:     boolean
  headline:  string
  tagline:   string
  cta:       string
}) {
  try {
    const lines = [poster.headline, poster.tagline, `→ ${poster.cta}`]

    if (poster.isSvg) {
      const raw = poster.imageData.startsWith('data:image/svg+xml;base64,')
        ? atob(poster.imageData.split(',')[1])
        : poster.imageData

      const textOverlay = lines.map((line, i) =>
        `<text x="200" y="${320 + i * 28}" text-anchor="middle"
          font-family="sans-serif" font-size="16" font-weight="bold"
          fill="white" stroke="black" stroke-width="0.8"
          paint-order="stroke">${line}</text>`
      ).join('')

      const embedded = raw.replace('</svg>', `<g>${textOverlay}</g></svg>`)
      const blob = new Blob([embedded], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'poster-with-text.svg'
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    // PNG — draw on canvas with text overlay
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve()
      img.onerror = () => reject(new Error('Image load failed'))
      img.src     = poster.imageData
    })

    const canvas  = document.createElement('canvas')
    canvas.width  = img.width  || 1024
    canvas.height = img.height || 1024
    const ctx     = canvas.getContext('2d')!

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Gradient banner at bottom
    const grad = ctx.createLinearGradient(
      0, canvas.height - 220, 0, canvas.height
    )
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.78)')
    ctx.fillStyle = grad
    ctx.fillRect(0, canvas.height - 220, canvas.width, 220)

    ctx.textAlign   = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'

    // Headline
    ctx.font      = `bold ${Math.round(canvas.width * 0.052)}px sans-serif`
    ctx.fillStyle = 'white'
    ctx.shadowBlur = 6
    ctx.fillText(
      poster.headline,
      canvas.width / 2,
      canvas.height - 140,
      canvas.width - 60
    )

    // Tagline
    ctx.font      = `${Math.round(canvas.width * 0.033)}px sans-serif`
    ctx.shadowBlur = 4
    ctx.fillText(
      poster.tagline,
      canvas.width / 2,
      canvas.height - 90,
      canvas.width - 60
    )

    // CTA pill
    const ctaW  = 280
    const ctaH  = 50
    const ctaX  = (canvas.width - ctaW) / 2
    const ctaY  = canvas.height - 30

    ctx.shadowBlur  = 0
    ctx.fillStyle   = '#2563eb'
    ctx.beginPath()
    ctx.roundRect(ctaX, ctaY - ctaH + 8, ctaW, ctaH, 25)
    ctx.fill()

    ctx.fillStyle = 'white'
    ctx.font      = `bold ${Math.round(canvas.width * 0.03)}px sans-serif`
    ctx.fillText(poster.cta, canvas.width / 2, ctaY - 10)

    const a    = document.createElement('a')
    a.href     = canvas.toDataURL('image/png')
    a.download = 'poster-with-text.png'
    a.click()

  } catch (e) {
    console.error('Poster image download error:', e)
  }
}

export default function AdPoster() {
  const [loading,      setLoading]      = useState(false)
  const [imgDlLoading, setImgDlLoading] = useState(false)
  const [dlLoading,    setDlLoading]    = useState(false)
  const [error,        setError]        = useState('')
  const [errorCode,    setErrorCode]    = useState<AppErrorCode>('UNKNOWN')
  const { poster, setPoster }           = useResults()
  const { decrement, refetch }          = useUsage()

  function handleError(e: unknown) {
    const { message, code } = getFriendlyMessage(e)
    setError(message)
    setErrorCode(code)
  }

  function clearError() { setError('') }

  async function handleGenerate(brief: string) {
    setLoading(true)
    clearError()
    try {
      // 1. Gate — log usage first
      const { usageId } = await logUsage('poster')
      decrement()

      // 2. Generate text copy
      const copy = await generateJSON(brief) as {
        headline: string
        tagline:  string
        cta:      string
      }

      // 3. Generate image
      const imageData = await generateImage(
        `Professional advertising poster for: ${brief}. ` +
        `Clean modern design, vibrant colors, no text.`
      )
      const isSvg = imageData.trimStart().startsWith('<svg') ||
                    imageData.startsWith('data:image/svg')

      const result = { ...copy, imageData, isSvg }
      setPoster(result)

      // 4. Save asset
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

  async function handleDownloadZip() {
    if (!poster) return
    setDlLoading(true)
    try { await downloadPosterZip(poster) }
    catch (e) { handleError(e) }
    finally { setDlLoading(false) }
  }

  async function handleDownloadImage() {
    if (!poster) return
    setImgDlLoading(true)
    await downloadPosterImage(poster)
    setImgDlLoading(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Ad Poster</h2>
      <p className="text-sm text-gray-500">
        Describe your brand or campaign to generate ad copy and a poster image.
      </p>

      <UsageGuard>
        <PromptForm
          onGenerate={handleGenerate}
          loading={loading}
          placeholder="e.g. A burger specialised restaurant..."
        />
      </UsageGuard>

      {error && (
        <ErrorMessage
          message={error}
          code={errorCode}
          onRetry={clearError}
        />
      )}

      {poster && (
        <div className="bg-white rounded-2xl border border-gray-200">

          {/* ── Image area — relative wrapper so button can be absolute ── */}
          <div className="relative w-full aspect-square rounded-t-2xl
                          overflow-hidden bg-gray-50">

            {/* Poster image */}
            {poster.isSvg
              ? <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{
                    __html: poster.imageData.startsWith('data:image/svg+xml;base64,')
                      ? atob(poster.imageData.split(',')[1])
                      : poster.imageData
                  }}
                />
              : <img
                  src={poster.imageData}
                  alt="Generated poster"
                  className="w-full h-full object-cover"
                />
            }

            {/* ── Download button — top-right corner of image ── */}
            <button
              onClick={handleDownloadImage}
              disabled={imgDlLoading}
              title="Download poster with text"
              className="absolute top-2 right-2 z-10
                         w-9 h-9 rounded-full
                         bg-black/50 hover:bg-black/75
                         flex items-center justify-center
                         transition-all disabled:opacity-50
                         active:scale-90"
            >
              {imgDlLoading
                ? <span className="w-4 h-4 border-2 border-white
                                   border-t-transparent rounded-full
                                   animate-spin block" />
                : <Download size={16} className="text-white" />
              }
            </button>
          </div>

          {/* ── Copy section ── */}
          <div className="p-4 space-y-2">
            <h3 className="text-lg font-bold text-gray-900">
              {poster.headline}
            </h3>
            <p className="text-sm text-gray-600">{poster.tagline}</p>
            <span className="inline-block bg-blue-600 text-white
                             text-xs font-medium px-3 py-1 rounded-full">
              {poster.cta}
            </span>
            {poster.isSvg && (
              <p className="text-xs text-gray-400 pt-1">
                AI illustration (SVG)
              </p>
            )}
          </div>

          {/* ── Download all zip ── */}
          <div className="px-4 pb-4">
            <button
              onClick={handleDownloadZip}
              disabled={dlLoading}
              className="w-full flex items-center justify-center gap-2
                         border border-gray-200 py-2 rounded-xl text-sm
                         text-gray-600 hover:bg-gray-50 disabled:opacity-50
                         transition-colors"
            >
              <Download size={15} />
              {dlLoading ? 'Preparing zip...' : 'Download all assets (.zip)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}