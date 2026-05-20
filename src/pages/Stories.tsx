import { useState } from 'react';
import PromptForm from '../components/PromptForm';
import { generateJSON, generateImage } from '../lib/ai'

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
  const [slides, setSlides] = useState<Slide[]>([]);
  const [error, setError] = useState('');

  async function handleGenerate(brief: string) {
    setLoading(true);
    setError('');
    setSlides([]);
    try {
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

      const storySlides = await generateJSON<Slide[]>(prompt);
      setSlides(storySlides.map((s) => ({ ...s, imageUrl: '' })));

      for (let i = 0; i < storySlides.length; i++) {
        const imgUrl = await generateImage(
          storySlides[i].bg_prompt +
            ', portrait 9x16 aspect ratio, Instagram story background, vibrant'
        );
        setSlides((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], imageUrl: imgUrl };
          return updated;
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Instagram Stories</h2>
      <p className="text-sm text-gray-500">
        Get 3 story slides with copy and background visuals.
      </p>

      <PromptForm
        onGenerate={handleGenerate}
        loading={loading}
        placeholder="e.g. A yoga studio running a summer membership sale..."
      />

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          {error}
        </div>
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
    </div>
  );
}
