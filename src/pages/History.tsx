import { useEffect, useState } from 'react'
import { Download, Image, Video, Layers, Clock } from 'lucide-react'
import { fetchRecentAssets } from '../lib/assets'
import {
  downloadPosterZip,
  downloadReelsZip,
  downloadStoriesZip
} from '../lib/download'

type Asset = {
  id:          string
  type:        string
  prompt:      string
  result_json: Record<string, unknown> | null
  created_at:  string
  plan_type:   'Free' | 'Paid'
}

const typeIcon  = { poster: Image, reels: Video, stories: Layers }
const typeLabel = { poster: 'Ad Poster', reels: 'Reels', stories: 'Stories' }
const typeColor = {
  poster:  'bg-blue-50 text-blue-700',
  reels:   'bg-purple-50 text-purple-700',
  stories: 'bg-amber-50 text-amber-700',
}

export default function History() {
  const [assets,  setAssets]  = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [dlId,    setDlId]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentAssets(3)
      .then(data => setAssets(data as Asset[]))
      .catch(e   => setError(e.message))
      .finally(()=> setLoading(false))
  }, [])

  async function handleDownload(asset: Asset) {
    if (!asset.result_json) return
    setDlId(asset.id)
    try {
      if (asset.type === 'poster') {
        await downloadPosterZip(
          asset.result_json as Parameters<typeof downloadPosterZip>[0]
        )
      } else if (asset.type === 'reels') {
        await downloadReelsZip(
          (asset.result_json.scenes ?? []) as Parameters<typeof downloadReelsZip>[0]
        )
      } else if (asset.type === 'stories') {
        await downloadStoriesZip(
          (asset.result_json.slides ?? []) as Parameters<typeof downloadStoriesZip>[0]
        )
      }
    } catch (e) {
      console.error('Download error:', e)
    } finally {
      setDlId(null)
    }
  }

  function thumbnail(asset: Asset): string | null {
    const r = asset.result_json
    if (!r) return null
    if (asset.type === 'poster')  return (r.imageData as string) ?? null
    if (asset.type === 'reels') {
      const scenes = (r.scenes as Array<{ imageUrl: string }>) ?? []
      return scenes[0]?.imageUrl ?? null
    }
    if (asset.type === 'stories') {
      const slides = (r.slides as Array<{ imageUrl: string }>) ?? []
      return slides[0]?.imageUrl ?? null
    }
    return null
  }

  function resultPreview(asset: Asset): string {
    const r = asset.result_json
    if (!r) return ''
    if (asset.type === 'poster')
      return (r.headline as string) ?? ''
    if (asset.type === 'reels')
      return ((r.scenes as Array<{ voiceover: string }>)?.[0]?.voiceover) ?? ''
    if (asset.type === 'stories')
      return ((r.slides as Array<{ headline: string }>)?.[0]?.headline) ?? ''
    return ''
  }

  function renderFullResult(asset: Asset) {
    const r = asset.result_json
    if (!r) return null

    if (asset.type === 'poster') {
      const imageData = r.imageData as string | undefined
      const isSvg     = imageData?.trimStart().startsWith('<svg') ||
                        imageData?.startsWith('data:image/svg')
      return (
        <div className="space-y-3 pt-2">
          {imageData && (
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-50">
              {isSvg
                ? <div className="w-full h-full"
                    dangerouslySetInnerHTML={{
                      __html: imageData.startsWith('data:')
                        ? atob(imageData.split(',')[1]) : imageData
                    }} />
                : <img src={imageData} alt=""
                       className="w-full h-full object-cover" />
              }
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-bold text-gray-900">
              {r.headline as string}
            </p>
            <p className="text-xs text-gray-600">{r.tagline as string}</p>
            <span className="inline-block bg-blue-600 text-white
                             text-xs px-2 py-0.5 rounded-full">
              {r.cta as string}
            </span>
          </div>
        </div>
      )
    }

    if (asset.type === 'reels') {
      const scenes = (r.scenes as Array<{
        scene: number, duration: string, voiceover: string,
        caption: string, imageUrl?: string
      }>) ?? []
      return (
        <div className="space-y-2 pt-2">
          {scenes.map(s => {
            const isSvg = s.imageUrl?.trimStart().startsWith('<svg') ||
                          s.imageUrl?.startsWith('data:image/svg')
            return (
              <div key={s.scene}
                className="flex gap-2 bg-gray-50 rounded-lg overflow-hidden">
                <div className="w-16 h-16 flex-shrink-0 bg-gray-200 overflow-hidden">
                  {s.imageUrl && s.imageUrl !== 'error' && (
                    isSvg
                      ? <div className="w-full h-full scale-50 origin-top-left"
                          dangerouslySetInnerHTML={{
                            __html: s.imageUrl.startsWith('data:')
                              ? atob(s.imageUrl.split(',')[1]) : s.imageUrl
                          }} />
                      : <img src={s.imageUrl} alt=""
                             className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-purple-700">
                      Scene {s.scene}
                    </span>
                    <span className="text-xs text-gray-400">{s.duration}</span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2">
                    {s.voiceover}
                  </p>
                  <p className="text-xs text-gray-400 italic">
                    "{s.caption}"
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    if (asset.type === 'stories') {
      const slides = (r.slides as Array<{
        slide: number, headline: string,
        subtext: string, cta: string, imageUrl?: string
      }>) ?? []
      return (
        <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
          {slides.map(s => {
            const isSvg = s.imageUrl?.trimStart().startsWith('<svg') ||
                          s.imageUrl?.startsWith('data:image/svg')
            return (
              <div key={s.slide}
                className="flex-shrink-0 w-32 rounded-xl overflow-hidden
                           border border-gray-200 relative bg-gray-100"
                style={{ aspectRatio: '9/16' }}>
                {s.imageUrl && s.imageUrl !== 'error' && (
                  isSvg
                    ? <div className="absolute inset-0"
                        dangerouslySetInnerHTML={{
                          __html: s.imageUrl.startsWith('data:')
                            ? atob(s.imageUrl.split(',')[1]) : s.imageUrl
                        }} />
                    : <img src={s.imageUrl} alt=""
                           className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/30 flex
                                flex-col justify-end p-2 space-y-0.5">
                  <p className="text-white text-xs font-bold leading-tight
                                line-clamp-2">
                    {s.headline}
                  </p>
                  <span className="bg-white text-gray-900 text-xs px-1.5
                                   py-0.5 rounded-full self-start">
                    {s.cta}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return null
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-gray-400">Loading history...</p>
    </div>
  )

  if (error) return (
    <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
      {error}
    </div>
  )

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">History</h2>
      <p className="text-sm text-gray-500">
        Your last 3 generated assets.
      </p>

      {assets.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400">
          No assets generated yet. Start creating!
        </div>
      )}

      {assets.map(asset => {
        const Icon       = typeIcon[asset.type as keyof typeof typeIcon] ?? Image
        const thumb      = thumbnail(asset)
        const isSvgThumb = thumb?.trimStart().startsWith('<svg') ||
                           thumb?.startsWith('data:image/svg')
        const isOpen     = expanded === asset.id

        return (
          <div key={asset.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Header row — always visible */}
            <div className="flex items-start gap-3 p-3">

              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg bg-gray-100
                              flex-shrink-0 overflow-hidden">
                {thumb && !isSvgThumb && (
                  <img src={thumb} alt=""
                       className="w-full h-full object-cover" />
                )}
                {thumb && isSvgThumb && (
                  <div className="w-full h-full overflow-hidden"
                    dangerouslySetInnerHTML={{
                      __html: thumb.startsWith('data:')
                        ? atob(thumb.split(',')[1]) : thumb
                    }} />
                )}
                {!thumb && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon size={22} className="text-gray-300" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5
                    rounded-full ${typeColor[asset.type as keyof typeof typeColor]
                    ?? 'bg-gray-100 text-gray-600'}`}>
                    {typeLabel[asset.type as keyof typeof typeLabel] ?? asset.type}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(asset.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 italic line-clamp-2">
                  "{asset.prompt}"
                </p>
                {!isOpen && (
                  <p className="text-xs font-medium text-gray-800 line-clamp-1">
                    {resultPreview(asset)}
                  </p>
                )}
              </div>
            </div>

            {/* Expanded full result */}
            {isOpen && asset.result_json && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-1">
                {renderFullResult(asset)}
              </div>
            )}

            {/* Action bar */}
            <div className="flex gap-2 px-3 pb-3">

              {/* View / Hide toggle */}
              <button
                onClick={() => setExpanded(isOpen ? null : asset.id)}
                className="flex-1 flex items-center justify-center gap-1.5
                           border border-gray-200 py-1.5 rounded-lg
                           text-xs text-gray-600 hover:bg-gray-50"
              >
                {isOpen ? 'Hide result' : 'View result'}
              </button>

              {/* Download */}
              {asset.result_json && (
                <button
                  onClick={() => handleDownload(asset)}
                  disabled={dlId === asset.id}
                  className="flex-1 flex items-center justify-center gap-1.5
                             border border-gray-200 py-1.5 rounded-lg
                             text-xs text-gray-600 hover:bg-gray-50
                             disabled:opacity-50"
                >
                  <Download size={13} />
                  {dlId === asset.id ? 'Preparing...' : 'Download'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}