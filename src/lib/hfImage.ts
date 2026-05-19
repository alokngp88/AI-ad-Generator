const HF_TOKEN = import.meta.env.VITE_HF_KEY
const MODEL = 'black-forest-labs/FLUX.1-schnell'

export async function generateImage(prompt: string): Promise<string> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { num_inference_steps: 4 }
      })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Image generation failed: ${err}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}