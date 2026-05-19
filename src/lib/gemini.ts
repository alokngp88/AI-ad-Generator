const API_KEY = import.meta.env.VITE_GEMINI_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-2.0-flash'

export async function generateText(prompt: string): Promise<string> {
  const response = await fetch(
    `${BASE_URL}/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
        }
      })
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Gemini API error')
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const raw = await generateText(prompt + '\n\nRespond ONLY with valid JSON. No explanation, no markdown, no code fences.')
  const clean = raw.replace(/```json|\n```|```/g, '').trim()
  return JSON.parse(clean) as T
}