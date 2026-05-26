import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary    from './components/ErrorBoundary'
import AuthGuard        from './components/AuthGuard'
import Layout           from './components/Layout'
import AdPoster         from './pages/AdPoster'
import Reels            from './pages/Reels'
import Stories          from './pages/Stories'
import History          from './pages/History'
import MarketAnalysis   from './pages/MarketAnalysis'
import { UsageProvider }    from './context/UsageContext'
import { ResultsProvider }  from './context/ResultsContext'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <UsageProvider>
          <ResultsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/poster" replace />} />
                  <Route path="poster"  element={<AdPoster />} />
                  <Route path="reels"   element={<Reels />} />
                  <Route path="stories" element={<Stories />} />
                  <Route path="market"  element={<MarketAnalysis />} />
                  <Route path="history" element={<History />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ResultsProvider>
        </UsageProvider>
      </AuthGuard>
    </ErrorBoundary>
  )
}