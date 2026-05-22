import { supabase } from './supabase'
import { getFriendlyMessage, AppError } from './errors'

type Action = 'text' | 'json' | 'image'

async function callAI(action: Action, prompt: string): Promise<string> {
  let data: { result?: string; error?: string } | null = null
  let invokeError: Error | null = null

  try {
    const res = await supabase.functions.invoke<{ result?: string; error?: string }>(
      'ai-generate',
      { body: { action, prompt } }
    )
    data        = res.data
    invokeError = res.error ? new Error(res.error.message) : null
  } catch (e) {
    throw new AppError('Network error calling ai-generate', 'NETWORK_ERROR')
  }

  if (invokeError) {
    const { code } = getFriendlyMessage(invokeError)
    throw new AppError(invokeError.message, code)
  }
  if (!data) {
    throw new AppError('No response from AI service', 'AI_UNAVAILABLE')
  }
  if (data.error) {
    const { code } = getFriendlyMessage(data.error)
    throw new AppError(data.error, code)
  }

  return data.result as string
}

// ── Text generation ──────────────────────────────────────────────
export async function generateText(prompt: string): Promise<string> {
  return callAI('text', prompt)
}

// ── JSON generation ──────────────────────────────────────────────
export async function generateJSON(prompt: string): Promise<unknown> {
  const raw   = await callAI('json', prompt)
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('AI returned invalid JSON. Raw: ' + clean.slice(0, 200))
  }
}

// ── Image generation (returns base64 data URL) ───────────────────
export async function generateImage(prompt: string): Promise <string>{
  const { data, error } = await supabase.functions.invoke('ai-generate', {
    body: { action: 'image', prompt }
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.result  // always data:image/png;base64,...
}