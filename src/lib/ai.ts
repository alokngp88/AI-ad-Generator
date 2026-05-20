import { supabase } from './supabase'

type Action = 'text' | 'json' | 'image'

async function callAI(action: Action, prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-generate', {
    body: { action, prompt }
  })

  if (error) {
    console.error('Supabase invoke error:', error)
    throw new Error(error.message)
  }

  if (data?.error) {
    console.error('Function returned error:', data.error)
    throw new Error(data.error)
  }

  return data.result
}

// ── Text generation ──────────────────────────────────────────────
export async function generateText(prompt: string): Promise<string> {
  return callAI('text', prompt)
}

// ── JSON generation ──────────────────────────────────────────────
export async function generateJSON<T>(prompt: string): Promise<T> {
  const raw = await callAI('json', prompt)
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('AI returned invalid JSON. Raw response: ' + raw.slice(0, 200))
  }
}

// ── Image generation (returns base64 data URL) ───────────────────
export async function generateImage(prompt: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: { action: 'image', prompt }
    })
  
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
  
    const result = data.result
  
    // SVG — return raw SVG string directly (don't convert to blob URL)
    if (typeof result === 'string' && result.trimStart().startsWith('<svg')) {
      return result  // raw SVG string
    }
  
    // Already a data URL (base64 PNG from Imagen 3)
    return result
  }