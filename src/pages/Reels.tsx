import { useState } from 'react'
import { Download, ArrowDownToLine } from 'lucide-react'
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

export default function Reels() {
  const [loading,   setLoading]   = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [error,     setError]     = useState('')
  const [errorCode, setErrorCode] = useState<AppErrorCode>('UNKNOWN')
  const [dlLoading, setDlLoading] = useState(false)
  const { scenes, setScenes }     = useResults()
  const { decrement, refetch }    = useUsage()

  function handleError(e: unknown) {
    const { message, code } = getFriendlyMessage(e)
    setError(message)
    setErrorCode(code)
  }

  function clearError() { setError('') }

  // ── Per-image download with embedded caption ─────────────────
  function downloadSceneImage(scene: ReelScene) {
    const { imageUrl, caption, voiceover, scene: num } = scene
    if (!imageUrl || imageUrl === 'error') return

    const isSvg = imageUrl.trimStart().startsWith('<svg') ||
                  imageUrl.startsWith('data:image/svg')

    if (isSvg) {
      // For SVG — embed caption as text overlay then download
      const rawSvg = imageUrl.startsWith('data:')
        ? atob(imageUrl.split(',')[1]) : imageUrl

      const textOverlay = `
        <text x="50%" y="92%" text-anchor="middle"
          font-family="sans-serif" font-size="14" font-weight="bold"
          fill="white" stroke="black" stroke-width="0.4">${caption}</text>
        <text x="50%" y="97%" text-anchor="middle"
          font-family="sans-serif" font-size="11"
          fill="white" stroke="black" stroke-width="0.3"
          >${voiceover.slice(0, 60)}${voiceover.length > 60 ? '…' : ''}</text>
      `
      const embeddedSvg = rawSvg.replace('</svg>', `${textOverlay}</svg>`)
      const blob = new Blob([embeddedSvg], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `reel-scene-${num}.svg`
      a.click()
      URL.revokeObjectURL(url)

    } else {
      // For PNG — draw on canvas with caption overlay then download
      const img  = new Image()
      img.onload = () => {
        const canvas  = document.createElement('canvas')
        canvas.width  = img.width
        canvas.height = img.height
        const ctx     = canvas.getContext('2d')!

        // Draw image
        ctx.drawImage(img, 0, 0)

        // Draw semi-transparent caption bar at bottom
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, img.height - 64, img.width, 64)

        // Caption text
        ctx.fillStyle    = 'white'
        ctx.font         = `bold ${Math.round(img.width * 0.045)}px sans-serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(caption, img.width / 2, img.height - 44)

        // Voiceover preview
        ctx.font      = `${Math.round(img.width * 0.032)}px sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        const preview = voiceover.length > 55
          ? voiceover.slice(0, 55) + '…' : voiceover
        ctx.fillText(preview, img.width / 2, img.height - 20)

        canvas.toBlob(blob => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const a   = document.createElement('a')
          a.href    = url
          a.download = `reel-scene-${num}.png`
          a.click()
          URL.revokeObjectURL(url)
        }, 'image/png')
      }
      img.src = imageUrl
    }
  }

  async function handleGenerate(brief: string) {
    setLoading(true)
    clearError()
    setScenes([])
    try {
      // 1. Log usage first
      const { usageId } = await logUsage('reels')
      decrement()

      // 2. Generate script
      const prompt = `
        Create a 6-scene Instagram Reel script for: ${brief}
        Return a JSON array of 6 objects, each with:
        {
          "scene": 1,
          "duration": "3s",
          "hook": "Opening hook (scene 1 only, empty string for others)",
          "voiceover": "What the narrator says",
          "visual": "What appears on screen (describe for image generation)",
          "caption": "On-screen text overlay (max 6 words)",
          "cta": "Call to action (scene 6 only, empty string for others)"
        }
        Make it engaging, energetic, hook in scene 1, CTA in scene 6.
      `
      const script = await generateJSON(prompt) as ReelScene[]
      const withPlaceholders = script.map(s => ({ ...s, imageUrl: '' }))
      setScenes(withPlaceholders)
      setLoading(false)
      setImgLoading(true)

      // 3. Generate images progressively using local array
      const finalScenes = [...withPlaceholders]

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

      // 4. Save with all images
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

  const allImagesLoaded = scenes.length > 0 &&
    scenes.every(s => s.imageUrl && s.imageUrl !== '')
  const loadedCount = scenes.filter(
    s => s.imageUrl && s.imageUrl !== '' && s.imageUrl !== 'error'
  ).length

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Reels Storyboard</h2>
      <p className="text-sm text-gray-500">
        Describe your brand or campaign. Get a 6-scene script with storyboard images.
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

      {/* Image loading progress */}
      {imgLoading && scenes.length > 0 && (
        <p className="text-xs text-center text-gray-400">
          Generating storyboard images... {loadedCount} of {scenes.length}
        </p>
      )}

      {scenes.length > 0 && (
        <>
          <div className="space-y-3">
            {scenes.map(scene => (
              <div key={scene.scene}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex">

                  {/* Image with per-image download button */}
                  <div className="relative w-28 h-28 bg-gray-100 flex-shrink-0">
                    {scene.imageUrl && scene.imageUrl !== 'error' ? (
                      <>
                        <img
                          src={scene.imageUrl}
                          alt={`Scene ${scene.scene}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Download icon — top right of image */}
                        <button
                          onClick={() => downloadSceneImage(scene)}
                          className="absolute top-1 right-1 w-7 h-7 rounded-full
                                     bg-black/50 flex items-center justify-center
                                     hover:bg-black/70 active:scale-95
                                     transition-all touch-manipulation"
                          title="Download this scene"
                        >
                          <ArrowDownToLine size={13} className="text-white" />
                        </button>
                      </>
                    ) : scene.imageUrl === 'error' ? (
                      <div className="w-full h-full flex items-center
                                      justify-center text-xs text-gray-400 p-1
                                      text-center">
                        Image failed
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center
                                      justify-center text-xs text-gray-400">
                        {loading ? '...' : 'Generating...'}
                      </div>
                    )}
                  </div>

                  {/* Scene details */}
                  <div className="p-3 flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium bg-purple-100
                                       text-purple-700 px-2 py-0.5 rounded-full">
                        Scene {scene.scene}
                      </span>
                      <span className="text-xs text-gray-400">{scene.duration}</span>
                      {scene.hook && (
                        <span className="text-xs bg-amber-100 text-amber-700
                                         px-2 py-0.5 rounded-full">Hook</span>
                      )}
                      {scene.cta && (
                        <span className="text-xs bg-blue-100 text-blue-700
                                         px-2 py-0.5 rounded-full">CTA</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 font-medium line-clamp-2">
                      {scene.hook || scene.voiceover}
                    </p>
                    <p className="text-xs text-gray-400 italic">
                      "{scene.caption}"
                    </p>
                    {scene.cta && (
                      <p className="text-xs text-blue-600 font-medium">
                        → {scene.cta}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Download all as zip — shown when all images loaded */}
          {allImagesLoaded && (
            <button
              onClick={handleDownloadAll}
              disabled={dlLoading}
              className="w-full flex items-center justify-center gap-2
                         border border-gray-200 py-2.5 rounded-xl
                         text-sm text-gray-600 hover:bg-gray-50
                         disabled:opacity-50 transition-colors"
            >
              <Download size={15} />
              {dlLoading ? 'Preparing zip...' : 'Download all scenes (.zip)'}
            </button>
          )}
        </>
      )}
    </div>
  )
}