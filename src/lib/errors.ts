// Maps technical errors to user-friendly messages

export type AppErrorCode =
  | 'LIMIT_REACHED'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR'
  | 'AI_UNAVAILABLE'
  | 'SAVE_FAILED'
  | 'UNKNOWN'

export class AppError extends Error {
  code: AppErrorCode
  constructor(message: string, code: AppErrorCode) {
    super(message)
    this.code = code
  }
}

// Maps any raw error string → friendly message
export function getFriendlyMessage(error: unknown): {
  message: string
  code:    AppErrorCode
} {
  const raw = error instanceof Error ? error.message : String(error)
  const low = raw.toLowerCase()

  if (raw === 'LIMIT_REACHED' || low.includes('limit_reached')) {
    return {
      code:    'LIMIT_REACHED',
      message: 'You have reached your daily request limit. Please try again tomorrow.'
    }
  }
  if (low.includes('unauthorized') || low.includes('invalid session') ||
      low.includes('jwt') || low.includes('401')) {
    return {
      code:    'UNAUTHORIZED',
      message: 'Your session has expired. Please log out and log in again.'
    }
  }
  if (low.includes('failed to fetch') || low.includes('networkerror') ||
      low.includes('network') || low.includes('offline')) {
    return {
      code:    'NETWORK_ERROR',
      message: 'No internet connection. Please check your network and try again.'
    }
  }
  if (
    low.includes('gemini') || low.includes('cloudflare') ||
    low.includes('huggingface') || low.includes('ai error') ||
    low.includes('500') || low.includes('non-2xx') ||
    low.includes('edge function') || low.includes('internal server')
  ) {
    return {
      code:    'AI_UNAVAILABLE',
      message: 'We are currently facing technical difficulties. Please try again after sometime.'
    }
  }
  if (low.includes('save') || low.includes('insert') ||
      low.includes('database') || low.includes('db')) {
    return {
      code:    'SAVE_FAILED',
      message: 'Your asset was generated but could not be saved. You can still download it.'
    }
  }

  return {
    code:    'UNKNOWN',
    message: 'We are currently facing technical difficulties. Please try again after sometime.'
  }
}