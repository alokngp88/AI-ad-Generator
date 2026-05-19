import { useState } from 'react'
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm'
import { generateJSON } from '../lib/gemini'
import { generateImage } from '../lib/hfImage'

type PosterData = {
  headline: string
  tagline: string
  cta: string
  imageUrl: string
}

export default function AdPoster() {
  const [loading, setLoading] = useState(false)
  const [poster, setPoster] = useState<PosterData | null>(null)
  const [error, setError] = useState('')

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
      const copy = await generateJSON<{headline:string,tagline:string,cta:string}>(textPrompt)

      const imagePrompt = `
        Professional advertising poster for: ${brief}.
        Clean modern design, vibrant colors, commercial photography style.
        No text overlays.
      `
      const imageUrl = await generateImage(imagePrompt)

      setPoster({ ...copy, imageUrl })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!poster) return
    const a = document.createElement('a')
    a.href = poster.imageUrl
    a.download = 'ad-poster.png'
    a.click()
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
        placeholder="e.g. A premium cold brew coffee brand targeting young professionals..."
      />

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {poster && (
        <div className="bg-white rounded-2xl border border-gray-200
                        overflow-hidden space-y-0">
          <img
            src={poster.imageUrl}
            alt="Generated poster"
            className="w-full aspect-square object-cover"
          />
          <div className="p-4 space-y-2">
            <h3 className="text-lg font-bold text-gray-900">
              {poster.headline}
            </h3>
            <p className="text-sm text-gray-600">{poster.tagline}</p>
            <span className="inline-block bg-blue-600 text-white
                             text-xs font-medium px-3 py-1 rounded-full">
              {poster.cta}
            </span>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2
                         border border-gray-200 py-2 rounded-xl
                         text-sm text-gray-600 hover:bg-gray-50"
            >
              <Download size={15} /> Download poster
            </button>
          </div>
        </div>
      )}
    </div>
  )
}