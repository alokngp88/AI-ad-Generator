import { supabase } from './supabase'
import { getFriendlyMessage, AppError } from './errors'

export type AssetType = 'poster' | 'reels' | 'stories'

export type UserProfile = {
    user_id:    string
    email:      string
    name:       string | null
    phone:      string | null
    plan_type:  'Free' | 'Paid'
    plan:       string | null
    start_date: string | null
    end_date:   string | null
    rpd:        number
  }

  export type UsageInfo = {
    used:      number
    limit:     number
    remaining: number
    plan_type: 'Free' | 'Paid'
  }

interface DBResponse<T> {
  result?: T
  error?:  string
}

async function callDB<T>(
  action:   string,
  payload?: Record<string, unknown>
): Promise<T> {
  let data: { result?: T; error?: string } | null = null
  let invokeError: Error | null = null

  try {
    const res = await supabase.functions.invoke<{ result?: T; error?: string }>(
      'ad-dbmanger',
      { body: { action, payload } }
    )
    data        = res.data
    invokeError = res.error ? new Error(res.error.message) : null
  } catch (e) {
    // Network-level failure
    throw new AppError(
      'Network error calling ad-dbmanger',
      'NETWORK_ERROR'
    )
  }

  if (invokeError) {
    const { code } = getFriendlyMessage(invokeError)
    throw new AppError(invokeError.message, code)
  }
  if (!data) {
    throw new AppError('No response from server', 'UNKNOWN')
  }
  if (data.error) {
    const { code } = getFriendlyMessage(data.error)
    throw new AppError(data.error, code)
  }

  return data.result as T
}

// Get how many requests user has made today
export async function getUsage(): Promise<{ used: number }> {
  return callDB('get-usage')
}

// Log one usage entry — returns usageId + updated counts
export async function logUsage(assetType: AssetType): Promise<{
  usageId:   string
  used:      number
  remaining: number
}> {
  return callDB('log-usage', { assetType })
}

// Save a generated asset linked to a usage row
export async function saveAsset(
  assetType:  AssetType,
  prompt:     string,
  resultJson: Record<string, unknown>,
  usageId?:   string
): Promise<{ assetId: string }> {
  return callDB('save-asset', { assetType, prompt, resultJson, usageId })
}

// Fetch last N assets for history page
export async function fetchRecentAssets(limit = 3): Promise<Array<{
  id:          string
  type:        string
  prompt:      string
  result_json: Record<string, unknown>
  created_at:  string
}>> {
  return callDB('get-history', { limit })
}

export async function getUserProfile(): Promise<UserProfile> {
    return callDB('get-user-profile')
  }
  
  export async function updateUserProfile(
    name:  string,
    phone: string
  ): Promise<{ success: boolean }> {
    return callDB('update-user-profile', { name, phone })
  }