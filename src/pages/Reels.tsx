import { useState } from 'react';
import PromptForm from '../components/PromptForm';
import { generateJSON, generateImage } from '../lib/ai_util'

type Scene = {
  scene: number;
  duration: string;
  voiceover: string;
  visual: string;
  caption: string;
  imageUrl?: string;
};

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
  const [loading, setLoading] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [error, setError] = useState('');

  async function handleGenerate(brief: string) {
    setLoading(true);
    setError('');
    setScenes([]);
    try {
      const prompt = `
        Create a 6-scene Instagram Reel script for: ${brief}
        Return a JSON array of 6 objects, each with:
        {
          "scene": 1,
          "duration": "3s",
          "voiceover": "What the narrator says",
          "visual": "What appears on screen (describe for image generation)",
          "caption": "On-screen text overlay"
        }
        Make it engaging, energetic, with a hook in scene 1 and CTA in scene 6.
      `;

      const script = await generateJSON(prompt) as ReelScene[]

      const withPlaceholders = script.map((s) => ({ ...s, imageUrl: '' }));
      setScenes(withPlaceholders);

      for (let i = 0; i < script.length; i++) {
        const imgUrl = await generateImage(
          script[i].visual + ', vertical video frame, cinematic, vibrant'
        );
        setScenes((prev) => {
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
      <h2 className="text-xl font-semibold text-gray-800">Reels Storyboard</h2>
      <p className="text-sm text-gray-500">
        Describe your brand or campaign. Get a 6-scene script with storyboard
        images.
      </p>

      <PromptForm
        onGenerate={handleGenerate}
        loading={loading}
        placeholder="e.g. A sustainable sneaker brand launching a new limited edition..."
      />

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {scenes.length > 0 && (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <div
              key={scene.scene}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="flex">
                <div className="w-28 h-28 bg-gray-100 flex-shrink-0">
                  {scene.imageUrl ? (
                    <img
                      src={scene.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center
                                      justify-center text-xs text-gray-400"
                    >
                      Loading...
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium bg-purple-100
                                     text-purple-700 px-2 py-0.5 rounded-full"
                    >
                      Scene {scene.scene}
                    </span>
                    <span className="text-xs text-gray-400">
                      {scene.duration}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium line-clamp-2">
                    {scene.voiceover}
                  </p>
                  <p className="text-xs text-gray-400 italic">
                    "{scene.caption}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
