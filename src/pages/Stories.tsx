import { useState } from 'react'
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm'
import UsageGuard from '../components/UsageGuard'
import { generateJSON, generateImage } from '../lib/ai_util'
import { saveAsset, logUsage } from '../lib/assets'
import { downloadStoriesZip } from '../lib/download'
import { useUsage } from '../context/UsageContext'
import { useResults } from '../context/ResultsContext'
import ErrorMessage from '../components/ErrorMessage'
import { getFriendlyMessage, type AppErrorCode } from '../lib/errors'

type StorySlide = {
  slide:     number
  headline:  string
  subtext:   string
  cta:       string
  bg_prompt: string
  imageUrl?: string
}

// ── Per-slide image + text download ─────────────────────────────
async function downloadSlideImage(slide: StorySlide) {
  const imageUrl = slide.imageUrl
  if (!imageUrl || imageUrl === 'error') return

  try {
    const lines = [
      slide.headline,
      slide.subtext,
      slide.cta ? `→ ${slide.cta}` : '',
    ].filter(Boolean)

    const isSvg = imageUrl.trimStart().startsWith('<svg') ||
                  imageUrl.startsWith('data:image/svg')

    if (isSvg) {
      const raw = imageUrl.startsWith('data:image/svg+xml;base64,')
        ? atob(imageUrl.split(',')[1])
        : imageUrl

      const textOverlay = lines.map((line, i) =>
        `<text x="200" y="${480 + i * 26}" text-anchor="middle"
          font-family="sans-serif" font-size="15" font-weight="bold"
          fill="white" stroke="black" stroke-width="0.8"
          paint-order="stroke">${line}</text>`
      ).join('')

      const embedded = raw.replace('</svg>', `<g>${textOverlay}</g></svg>`)
      const blob = new Blob([embedded], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `story-slide-${slide.slide}.svg`
      a.click()
      URL.revokeObjectURL(url)

    } else {
      // PNG — draw on canvas with 9:16 ratio + text overlay
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload  = () => resolve()
        img.onerror = () => reject(new Error('Image load failed'))
        img.src     = imageUrl
      })

      // Use 9:16 portrait canvas
      const canvas  = document.createElement('canvas')
      canvas.width  = img.width  || 1080
      canvas.height = img.height || 1920
      const ctx     = canvas.getContext('2d')!

      // Draw background image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Gradient banner at bottom for text
      const grad = ctx.createLinearGradient(
        0, canvas.height - 260, 0, canvas.height
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.75)')
      ctx.fillStyle = grad
      ctx.fillRect(0, canvas.height - 260, canvas.width, 260)

      // Headline — large
      ctx.font         = `bold ${Math.round(canvas.width * 0.055)}px sans-serif`
      ctx.fillStyle    = 'white'
      ctx.textAlign    = 'center'
      ctx.shadowColor  = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur   = 8

      ctx.fillText(
        slide.headline,
        canvas.width / 2,
        canvas.height - 180,
        canvas.width - 80
      )

      // Subtext — smaller
      ctx.font         = `${Math.round(canvas.width * 0.035)}px sans-serif`
      ctx.shadowBlur   = 4
      ctx.fillText(
        slide.subtext,
        canvas.width / 2,
        canvas.height - 120,
        canvas.width - 80
      )

      // CTA pill
      if (slide.cta) {
        const ctaText  = slide.cta
        const ctaY     = canvas.height - 60
        const ctaW     = 300
        const ctaH     = 56
        const ctaX     = (canvas.width - ctaW) / 2

        ctx.shadowBlur   = 0
        ctx.fillStyle    = 'white'
        ctx.beginPath()
        ctx.roundRect(ctaX, ctaY - ctaH + 10, ctaW, ctaH, 28)
        ctx.fill()

        ctx.fillStyle    = '#1d4ed8'
        ctx.font         = `bold ${Math.round(canvas.width * 0.03)}px sans-serif`
        ctx.fillText(ctaText, canvas.width / 2, ctaY - 20)
      }

      const a    = document.createElement('a')
      a.href     = canvas.toDataURL('image/png')
      a.download = `story-slide-${slide.slide}.png`
      a.click()
    }
  } catch (e) {
    console.error('Slide download error:', e)
  }
}

export default function Stories() {
  const [loading,    setLoading]    = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const { slides, setSlides }       = useResults()
  const [error,      setError]      = useState('')
  const [errorCode,  setErrorCode]  = useState<AppErrorCode>('UNKNOWN')
  const [dlLoading,  setDlLoading]  = useState(false)
  const [dlSlide,    setDlSlide]    = useState<number | null>(null)
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
    setSlides([])
    try {
      // 1. Gate — log usage first
      const { usageId } = await logUsage('stories')
      decrement()

      // 2. Generate slide copy
      const prompt = `
        Create 3 Instagram Story slides for: ${brief}
        Return a JSON array of exactly 3 objects:
        {
          "slide": 1,
          "headline": "Bold short headline (max 5 words)",
          "subtext": "One supporting sentence",
          "cta": "Action phrase (3 words max)",
          "bg_prompt": "Background image description for AI generation"
        }
        Slide 1: Hook/attention. Slide 2: Value/benefit. Slide 3: CTA.
        Make it punchy and native to Instagram Stories.
      `
      const storySlides = await generateJSON(prompt) as StorySlide[]
      const withPlaceholders = storySlides.map(s => ({ ...s, imageUrl: '' }))
      setSlides(withPlaceholders)
      setLoading(false)

      // 3. Generate background images progressively
      const finalSlides = [...withPlaceholders]
      setImgLoading(true)

      for (let i = 0; i < storySlides.length; i++) {
        try {
          const imgUrl = await generateImage(
            storySlides[i].bg_prompt +
            ', portrait 9x16 Instagram story background, vibrant, cinematic'
          )
          finalSlides[i] = { ...finalSlides[i], imageUrl: imgUrl }
          setSlides(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], imageUrl: imgUrl }
            return updated
          })
        } catch {
          finalSlides[i] = { ...finalSlides[i], imageUrl: 'error' }
          setSlides(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], imageUrl: 'error' }
            return updated
          })
        }
      }

      // 4. Save after all slides done
      await saveAsset(
        'stories',
        brief,
        { slides: finalSlides } as Record<string, unknown>,
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
    if (!slides.length) return
    setDlLoading(true)
    try { await downloadStoriesZip(slides) }
    catch (e) { handleError(e) }
    finally { setDlLoading(false) }
  }

  async function handleDownloadSlide(slide: StorySlide) {
    setDlSlide(slide.slide)
    await downloadSlideImage(slide)
    setDlSlide(null)
  }

  const loadedCount = slides.filter(
    s => s.imageUrl && s.imageUrl !== 'error'
  ).length

  // Slide label by position
  const slideLabel = (slide: StorySlide) => {
    if (slide.slide === 1) return { text: 'Hook',    color: 'bg-amber-100 text-amber-700'  }
    if (slide.slide === 2) return { text: 'Value',   color: 'bg-blue-100 text-blue-700'    }
    if (slide.slide === 3) return { text: 'CTA',     color: 'bg-green-100 text-green-700'  }
    return { text: `Slide ${slide.slide}`, color: 'bg-gray-100 text-gray-600' }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">
        Instagram Stories
      </h2>
      <p className="text-sm text-gray-500">
        Get 3 story slides with copy and background visuals.
      </p>

      <UsageGuard>
        <PromptForm
          onGenerate={handleGenerate}
          loading={loading}
          placeholder="e.g. A yoga studio running a summer membership sale..."
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
      {imgLoading && slides.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Generating slide backgrounds... {loadedCount} / {slides.length}
        </p>
      )}

      {slides.length > 0 && (
        <>
          {/* Portrait slide carousel */}
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {slides.map(slide => {
              const hasImage = !!slide.imageUrl &&
                               slide.imageUrl !== 'error' &&
                               slide.imageUrl !== ''
              const isSvg   = slide.imageUrl?.trimStart().startsWith('<svg') ||
                              slide.imageUrl?.startsWith('data:image/svg')
              const label   = slideLabel(slide)

              return (
                <div
                  key={slide.slide}
                  className="flex-shrink-0 snap-center relative rounded-2xl
                             overflow-hidden border border-gray-200 bg-gray-100"
                  style={{
                    width:       '160px',
                    aspectRatio: '9/16',
                  }}
                >
                  {/* Background image */}
                  {hasImage && isSvg && (
                    <div
                      className="absolute inset-0 w-full h-full"
                      dangerouslySetInnerHTML={{
                        __html: slide.imageUrl!.startsWith('data:')
                          ? atob(slide.imageUrl!.split(',')[1])
                          : slide.imageUrl!
                      }}
                    />
                  )}
                  {hasImage && !isSvg && (
                    <img
                      src={slide.imageUrl}
                      alt={`Slide ${slide.slide}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  {!hasImage && (
                    <div className="absolute inset-0 flex items-center
                                    justify-center text-xs text-gray-400">
                      {slide.imageUrl === 'error' ? 'Failed' : 'Loading...'}
                    </div>
                  )}

                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t
                                  from-black/70 via-black/10 to-transparent" />

                  {/* Slide label badge — top left */}
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs font-medium px-2 py-0.5
                                      rounded-full ${label.color}`}>
                      {label.text}
                    </span>
                  </div>

                  {/* ── Per-slide download button — top right ── */}
                  {hasImage && (
                    <button
                      onClick={() => handleDownloadSlide(slide)}
                      disabled={dlSlide === slide.slide}
                      title="Download this slide"
                      className="absolute top-2 right-2
                                 w-7 h-7 rounded-full
                                 bg-black/50 hover:bg-black/70
                                 flex items-center justify-center
                                 transition-colors disabled:opacity-50
                                 active:scale-95 z-10"
                    >
                      {dlSlide === slide.slide
                        ? <span className="w-3 h-3 border border-white
                                           border-t-transparent rounded-full
                                           animate-spin block" />
                        : <Download size={13} className="text-white" />
                      }
                    </button>
                  )}

                  {/* Text content — bottom overlay */}
                  <div className="absolute bottom-0 left-0 right-0
                                  p-3 space-y-1.5">
                    <p className="text-white text-xs font-bold
                                  leading-tight line-clamp-2 drop-shadow">
                      {slide.headline}
                    </p>
                    <p className="text-white/80 text-xs leading-snug
                                  line-clamp-2 drop-shadow">
                      {slide.subtext}
                    </p>
                    {slide.cta && (
                      <span className="inline-block bg-white text-gray-900
                                       text-xs font-semibold px-2.5 py-1
                                       rounded-full mt-1 drop-shadow">
                        {slide.cta}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Expanded text view below carousel */}
          <div className="space-y-2">
            {slides.map(slide => {
              const label = slideLabel(slide)
              return (
                <div key={slide.slide}
                  className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5
                                      rounded-full flex-shrink-0 ${label.color}`}>
                      {label.text}
                    </span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-gray-900">
                        {slide.headline}
                      </p>
                      <p className="text-xs text-gray-500">{slide.subtext}</p>
                      {slide.cta && (
                        <p className="text-xs text-blue-600 font-medium">
                          → {slide.cta}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Download all as zip */}
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
              ? `Wait — generating slides (${loadedCount}/${slides.length})`
              : 'Download all slides (.zip)'}
          </button>
        </>
      )}
    </div>
  )
}