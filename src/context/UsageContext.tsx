// src/context/UsageContext.tsx — full updated file
import type { ReactNode } from 'react';

import {
    createContext, useContext, useEffect,
    useState, useCallback
  } from 'react'
  import { getUsage, type UsageInfo } from '../lib/assets'
  
  type UsageContextType = UsageInfo & {
    isExhausted: boolean
    loading:     boolean
    refetch:     () => Promise<void>
    decrement:   () => void
  }
  
  // Safe defaults — null limit means "not loaded yet"
  const DEFAULT_INFO: UsageInfo = {
    used:      0,
    limit:     0,      // 0 means not loaded — never shown to user
    remaining: 0,
    plan_type: 'Free'
  }
  
  const UsageContext = createContext<UsageContextType>({
    ...DEFAULT_INFO,
    isExhausted: false,
    loading:     true,
    refetch:     async () => {},
    decrement:   () => {},
  })
  
  export function UsageProvider({ children }: { children: ReactNode }) {
    const [info,    setInfo]    = useState<UsageInfo>(DEFAULT_INFO)
    const [loading, setLoading] = useState(true)
  
    const refetch = useCallback(async () => {
      try {
        const data = await getUsage()  // returns real rpd from app_users
        setInfo(data)
      } catch (e) {
        console.error('UsageContext refetch error:', e)
      } finally {
        setLoading(false)
      }
    }, [])
  
    useEffect(() => { refetch() }, [refetch])
  
    const decrement = useCallback(() => {
      setInfo(prev => ({
        ...prev,
        used:      prev.used + 1,
        remaining: Math.max(0, prev.remaining - 1)
      }))
    }, [])
  
    return (
      <UsageContext.Provider value={{
        ...info,
        isExhausted: !loading && info.remaining <= 0,
        loading,
        refetch,
        decrement,
      }}>
        {children}
      </UsageContext.Provider>
    )
  }
  
  export function useUsage() {
    return useContext(UsageContext)
  }