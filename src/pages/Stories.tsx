import { useState } from 'react';
import { Download } from 'lucide-react'
import PromptForm from '../components/PromptForm';
import UsageGuard from '../components/UsageGuard'
import { generateJSON, generateImage } from '../lib/ai_util'
import { saveAsset, logUsage } from '../lib/assets'
import { downloadStoriesZip } from '../lib/download'
import { useUsage } from '../context/UsageContext'
import { useResults } from '../context/ResultsContext'

type Slide = {
  slide: number;
  headline: string;
  subtext: string;
  cta: string;
  bg_prompt: string;
  imageUrl?: string;
};

export default function Stories() {
  const [loading, setLoading] = useState(false);
  const { slides, setSlides } = useResults()
  const [error, setError] = useState('');
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
    setLoading(true);
    clearError()
    setSlides([]);
    try {
      // ── 1. Check + log usage FIRST (gate before AI call) ────────
      const { usageId } = await logUsage('stories')
      decrement()

      const prompt = `
        Create 3 Instagram Story slides for: ${brief}
        Return a JSON array of 3 objects:
        {
          "slide": 1,
          "headline": "Bold short headline (max 5 words)",
          "subtext": "One supporting sentence",
          "cta": "Action phrase (3 words max)",
          "bg_prompt": "Background image description for AI generation"
        }
        Slide 1: Hook/attention. Slide 2: Value/benefit. Slide 3: CTA.
      `;

      const storySlides = await generateJSON(prompt) as Slide[]
      const withPlaceholders = storySlides.map((s) => ({ ...s, imageUrl: '' }));
      setSlides(storySlides.map((s) => ({ ...s, imageUrl: '' })));
      setLoading(false)

      const finalSlides = [...withPlaceholders]
      setLoading(true)
      for (let i = 0; i < storySlides.length; i++) {
        try {
          const imgUrl = await generateImage(
            storySlides[i].bg_prompt +
              ', portrait 9x16 aspect ratio, Instagram story background, vibrant'
          );
          // Update local array
          finalSlides[i] = { ...finalSlides[i], imageUrl: imgUrl }
          setSlides((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], imageUrl: imgUrl };
            return updated;
          });
        } catch {
          finalSlides[i] = { ...finalScenes[i], imageUrl: 'error' }
          setSlides(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], imageUrl: 'error' }
          return updated
        })
        }
      }
      await saveAsset(
        'stories',
        brief,
        { slides: finalSlides } as Record<string, unknown>,
        usageId
      )
      await refetch()
    } catch (e: any) {
      handleError(e)
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!slides) return
    setDlLoading(true)
    try { await downloadStoriesZip(slides) }
    finally { setDlLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Instagram Stories</h2>
      <p className="text-sm text-gray-500">
        Get 3 story slides with copy and background visuals.
      </p>

      <UsageGuard onGenerate={handleGenerate} loading={loading}
        placeholder="e.g. A yoga studio running a summer membership sale...">
        <PromptForm onGenerate={handleGenerate} loading={loading}
          placeholder="e.g. A yoga studio running a summer membership sale..." />
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

      {slides.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {slides.map((slide) => (
            <div
              key={slide.slide}
              className="flex-shrink-0 w-44 rounded-2xl overflow-hidden
                         border border-gray-200 relative"
              style={{ aspectRatio: '9/16' }}
            >
              {slide.imageUrl ? (
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full bg-gray-100 flex
                                  items-center justify-center text-xs
                                  text-gray-400"
                >
                  Loading...
                </div>
              )}
              <div
                className="absolute inset-0 bg-black/30 flex flex-col
                              justify-end p-3 space-y-1"
              >
                <span className="text-white text-xs font-bold leading-tight">
                  {slide.headline}
                </span>
                <span className="text-white/80 text-xs leading-snug">
                  {slide.subtext}
                </span>
                <span
                  className="bg-white text-gray-900 text-xs font-medium
                                 px-2 py-0.5 rounded-full self-start mt-1"
                >
                  {slide.cta}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
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
  );
}
