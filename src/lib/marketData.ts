import { supabase } from './supabase'

export type Candle = {
  time:   number   // Unix ms
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export type MarketMeta = {
  symbol:      string
  currency:    string
  companyName: string
  exchange:    string
}

export type SRLevel = {
  price:    number
  type:     'support' | 'resistance'
  strength: number   // 1-5 — how many times price bounced here
  touches:  number
}

export type MarketDataResult = {
  symbol:      string
  granularity: string
  candles:     Candle[]
  meta:        MarketMeta
}

// ── Fetch OHLCV from Edge Function ───────────────────────────────
export async function fetchMarketData(
  ticker:      string,
  startDate:   string,
  endDate:     string,
  granularity: string
): Promise<MarketDataResult> {
  const { data, error } = await supabase.functions.invoke<{
    result?: MarketDataResult
    error?:  string
  }>('market-data', {
    body: { ticker, startDate, endDate, granularity }
  })

  if (error)        throw new Error(error.message)
  if (!data)        throw new Error('No response from market-data function')
  if (data.error)   throw new Error(data.error)
  return data.result!
}

// ── S&R calculation — pure JS, no Python needed ──────────────────
export function calculateSRLevels(
  candles:     Candle[],
  granularity: string
): SRLevel[] {
  if (candles.length < 10) return []

  // Lookback window depends on granularity
  const lookback = (
    granularity.includes('min') ? 5 :
    granularity === '1hr'       ? 5 :
    granularity === '1day'      ? 5 :
    3
  )

  const pivotHighs: number[] = []
  const pivotLows:  number[] = []

  // Step 1: Find pivot highs and lows
  for (let i = lookback; i < candles.length - lookback; i++) {
    const slice = candles.slice(i - lookback, i + lookback + 1)
    const high  = candles[i].high
    const low   = candles[i].low

    const isHigh = slice.every(c => c.high <= high)
    const isLow  = slice.every(c => c.low  >= low)

    if (isHigh) pivotHighs.push(high)
    if (isLow)  pivotLows.push(low)
  }

  // Step 2: Cluster nearby pivots (within 0.5% of each other)
  const clusterLevels = (prices: number[], type: 'support' | 'resistance') => {
    if (!prices.length) return []
    const sorted  = [...prices].sort((a, b) => a - b)
    const clusters: number[][] = [[sorted[0]]]

    for (let i = 1; i < sorted.length; i++) {
      const last    = clusters[clusters.length - 1]
      const avg     = last.reduce((s, v) => s + v, 0) / last.length
      const pctDiff = Math.abs(sorted[i] - avg) / avg

      if (pctDiff < 0.005) {
        last.push(sorted[i])
      } else {
        clusters.push([sorted[i]])
      }
    }

    // Each cluster → one S&R level
    return clusters.map(cluster => {
      const price   = cluster.reduce((s, v) => s + v, 0) / cluster.length
      const touches = cluster.length
      const strength = Math.min(5, Math.ceil(touches / 2))
      return { price: parseFloat(price.toFixed(2)), type, strength, touches }
    })
  }

  const resistanceLevels = clusterLevels(pivotHighs, 'resistance')
  const supportLevels    = clusterLevels(pivotLows,  'support')

  // Step 3: Sort by strength descending, return top 10 of each
  const topResistance = resistanceLevels
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8)

  const topSupport = supportLevels
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8)

  return [...topResistance, ...topSupport]
    .sort((a, b) => b.price - a.price)
}

// ── Indian market ticker suggestions ─────────────────────────────
export const INDIAN_TICKERS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries',      exchange: 'NSE' },
  { symbol: 'TCS',      name: 'Tata Consultancy Services', exchange: 'NSE' },
  { symbol: 'INFY',     name: 'Infosys',                  exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank',                exchange: 'NSE' },
  { symbol: 'ICICIBANK',name: 'ICICI Bank',               exchange: 'NSE' },
  { symbol: 'HINDUNILVR',name:'Hindustan Unilever',       exchange: 'NSE' },
  { symbol: 'SBIN',     name: 'State Bank of India',      exchange: 'NSE' },
  { symbol: 'BAJFINANCE',name:'Bajaj Finance',            exchange: 'NSE' },
  { symbol: 'BHARTIARTL',name:'Bharti Airtel',            exchange: 'NSE' },
  { symbol: 'KOTAKBANK',name: 'Kotak Mahindra Bank',      exchange: 'NSE' },
  { symbol: 'LT',       name: 'Larsen & Toubro',          exchange: 'NSE' },
  { symbol: 'WIPRO',    name: 'Wipro',                    exchange: 'NSE' },
  { symbol: 'HCLTECH',  name: 'HCL Technologies',         exchange: 'NSE' },
  { symbol: 'ASIANPAINT',name:'Asian Paints',             exchange: 'NSE' },
  { symbol: 'MARUTI',   name: 'Maruti Suzuki',            exchange: 'NSE' },
  { symbol: 'TITAN',    name: 'Titan Company',            exchange: 'NSE' },
  { symbol: 'SUNPHARMA',name: 'Sun Pharmaceutical',       exchange: 'NSE' },
  { symbol: 'ULTRACEMCO',name:'UltraTech Cement',         exchange: 'NSE' },
  { symbol: 'NTPC',     name: 'NTPC',                     exchange: 'NSE' },
  { symbol: 'POWERGRID',name: 'Power Grid Corporation',   exchange: 'NSE' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises',        exchange: 'NSE' },
  { symbol: 'ADANIPORTS',name:'Adani Ports',              exchange: 'NSE' },
  { symbol: 'TECHM',    name: 'Tech Mahindra',            exchange: 'NSE' },
  { symbol: 'NESTLEIND',name: 'Nestle India',             exchange: 'NSE' },
  { symbol: 'DIVISLAB', name: "Divi's Laboratories",      exchange: 'NSE' },
  { symbol: 'DRREDDY',  name: "Dr. Reddy's Laboratories", exchange: 'NSE' },
  { symbol: 'CIPLA',    name: 'Cipla',                    exchange: 'NSE' },
  { symbol: 'EICHERMOT',name: 'Eicher Motors',            exchange: 'NSE' },
  { symbol: 'BAJAJ-AUTO',name:'Bajaj Auto',               exchange: 'NSE' },
  { symbol: 'HEROMOTOCO',name:'Hero MotoCorp',            exchange: 'NSE' },
  { symbol: 'TATAMOTORS',name:'Tata Motors',              exchange: 'NSE' },
  { symbol: 'TATAPOWER',name: 'Tata Power',               exchange: 'NSE' },
  { symbol: 'TATASTEEL',name: 'Tata Steel',               exchange: 'NSE' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel',                exchange: 'NSE' },
  { symbol: 'COALINDIA',name: 'Coal India',               exchange: 'NSE' },
  { symbol: 'ONGC',     name: 'ONGC',                     exchange: 'NSE' },
  { symbol: 'IOC',      name: 'Indian Oil Corporation',   exchange: 'NSE' },
  { symbol: 'BPCL',     name: 'BPCL',                     exchange: 'NSE' },
  { symbol: 'GRASIM',   name: 'Grasim Industries',        exchange: 'NSE' },
  { symbol: 'INDUSINDBK',name:'IndusInd Bank',            exchange: 'NSE' },
  { symbol: 'AXISBANK', name: 'Axis Bank',                exchange: 'NSE' },
  { symbol: 'BAJAJFINSV',name:'Bajaj Finserv',            exchange: 'NSE' },
  { symbol: 'BRITANNIA',name: 'Britannia Industries',     exchange: 'NSE' },
  { symbol: 'APOLLOHOSP',name:'Apollo Hospitals',         exchange: 'NSE' },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance',      exchange: 'NSE' },
  { symbol: 'SBILIFE',  name: 'SBI Life Insurance',       exchange: 'NSE' },
  { symbol: 'NIFTY50',  name: 'Nifty 50 Index',           exchange: 'INDEX' },
  { symbol: 'BANKNIFTY',name: 'Bank Nifty Index',         exchange: 'INDEX' },
]

export function searchTickers(query: string) {
  if (!query || query.length < 1) return []
  const q = query.toUpperCase()
  return INDIAN_TICKERS.filter(t =>
    t.symbol.startsWith(q) ||
    t.name.toUpperCase().includes(q)
  ).slice(0, 8)
}