// src/context/ResultsContext.tsx
import type { ReactNode } from 'react';

import {
    createContext, useContext, useState,
    useCallback
  } from 'react'
  
  type PosterResult = {
    headline:  string
    tagline:   string
    cta:       string
    imageData: string
    isSvg:     boolean
  } | null
  
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
  
  type StorySlide = {
    slide:    number
    headline: string
    subtext:  string
    cta:      string
    bg_prompt: string
    imageUrl?: string
  }
  
  type ResultsContextType = {
    poster:     PosterResult
    setPoster:  (v: PosterResult) => void
    scenes:     ReelScene[]
    setScenes:  React.Dispatch<React.SetStateAction<ReelScene[]>> 
    slides:     StorySlide[]
    setSlides:  React.Dispatch<React.SetStateAction<StorySlide[]>>
    clearAll:   () => void
  }
  
  const ResultsContext = createContext<ResultsContextType>({
    poster:    null,
    setPoster: () => {},
    scenes:    [],
    setScenes: () => {},
    slides:    [],
    setSlides: () => {},
    clearAll:  () => {},
  })
  
  export function ResultsProvider({ children }: { children: ReactNode }) {
    const [poster, setPoster] = useState<PosterResult>(null)
    const [scenes, setScenes] = useState<ReelScene[]>([])
    const [slides, setSlides] = useState<StorySlide[]>([])
  
    const clearAll = useCallback(() => {
      setPoster(null)
      setScenes([])
      setSlides([])
    }, [])
  
    return (
      <ResultsContext.Provider value={{
        poster, setPoster,
        scenes, setScenes,
        slides, setSlides,
        clearAll,
      }}>
        {children}
      </ResultsContext.Provider>
    )
  }
  
  export function useResults() {
    return useContext(ResultsContext)
  }