import { useState } from 'react'
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm'
import { generateJSON, generateImage } from '../lib/ai'

type PosterData = {
  headline: string
  tagline:  string
  cta:      string
  imageData: string   // either SVG string or base64 PNG data URL
  isSvg:    boolean
}

export default function AdPoster() {
  const [loading, setLoading] = useState(false)
  const [poster,  setPoster]  = useState<PosterData | null>(null)
  const [error,   setError]   = useState('')

  async function handleGenerate(brief: string) {
    setLoading(true)
    setError('')
    try {
      const textPrompt = `
        Create ad copy for this brand/product: ${brief}
        Return JSON with exactly these keys:
        { "headline": "...", "tagline": "...", "cta": "..." }
        Headline: 5-7 words, bold claim.
        Tagline: one sentence benefit.
        CTA: 3-4 words action phrase.
      `
      const copy = await generateJSON<{
        headline: string, tagline: string, cta: string
      }>(textPrompt)

      const imagePrompt = `
        Professional advertising poster illustration for: ${brief}.
        Clean modern design, vibrant colors.
        Include relevant food/product imagery using SVG shapes.
        No text in the illustration.
      `
      const raw = await generateImage(imagePrompt)

      // Check if it came back as SVG text or base64 PNG
      const isSvg = raw.trimStart().startsWith('<svg') ||
                    raw.startsWith('data:image/svg+xml')

      setPoster({ ...copy, imageData: raw, isSvg })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!poster) return

    if (poster.isSvg) {
      // For SVG — download as .svg file directly
      const svgString = poster.imageData.startsWith('data:')
        ? atob(poster.imageData.split(',')[1])
        : poster.imageData
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'ad-poster.svg'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // For real PNG base64
      const a    = document.createElement('a')
      a.href     = poster.imageData
      a.download = 'ad-poster.png'
      a.click()
    }
  }

  // Renders SVG string directly into a div (most reliable method)
  function renderImage() {
    if (!poster) return null

    if (poster.isSvg) {
      const svgString = poster.imageData.startsWith('data:image/svg+xml;base64,')
        ? atob(poster.imageData.split(',')[1])
        : poster.imageData

      return (
        <div
          className="w-full aspect-square bg-gray-50 flex
                     items-center justify-center overflow-hidden"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
      )
    }

    // Real image (Imagen 3 base64 PNG)
    return (
      <img
        src={poster.imageData}
        alt="Generated poster"
        className="w-full aspect-square object-cover"
      />
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Ad Poster</h2>
      <p className="text-sm text-gray-500">
        Describe your brand, product, or campaign. The AI will write
        your ad copy and generate a poster image.
      </p>

      <PromptForm
        onGenerate={handleGenerate}
        loading={loading}
        placeholder="e.g. A paneer specialised restaurant..."
      />

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {poster && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Image area */}
          {renderImage()}

          {/* Copy area */}
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
                AI illustration (SVG) — upgrade to Imagen 3 for photos
              </p>
            )}
          </div>

          {/* Download */}
          <div className="px-4 pb-4">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2
                         border border-gray-200 py-2 rounded-xl
                         text-sm text-gray-600 hover:bg-gray-50"
            >
              <Download size={15} />
              Download {poster.isSvg ? 'SVG' : 'poster'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}