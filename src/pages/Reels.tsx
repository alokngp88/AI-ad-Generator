import { useState } from 'react'
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm'
import UsageGuard from '../components/UsageGuard'
import { generateJSON, generateImage } from '../lib/ai_util'
import { saveAsset, logUsage } from '../lib/assets'
import { downloadReelsZip } from '../lib/download'
import { useUsage } from '../context/UsageContext'
import { useResults } from '../context/ResultsContext'
import ErrorMessage from '../components/ErrorMessage'
import { getFriendlyMessage, type AppErrorCode } from '../lib/errors'

type ReelScene = {
  scene:     number
  duration:  string
  hook:      string
  voiceover: string
  visual:    string
  caption:   string
  cta:       string
  imageUrl?: string
}

async function downloadSceneImage(scene: ReelScene) {
  const imageUrl = scene.imageUrl
  if (!imageUrl || imageUrl === 'error' || imageUrl === '') return

  try {
    const lines = [
      scene.hook      ? `Hook: ${scene.hook}`         : '',
      scene.voiceover ? `VO: ${scene.voiceover}`      : '',
      scene.caption   ? `"${scene.caption}"`          : '',
      scene.cta       ? `→ ${scene.cta}`              : '',
    ].filter(Boolean)

    const isSvg = imageUrl.trimStart().startsWith('<svg') ||
                  imageUrl.startsWith('data:image/svg')

    if (isSvg) {
      const raw = imageUrl.startsWith('data:image/svg+xml;base64,')
        ? atob(imageUrl.split(',')[1])
        : imageUrl

      const textOverlay = lines.map((line, i) =>
        `<text x="200" y="${340 + i * 24}" text-anchor="middle"
          font-family="sans-serif" font-size="14" font-weight="bold"
          fill="white" stroke="black" stroke-width="0.8"
          paint-order="stroke">${line}</text>`
      ).join('')

      const embedded = raw.replace('</svg>', `<g>${textOverlay}</g></svg>`)
      const blob = new Blob([embedded], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `scene-${scene.scene}.svg`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve()
      img.onerror = () => reject(new Error('Image load failed'))
      img.src     = imageUrl
    })

    const canvas  = document.createElement('canvas')
    canvas.width  = img.width  || 1024
    canvas.height = img.height || 1024
    const ctx     = canvas.getContext('2d')!

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const bannerH = 32 + lines.length * 26
    const grad    = ctx.createLinearGradient(
      0, canvas.height - bannerH - 20, 0, canvas.height
    )
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = grad
    ctx.fillRect(0, canvas.height - bannerH - 20, canvas.width, bannerH + 20)

    ctx.font      = `bold 18px sans-serif`
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur  = 4

    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        canvas.width / 2,
        canvas.height - bannerH + 16 + i * 26,
        canvas.width - 40
      )
    })

    const a    = document.createElement('a')
    a.href     = canvas.toDataURL('image/png')
    a.download = `scene-${scene.scene}.png`
    a.click()

  } catch (e) {
    console.error('Scene download error:', e)
  }
}

export default function Reels() {
  const [loading,    setLoading]    = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [dlLoading,  setDlLoading]  = useState(false)
  const [dlScene,    setDlScene]    = useState<number | null>(null)
  const [error,      setError]      = useState('')
  const [errorCode,  setErrorCode]  = useState<AppErrorCode>('UNKNOWN')
  const { scenes, setScenes }       = useResults()
  const { decrement, refetch }      = useUsage()

  function handleError(e: unknown) {
    const { message, code } = getFriendlyMessage(e)
    setError(message)
    setErrorCode(code)
  }

  function clearError() { setError('') }

  async function handleGenerate(brief: string) {
    setLoading(true)
    clearError()
    setScenes([])
    try {
      const { usageId } = await logUsage('reels')
      decrement()

      const prompt = `
        Create a 6-scene Instagram Reel script for: ${brief}
        Return a JSON array of exactly 6 objects, each with:
        {
          "scene": 1,
          "duration": "3s",
          "hook": "Opening hook line (scene 1 only, empty string for others)",
          "voiceover": "What the narrator says (1-2 sentences)",
          "visual": "What appears on screen (describe for image generation)",
          "caption": "On-screen text overlay (max 6 words)",
          "cta": "Call to action (scene 6 only, empty string for others)"
        }
        Scene 1: Strong hook. Scenes 2-5: Value/story. Scene 6: Clear CTA.
      `
      const script = await generateJSON(prompt) as ReelScene[]
      const withPlaceholders = script.map(s => ({ ...s, imageUrl: '' }))
      setScenes(withPlaceholders)
      setLoading(false)

      const finalScenes = [...withPlaceholders]
      setImgLoading(true)

      for (let i = 0; i < script.length; i++) {
        try {
          const imgUrl = await generateImage(
            script[i].visual + ', vertical video frame, cinematic, vibrant'
          )
          finalScenes[i] = { ...finalScenes[i], imageUrl: imgUrl }
          setScenes(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], imageUrl: imgUrl }
            return updated
          })
        } catch {
          finalScenes[i] = { ...finalScenes[i], imageUrl: 'error' }
          setScenes(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], imageUrl: 'error' }
            return updated
          })
        }
      }

      await saveAsset(
        'reels',
        brief,
        { scenes: finalScenes } as Record<string, unknown>,
        usageId
      )
      await refetch()

    } catch (e: unknown) {
      handleError(e)
    } finally {
      setLoading(false)
      setImgLoading(false)
    }
  }

  async function handleDownloadAll() {
    if (!scenes.length) return
    setDlLoading(true)
    try { await downloadReelsZip(scenes) }
    catch (e) { handleError(e) }
    finally { setDlLoading(false) }
  }

  async function handleDownloadScene(scene: ReelScene) {
    setDlScene(scene.scene)
    await downloadSceneImage(scene)
    setDlScene(null)
  }

  const loadedCount = scenes.filter(
    s => s.imageUrl && s.imageUrl !== 'error' && s.imageUrl !== ''
  ).length

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Reels Storyboard</h2>
      <p className="text-sm text-gray-500">
        Describe your brand or campaign. Get a 6-scene script with
        storyboard images.
      </p>

      <UsageGuard>
        <PromptForm
          onGenerate={handleGenerate}
          loading={loading}
          placeholder="e.g. A sustainable sneaker brand launching a new limited edition..."
        />
      </UsageGuard>

      {error && (
        <ErrorMessage
          message={error}
          code={errorCode}
          onRetry={clearError}
        />
      )}

      {imgLoading && scenes.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Generating storyboard images... {loadedCount} / {scenes.length}
        </p>
      )}

      {scenes.length > 0 && (
        <>
          <div className="space-y-3">
            {scenes.map((scene) => {
              const hasImage = !!scene.imageUrl &&
                               scene.imageUrl !== 'error' &&
                               scene.imageUrl !== ''
              const isSvg   = scene.imageUrl?.trimStart().startsWith('<svg') ||
                              scene.imageUrl?.startsWith('data:image/svg')
              const showHook = scene.scene === 1 && !!scene.hook
              const showCta  = scene.scene === 6 && !!scene.cta

              return (
                <div key={scene.scene}
                  className="bg-white rounded-xl border border-gray-200">
                  <div className="flex">

                    {/* ── Image column — KEY: relative WITHOUT overflow-hidden ── */}
                    <div className="w-28 h-28 flex-shrink-0 relative
                                    bg-gray-100 rounded-l-xl">

                      {/* Clip only the image itself, not the button */}
                      <div className="absolute inset-0 rounded-l-xl overflow-hidden">
                        {hasImage && isSvg && (
                          <div
                            className="w-full h-full"
                            dangerouslySetInnerHTML={{
                              __html: scene.imageUrl!.startsWith('data:')
                                ? atob(scene.imageUrl!.split(',')[1])
                                : scene.imageUrl!
                            }}
                          />
                        )}
                        {hasImage && !isSvg && (
                          <img
                            src={scene.imageUrl}
                            alt={`Scene ${scene.scene}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {!hasImage && (
                          <div className="w-full h-full flex items-center
                                          justify-center text-xs text-gray-400">
                            {scene.imageUrl === 'error' ? 'Failed' : 'Loading...'}
                          </div>
                        )}
                      </div>

                      {/* Download button — OUTSIDE the overflow-hidden div */}
                      {hasImage && (
                        <button
                          onClick={() => handleDownloadScene(scene)}
                          disabled={dlScene === scene.scene}
                          title="Download this scene"
                          className="absolute top-1 right-1 z-20
                                     w-7 h-7 rounded-full
                                     bg-black/55 hover:bg-black/80
                                     flex items-center justify-center
                                     transition-all disabled:opacity-50
                                     active:scale-90 shadow-sm"
                        >
                          {dlScene === scene.scene
                            ? <span className="w-3 h-3 border-2 border-white
                                               border-t-transparent rounded-full
                                               animate-spin block" />
                            : <Download size={12} className="text-white" />
                          }
                        </button>
                      )}
                    </div>

                    {/* Scene text */}
                    <div className="p-3 flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium bg-purple-100
                                         text-purple-700 px-2 py-0.5 rounded-full">
                          Scene {scene.scene}
                        </span>
                        <span className="text-xs text-gray-400">
                          {scene.duration}
                        </span>
                        {showHook && (
                          <span className="text-xs bg-amber-100 text-amber-700
                                           px-2 py-0.5 rounded-full">
                            Hook
                          </span>
                        )}
                        {showCta && (
                          <span className="text-xs bg-green-100 text-green-700
                                           px-2 py-0.5 rounded-full">
                            CTA
                          </span>
                        )}
                      </div>

                      {showHook && (
                        <p className="text-xs font-bold text-gray-900 line-clamp-1">
                          {scene.hook}
                        </p>
                      )}
                      <p className="text-xs text-gray-700 font-medium line-clamp-2">
                        {scene.voiceover}
                      </p>
                      <p className="text-xs text-gray-400 italic">
                        "{scene.caption}"
                      </p>
                      {showCta && (
                        <p className="text-xs text-blue-600 font-medium">
                          → {scene.cta}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleDownloadAll}
            disabled={dlLoading || imgLoading}
            className="w-full flex items-center justify-center gap-2
                       border border-gray-200 py-2.5 rounded-xl
                       text-sm text-gray-600 hover:bg-gray-50
                       disabled:opacity-50 transition-colors"
          >
            <Download size={15} />
            {dlLoading
              ? 'Preparing zip...'
              : imgLoading
              ? `Wait — generating images (${loadedCount}/${scenes.length})`
              : 'Download all scenes (.zip)'}
          </button>
        </>
      )}
    </div>
  )
}