// Realistic demo/fallback data used when APIs are unreachable

export interface BorosMarket {
  id: string;
  name: string;
  symbol: string;
  underlying: string;
  impliedApr: number;
  markApr: number;
  underlyingApr: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  volume24h: number;
  openInterest: number;
  isWhitelisted: boolean;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface RecentTrade {
  time: string;
  side: "buy" | "sell";
  size: number;
  price: number;
}

export interface FundingRate {
  exchange: string;
  symbol: string;
  currentRate: number;
  annualizedRate: number;
  avg7d: number;
  nextFundingTime?: string;
}

export interface YieldPool {
  protocol: string;
  product: string;
  asset: string;
  apy: number;
  type: "Fixed" | "Variable";
  maturity?: string;
  riskLevel: "Low" | "Medium" | "High";
  sourceUrl: string;
  tvl: number;
}

export interface ChartDataPoint {
  time: string;
  timestamp: number;
  impliedApr: number;
  underlyingApr: number;
}

// Demo Boros markets
export const DEMO_MARKETS: BorosMarket[] = [
  {
    id: "1",
    name: "BTC Funding Rate",
    symbol: "BTC-FR",
    underlying: "BTC",
    impliedApr: 12.45,
    markApr: 11.82,
    underlyingApr: 10.24,
    bestBid: 11.50,
    bestAsk: 12.10,
    spread: 0.60,
    volume24h: 4523000,
    openInterest: 12400000,
    isWhitelisted: true,
  },
  {
    id: "2",
    name: "ETH Funding Rate",
    symbol: "ETH-FR",
    underlying: "ETH",
    impliedApr: 8.72,
    markApr: 8.15,
    underlyingApr: 7.65,
    bestBid: 8.20,
    bestAsk: 8.55,
    spread: 0.35,
    volume24h: 3180000,
    openInterest: 8700000,
    isWhitelisted: true,
  },
  {
    id: "3",
    name: "SOL Funding Rate",
    symbol: "SOL-FR",
    underlying: "SOL",
    impliedApr: 15.30,
    markApr: 14.85,
    underlyingApr: 13.10,
    bestBid: 14.70,
    bestAsk: 15.20,
    spread: 0.50,
    volume24h: 1890000,
    openInterest: 5200000,
    isWhitelisted: true,
  },
  {
    id: "4",
    name: "ARB Funding Rate",
    symbol: "ARB-FR",
    underlying: "ARB",
    impliedApr: 18.50,
    markApr: 17.90,
    underlyingApr: 16.20,
    bestBid: 17.80,
    bestAsk: 18.40,
    spread: 0.60,
    volume24h: 920000,
    openInterest: 2800000,
    isWhitelisted: true,
  },
  {
    id: "5",
    name: "DOGE Funding Rate",
    symbol: "DOGE-FR",
    underlying: "DOGE",
    impliedApr: 22.10,
    markApr: 21.40,
    underlyingApr: 19.80,
    bestBid: 21.20,
    bestAsk: 22.00,
    spread: 0.80,
    volume24h: 750000,
    openInterest: 1900000,
    isWhitelisted: true,
  },
];

// Generate chart data
export function generateChartData(hours: number): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  const now = Date.now();
  const interval = (hours * 3600000) / 60;
  const baseImplied = 12.0;
  const baseUnderlying = 10.0;

  for (let i = 60; i >= 0; i--) {
    const timestamp = now - i * interval;
    const noise1 = Math.sin(i * 0.3) * 2 + Math.random() * 1.5 - 0.75;
    const noise2 = Math.cos(i * 0.25) * 1.8 + Math.random() * 1.2 - 0.6;
    points.push({
      time: new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp,
      impliedApr: +(baseImplied + noise1).toFixed(2),
      underlyingApr: +(baseUnderlying + noise2).toFixed(2),
    });
  }
  return points;
}

// Demo order book
export function generateOrderBook(): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
  const midPrice = 12.00;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  let bidTotal = 0;
  let askTotal = 0;

  for (let i = 0; i < 10; i++) {
    const bidSize = +(Math.random() * 50000 + 10000).toFixed(0);
    bidTotal += bidSize;
    bids.push({
      price: +(midPrice - (i + 1) * 0.05).toFixed(4),
      size: bidSize,
      total: bidTotal,
    });
  }

  for (let i = 0; i < 10; i++) {
    const askSize = +(Math.random() * 50000 + 10000).toFixed(0);
    askTotal += askSize;
    asks.push({
      price: +(midPrice + (i + 1) * 0.05).toFixed(4),
      size: askSize,
      total: askTotal,
    });
  }

  return { bids, asks: asks.reverse() };
}

// Demo recent trades
export function generateRecentTrades(): RecentTrade[] {
  const trades: RecentTrade[] = [];
  const now = Date.now();
  for (let i = 0; i < 15; i++) {
    trades.push({
      time: new Date(now - i * 30000).toLocaleTimeString(),
      side: Math.random() > 0.45 ? "buy" : "sell",
      size: +(Math.random() * 20000 + 1000).toFixed(2),
      price: +(12.0 + (Math.random() - 0.5) * 0.4).toFixed(4),
    });
  }
  return trades;
}

// Demo CEX funding rates
export const DEMO_FUNDING_RATES: FundingRate[] = [
  { exchange: "Binance", symbol: "BTC", currentRate: 0.0085, annualizedRate: 9.31, avg7d: 8.76 },
  { exchange: "Binance", symbol: "ETH", currentRate: 0.0062, annualizedRate: 6.79, avg7d: 6.12 },
  { exchange: "Binance", symbol: "SOL", currentRate: 0.0124, annualizedRate: 13.58, avg7d: 12.40 },
  { exchange: "Bybit", symbol: "BTC", currentRate: 0.0091, annualizedRate: 9.97, avg7d: 9.15 },
  { exchange: "Bybit", symbol: "ETH", currentRate: 0.0058, annualizedRate: 6.35, avg7d: 5.90 },
  { exchange: "Bybit", symbol: "SOL", currentRate: 0.0130, annualizedRate: 14.24, avg7d: 13.10 },
  { exchange: "Hyperliquid", symbol: "BTC", currentRate: 0.0078, annualizedRate: 8.54, avg7d: 8.20 },
  { exchange: "Hyperliquid", symbol: "ETH", currentRate: 0.0055, annualizedRate: 6.02, avg7d: 5.65 },
  { exchange: "Hyperliquid", symbol: "SOL", currentRate: 0.0118, annualizedRate: 12.93, avg7d: 11.80 },
];

// Demo Boros implied rates (for arbitrage comparison)
export const DEMO_BOROS_RATES: Record<string, number> = {
  BTC: 12.45,
  ETH: 8.72,
  SOL: 15.30,
};

// Demo yield pools
export const DEMO_YIELD_POOLS: YieldPool[] = [
  { protocol: "Boros", product: "BTC Fixed Rate", asset: "BTC", apy: 12.45, type: "Fixed", maturity: "Mar 27, 2026", riskLevel: "Medium", sourceUrl: "https://boros.pendle.finance", tvl: 45000000 },
  { protocol: "Boros", product: "ETH Fixed Rate", asset: "ETH", apy: 8.72, type: "Fixed", maturity: "Mar 27, 2026", riskLevel: "Medium", sourceUrl: "https://boros.pendle.finance", tvl: 32000000 },
  { protocol: "Aave V3", product: "ETH Lending", asset: "ETH", apy: 3.24, type: "Variable", riskLevel: "Low", sourceUrl: "https://app.aave.com", tvl: 8200000000 },
  { protocol: "Aave V3", product: "USDC Lending", asset: "USDC", apy: 5.12, type: "Variable", riskLevel: "Low", sourceUrl: "https://app.aave.com", tvl: 5100000000 },
  { protocol: "Aave V3", product: "USDT Lending", asset: "USDT", apy: 4.89, type: "Variable", riskLevel: "Low", sourceUrl: "https://app.aave.com", tvl: 3200000000 },
  { protocol: "Compound V3", product: "ETH Lending", asset: "ETH", apy: 2.95, type: "Variable", riskLevel: "Low", sourceUrl: "https://app.compound.finance", tvl: 2800000000 },
  { protocol: "Compound V3", product: "USDC Lending", asset: "USDC", apy: 4.78, type: "Variable", riskLevel: "Low", sourceUrl: "https://app.compound.finance", tvl: 1900000000 },
  { protocol: "Lido", product: "stETH Staking", asset: "ETH", apy: 3.45, type: "Variable", riskLevel: "Low", sourceUrl: "https://lido.fi", tvl: 14000000000 },
  { protocol: "Pendle V2", product: "PT-stETH", asset: "ETH", apy: 4.18, type: "Fixed", maturity: "Jun 26, 2026", riskLevel: "Low", sourceUrl: "https://app.pendle.finance", tvl: 890000000 },
  { protocol: "Pendle V2", product: "PT-eETH", asset: "ETH", apy: 5.92, type: "Fixed", maturity: "Jun 26, 2026", riskLevel: "Medium", sourceUrl: "https://app.pendle.finance", tvl: 620000000 },
  { protocol: "Boros", product: "SOL Fixed Rate", asset: "SOL", apy: 15.30, type: "Fixed", maturity: "Mar 27, 2026", riskLevel: "Medium", sourceUrl: "https://boros.pendle.finance", tvl: 18000000 },
  { protocol: "Boros", product: "USDT Fixed Rate", asset: "USDT", apy: 9.85, type: "Fixed", maturity: "Mar 27, 2026", riskLevel: "Medium", sourceUrl: "https://boros.pendle.finance", tvl: 22000000 },
];

// Heatmap data
export interface HeatmapCell {
  asset: string;
  exchange: string;
  rate: number;
}

export const DEMO_HEATMAP_DATA: HeatmapCell[] = [
  // BTC
  { asset: "BTC", exchange: "Binance", rate: 9.31 },
  { asset: "BTC", exchange: "Bybit", rate: 9.97 },
  { asset: "BTC", exchange: "Hyperliquid", rate: 8.54 },
  { asset: "BTC", exchange: "Boros Implied", rate: 12.45 },
  // ETH
  { asset: "ETH", exchange: "Binance", rate: 6.79 },
  { asset: "ETH", exchange: "Bybit", rate: 6.35 },
  { asset: "ETH", exchange: "Hyperliquid", rate: 6.02 },
  { asset: "ETH", exchange: "Boros Implied", rate: 8.72 },
  // SOL
  { asset: "SOL", exchange: "Binance", rate: 13.58 },
  { asset: "SOL", exchange: "Bybit", rate: 14.24 },
  { asset: "SOL", exchange: "Hyperliquid", rate: 12.93 },
  { asset: "SOL", exchange: "Boros Implied", rate: 15.30 },
  // ARB
  { asset: "ARB", exchange: "Binance", rate: 5.20 },
  { asset: "ARB", exchange: "Bybit", rate: 4.85 },
  { asset: "ARB", exchange: "Hyperliquid", rate: 6.10 },
  { asset: "ARB", exchange: "Boros Implied", rate: 18.50 },
  // DOGE
  { asset: "DOGE", exchange: "Binance", rate: 17.30 },
  { asset: "DOGE", exchange: "Bybit", rate: 16.80 },
  { asset: "DOGE", exchange: "Hyperliquid", rate: 15.90 },
  { asset: "DOGE", exchange: "Boros Implied", rate: 22.10 },
  // AVAX
  { asset: "AVAX", exchange: "Binance", rate: 7.45 },
  { asset: "AVAX", exchange: "Bybit", rate: 7.10 },
  { asset: "AVAX", exchange: "Hyperliquid", rate: 6.80 },
  { asset: "AVAX", exchange: "Boros Implied", rate: 10.20 },
];
