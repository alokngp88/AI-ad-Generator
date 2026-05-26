import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, TrendingUp, TrendingDown,
         Calendar, BarChart2, X, ChevronDown } from 'lucide-react'
import {
  fetchMarketData, calculateSRLevels,
  searchTickers,  type Candle,
  type SRLevel,   type MarketMeta
} from '../lib/marketData'
import { getFriendlyMessage, type AppErrorCode } from '../lib/errors'
import ErrorMessage from '../components/ErrorMessage'

const GRANULARITIES = [
  { value: '5min',  label: '5 Min'  },
  { value: '15min', label: '15 Min' },
  { value: '30min', label: '30 Min' },
  { value: '1hr',   label: '1 Hour' },
  { value: '1day',  label: '1 Day'  },
  { value: '1mon',  label: '1 Month'},
  { value: '3mon',  label: '3 Month'},
  { value: '6mon',  label: '6 Month'},
  { value: '1yr',   label: '1 Year' },
]

// Granularity → sensible default date range
function defaultDateRange(gran: string): { start: string; end: string } {
  const end   = new Date()
  const start = new Date()
  if      (gran === '5min' || gran === '15min') start.setDate(end.getDate() - 5)
  else if (gran === '30min' || gran === '1hr')  start.setDate(end.getDate() - 30)
  else if (gran === '1day')                     start.setFullYear(end.getFullYear() - 1)
  else if (gran === '1mon' || gran === '3mon')  start.setFullYear(end.getFullYear() - 3)
  else                                          start.setFullYear(end.getFullYear() - 5)
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function strengthDots(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i}
      className={`inline-block w-2 h-2 rounded-full mx-0.5
        ${i < n ? 'bg-current' : 'bg-gray-200'}`}
    />
  ))
}

// ── Lightweight chart component ──────────────────────────────────
function CandleChart({
  candles,
  srLevels,
}: {
  candles:  Candle[]
  srLevels: SRLevel[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !candles.length) return

    let cleanup: (() => void) | undefined

    import('lightweight-charts').then((lc) => {
      if (!containerRef.current) return

      const chart = lc.createChart(containerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: '#ffffff' },
          textColor:  '#374151',
        },
        grid: {
          vertLines: { color: '#f3f4f6' },
          horzLines: { color: '#f3f4f6' },
        },
        crosshair:       { mode: 1 },
        rightPriceScale: { borderColor: '#e5e7eb' },
        timeScale:       { borderColor: '#e5e7eb', timeVisible: true },
        width:  containerRef.current.clientWidth,
        height: 380,
      })

      // ── v5 API: addSeries with CandlestickSeries type ────────────
      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor:         '#16a34a',
        downColor:       '#dc2626',
        borderUpColor:   '#16a34a',
        borderDownColor: '#dc2626',
        wickUpColor:     '#16a34a',
        wickDownColor:   '#dc2626',
      })

      const chartData = candles.map(c => ({
        time:  (Math.floor(c.time / 1000)) as unknown as lc.Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))

      candleSeries.setData(chartData)

      // ── v5 API: addSeries with LineSeries type ───────────────────
      srLevels.forEach(level => {
        if (chartData.length < 2) return

        const lineSeries = chart.addSeries(lc.LineSeries, {
          color:            level.type === 'resistance' ? '#dc2626' : '#16a34a',
          lineWidth:        level.strength >= 3 ? 2 : 1,
          lineStyle:        level.strength >= 4 ? 0 : 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: `${level.type === 'resistance' ? 'R' : 'S'} ${fmt(level.price)}`,
        })

        lineSeries.setData([
          { time: chartData[0].time,                     value: level.price },
          { time: chartData[chartData.length - 1].time,  value: level.price },
        ])
      })

      chart.timeScale().fitContent()

      const observer = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      })
      observer.observe(containerRef.current)

      cleanup = () => {
        observer.disconnect()
        chart.remove()
      }
    })

    return () => { cleanup?.() }
  }, [candles, srLevels])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-gray-200"
    />
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function MarketAnalysis() {
  const [ticker,      setTicker]      = useState('')
  const [suggestions, setSuggestions] = useState<typeof import('../lib/marketData').INDIAN_TICKERS>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [selectedMeta, setSelectedMeta] = useState<{ symbol: string; name: string } | null>(null)

  const [granularity, setGranularity] = useState('1day')
  const [startDate,   setStartDate]   = useState(defaultDateRange('1day').start)
  const [endDate,     setEndDate]     = useState(defaultDateRange('1day').end)

  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [errorCode, setErrorCode] = useState<AppErrorCode>('UNKNOWN')

  const [candles,  setCandles]  = useState<Candle[]>([])
  const [srLevels, setSrLevels] = useState<SRLevel[]>([])
  const [meta,     setMeta]     = useState<MarketMeta | null>(null)

  const suggestRef = useRef<HTMLDivElement>(null)

  // Close suggestion dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggest(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleTickerInput(val: string) {
    setTicker(val)
    setSelectedMeta(null)
    if (val.length >= 1) {
      setSuggestions(searchTickers(val))
      setShowSuggest(true)
    } else {
      setSuggestions([])
      setShowSuggest(false)
    }
  }

  function selectTicker(symbol: string, name: string) {
    setTicker(symbol)
    setSelectedMeta({ symbol, name })
    setSuggestions([])
    setShowSuggest(false)
  }

  function handleGranularityChange(gran: string) {
    setGranularity(gran)
    const range = defaultDateRange(gran)
    setStartDate(range.start)
    setEndDate(range.end)
  }

  const handleFetch = useCallback(async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    setCandles([])
    setSrLevels([])
    try {
      const result = await fetchMarketData(
        ticker.trim(), startDate, endDate, granularity
      )
      setCandles(result.candles)
      setMeta(result.meta)
      const levels = calculateSRLevels(result.candles, granularity)
      setSrLevels(levels)
    } catch (e: unknown) {
      const { message, code } = getFriendlyMessage(e)
      setError(message)
      setErrorCode(code)
    } finally {
      setLoading(false)
    }
  }, [ticker, startDate, endDate, granularity])

  const lastPrice  = candles.length ? candles[candles.length - 1].close : null
  const firstPrice = candles.length ? candles[0].close : null
  const priceChg   = lastPrice && firstPrice
    ? ((lastPrice - firstPrice) / firstPrice * 100)
    : null

  const resistances = srLevels.filter(l => l.type === 'resistance')
                               .sort((a, b) => a.price - b.price)
  const supports    = srLevels.filter(l => l.type === 'support')
                               .sort((a, b) => b.price - a.price)

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Market Analysis
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Support & resistance levels for Indian market stocks
        </p>
      </div>

      {/* ── Input card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">

        {/* Ticker search */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">
            Stock / Index
          </label>
          <div className="relative" ref={suggestRef}>
            <div className="relative">
              <Search size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2
                           text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={ticker}
                onChange={e => handleTickerInput(e.target.value)}
                onFocus={() => ticker.length >= 1 && setShowSuggest(true)}
                placeholder="Type ticker e.g. RELIANCE, TCS..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200
                           rounded-xl text-sm focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              />
              {ticker && (
                <button
                  onClick={() => { setTicker(''); setSelectedMeta(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50
                              bg-white border border-gray-200 rounded-xl
                              shadow-lg overflow-hidden">
                {suggestions.map(s => (
                  <button
                    key={s.symbol}
                    onClick={() => selectTicker(s.symbol, s.name)}
                    className="w-full flex items-center gap-3 px-4 py-2.5
                               hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {s.symbol}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {s.name}
                      </p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600
                                     px-2 py-0.5 rounded-full flex-shrink-0">
                      {s.exchange}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedMeta && (
            <p className="text-xs text-blue-600 mt-1">
              {selectedMeta.name} — will fetch as {selectedMeta.symbol}.NS
            </p>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              <Calendar size={11} className="inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200
                         rounded-xl text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              <Calendar size={11} className="inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200
                         rounded-xl text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Granularity */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">
            <BarChart2 size={11} className="inline mr-1" />
            Granularity
          </label>
          <div className="relative">
            <select
              value={granularity}
              onChange={e => handleGranularityChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200
                         rounded-xl text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-500
                         appearance-none bg-white"
            >
              {GRANULARITIES.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <ChevronDown size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Fetch button */}
        <button
          onClick={handleFetch}
          disabled={loading || !ticker.trim()}
          className="w-full flex items-center justify-center gap-2
                     bg-blue-600 text-white py-2.5 rounded-xl text-sm
                     font-medium disabled:opacity-40
                     disabled:cursor-not-allowed hover:bg-blue-700
                     transition-colors"
        >
          {loading
            ? <>
                <span className="w-4 h-4 border-2 border-white
                                 border-t-transparent rounded-full
                                 animate-spin block" />
                Fetching data...
              </>
            : <>
                <TrendingUp size={16} />
                Analyse {ticker.trim() || 'ticker'}
              </>
          }
        </button>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          code={errorCode}
          onRetry={() => { setError(''); handleFetch() }}
        />
      )}

      {/* ── Results ── */}
      {candles.length > 0 && meta && (
        <>
          {/* Summary bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {meta.companyName}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {meta.symbol} · {meta.exchange} · {meta.currency}
                </p>
              </div>
              <div className="text-right">
                {lastPrice && (
                  <p className="text-lg font-bold text-gray-900">
                    ₹{fmt(lastPrice)}
                  </p>
                )}
                {priceChg !== null && (
                  <p className={`text-xs font-medium flex items-center
                                 justify-end gap-1
                                 ${priceChg >= 0
                                   ? 'text-green-600'
                                   : 'text-red-600'}`}>
                    {priceChg >= 0
                      ? <TrendingUp size={12} />
                      : <TrendingDown size={12} />
                    }
                    {priceChg >= 0 ? '+' : ''}{priceChg.toFixed(2)}%
                    &nbsp;period
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {candles.length} candles · {granularity} granularity ·
              {startDate} to {endDate}
            </p>
          </div>

          {/* Candlestick chart with S&R lines */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Price Chart with S&R Levels
            </h4>
            <CandleChart candles={candles} srLevels={srLevels} />
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-red-500 inline-block" />
                Resistance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-green-600 inline-block" />
                Support
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-red-300 inline-block
                                 border-dashed border-t" />
                Weak level
              </span>
            </div>
          </div>

          {/* S&R level tables */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Resistance */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-red-700 mb-3 flex
                             items-center gap-2">
                <TrendingUp size={15} />
                Resistance Levels
              </h4>
              {resistances.length === 0
                ? <p className="text-xs text-gray-400">No levels found</p>
                : (
                <div className="space-y-2">
                  {resistances.map((r, i) => (
                    <div key={i}
                      className="flex items-center justify-between
                                 py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{fmt(r.price)}
                        </span>
                        {lastPrice && (
                          <span className="text-xs text-red-500 ml-2">
                            +{((r.price - lastPrice) / lastPrice * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-red-400">
                        {strengthDots(r.strength)}
                        <span className="text-xs text-gray-400 ml-1">
                          {r.touches}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Support */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-green-700 mb-3 flex
                             items-center gap-2">
                <TrendingDown size={15} />
                Support Levels
              </h4>
              {supports.length === 0
                ? <p className="text-xs text-gray-400">No levels found</p>
                : (
                <div className="space-y-2">
                  {supports.map((s, i) => (
                    <div key={i}
                      className="flex items-center justify-between
                                 py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{fmt(s.price)}
                        </span>
                        {lastPrice && (
                          <span className="text-xs text-green-600 ml-2">
                            {((s.price - lastPrice) / lastPrice * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-green-500">
                        {strengthDots(s.strength)}
                        <span className="text-xs text-gray-400 ml-1">
                          {s.touches}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}