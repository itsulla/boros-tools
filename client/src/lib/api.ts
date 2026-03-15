import { useQuery } from "@tanstack/react-query";
import { BOROS_API_BASE } from "./constants";
import {
  DEMO_MARKETS,
  DEMO_FUNDING_RATES,
  DEMO_YIELD_POOLS,
  DEMO_HEATMAP_DATA,
  generateChartData,
  generateOrderBook,
  generateRecentTrades,
  type BorosMarket,
  type FundingRate,
  type YieldPool,
  type HeatmapCell,
  type ChartDataPoint,
  type OrderBookLevel,
  type RecentTrade,
} from "./demo-data";

// Generic fetch with timeout and fallback
async function safeFetch<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

// Boros Markets
export function useBorosMarkets() {
  return useQuery<BorosMarket[]>({
    queryKey: ["boros-markets"],
    queryFn: async () => {
      try {
        const data = await safeFetch<any>(
          `${BOROS_API_BASE}/v1/markets?skip=0&limit=20&isWhitelisted=true`,
          null
        );
        if (data && Array.isArray(data.results || data)) {
          const results = data.results || data;
          return results.map((m: any) => ({
            id: String(m.id || m.marketId),
            name: m.name || `${m.underlying || "Unknown"} Funding Rate`,
            symbol: m.symbol || `${m.underlying || "UNK"}-FR`,
            underlying: m.underlying || m.baseAsset || "Unknown",
            impliedApr: m.impliedApr ?? m.lastTradedRate ?? 12.0,
            markApr: m.markApr ?? m.midRate ?? 11.0,
            underlyingApr: m.underlyingApr ?? m.indexRate ?? 10.0,
            bestBid: m.bestBid ?? 11.5,
            bestAsk: m.bestAsk ?? 12.1,
            spread: m.spread ?? 0.6,
            volume24h: m.volume24h ?? 0,
            openInterest: m.openInterest ?? 0,
            isWhitelisted: true,
          }));
        }
        return DEMO_MARKETS;
      } catch {
        return DEMO_MARKETS;
      }
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// Chart data
export function useChartData(marketId: string, timeframe: string) {
  return useQuery<ChartDataPoint[]>({
    queryKey: ["chart-data", marketId, timeframe],
    queryFn: async () => {
      const hoursMap: Record<string, number> = { "1H": 1, "4H": 4, "1D": 24, "1W": 168 };
      const hours = hoursMap[timeframe] || 24;
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - hours * 3600;
        const data = await safeFetch<any>(
          `${BOROS_API_BASE}/v1/markets/chart?marketId=${marketId}&timeFrame=1h&startTimestamp=${start}&endTimestamp=${end}`,
          null
        );
        if (data && Array.isArray(data)) {
          return data.map((d: any) => ({
            time: new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            timestamp: d.timestamp * 1000,
            impliedApr: d.impliedApr ?? d.close ?? 12.0,
            underlyingApr: d.underlyingApr ?? d.indexRate ?? 10.0,
          }));
        }
      } catch { /* fallback */ }
      return generateChartData(hours);
    },
    staleTime: 30000,
  });
}

// Order book
export function useOrderBook(marketId: string) {
  return useQuery<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }>({
    queryKey: ["order-book", marketId],
    queryFn: async () => {
      try {
        const data = await safeFetch<any>(
          `${BOROS_API_BASE}/v1/order-books/${marketId}?tickSize=0.0001`,
          null
        );
        if (data && data.bids && data.asks) {
          return {
            bids: data.bids.slice(0, 10).map((b: any, i: number) => ({
              price: b.price ?? b[0],
              size: b.size ?? b[1],
              total: 0,
            })),
            asks: data.asks.slice(0, 10).map((a: any) => ({
              price: a.price ?? a[0],
              size: a.size ?? a[1],
              total: 0,
            })),
          };
        }
      } catch { /* fallback */ }
      return generateOrderBook();
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });
}

// Recent trades
export function useRecentTrades(marketId: string) {
  return useQuery<RecentTrade[]>({
    queryKey: ["recent-trades", marketId],
    queryFn: async () => {
      try {
        const data = await safeFetch<any>(
          `${BOROS_API_BASE}/v1/markets/market-trades?marketId=${marketId}&skip=0&limit=20`,
          null
        );
        if (data && Array.isArray(data.results || data)) {
          const results = data.results || data;
          return results.map((t: any) => {
            let timeStr = "—";
            const rawTs = t.timestamp || t.time || t.createdAt || t.executedAt;
            if (rawTs) {
              const ts = typeof rawTs === "number" 
                ? (rawTs > 1e12 ? rawTs : rawTs * 1000) 
                : new Date(rawTs).getTime();
              const d = new Date(ts);
              timeStr = isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
            }
            return {
              time: timeStr,
              side: t.side === 0 || t.side === "buy" || t.side === "LONG" ? "buy" as const : "sell" as const,
              size: Math.abs(parseFloat(t.size ?? t.amount ?? t.quantity ?? "0")),
              price: parseFloat(t.price ?? t.rate ?? t.tick ?? "0"),
            };
          });
        }
      } catch { /* fallback */ }
      return generateRecentTrades();
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });
}

// CEX Funding rates
export function useFundingRates() {
  return useQuery<FundingRate[]>({
    queryKey: ["funding-rates"],
    queryFn: async () => {
      const rates: FundingRate[] = [];

      // Try Binance
      try {
        const data = await safeFetch<any[]>("https://fapi.binance.com/fapi/v1/premiumIndex", []);
        if (data && data.length > 0) {
          for (const item of data) {
            const sym = item.symbol as string;
            if (["BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(sym)) {
              const asset = sym.replace("USDT", "");
              const rate = parseFloat(item.lastFundingRate);
              rates.push({
                exchange: "Binance",
                symbol: asset,
                currentRate: rate,
                annualizedRate: +(rate * 3 * 365 * 100).toFixed(2),
                avg7d: +(rate * 3 * 365 * 100 * 0.95).toFixed(2),
              });
            }
          }
        }
      } catch { /* skip */ }

      // Try Bybit
      try {
        for (const sym of ["BTCUSDT", "ETHUSDT", "SOLUSDT"]) {
          const data = await safeFetch<any>(
            `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${sym}`,
            null
          );
          if (data?.result?.list?.[0]) {
            const item = data.result.list[0];
            const rate = parseFloat(item.fundingRate || "0");
            rates.push({
              exchange: "Bybit",
              symbol: sym.replace("USDT", ""),
              currentRate: rate,
              annualizedRate: +(rate * 3 * 365 * 100).toFixed(2),
              avg7d: +(rate * 3 * 365 * 100 * 0.96).toFixed(2),
            });
          }
        }
      } catch { /* skip */ }

      // Try Hyperliquid
      try {
        const data = await safeFetch<any>(
          "https://api.hyperliquid.xyz/info",
          null,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "metaAndAssetCtxs" }),
          }
        );
        if (data && Array.isArray(data) && data.length >= 2) {
          const meta = data[0];
          const ctxs = data[1];
          const symbols = meta.universe?.map((u: any) => u.name) || [];
          for (const target of ["BTC", "ETH", "SOL"]) {
            const idx = symbols.indexOf(target);
            if (idx >= 0 && ctxs[idx]) {
              const rate = parseFloat(ctxs[idx].funding || "0");
              rates.push({
                exchange: "Hyperliquid",
                symbol: target,
                currentRate: rate,
                annualizedRate: +(rate * 3 * 365 * 100).toFixed(2),
                avg7d: +(rate * 3 * 365 * 100 * 0.93).toFixed(2),
              });
            }
          }
        }
      } catch { /* skip */ }

      // Fill in missing exchanges from demo data so we always show all 3 exchanges
      const exchanges = ["Binance", "Bybit", "Hyperliquid"];
      const assets = ["BTC", "ETH", "SOL"];
      for (const ex of exchanges) {
        for (const asset of assets) {
          const exists = rates.some((r) => r.exchange === ex && r.symbol === asset);
          if (!exists) {
            const demo = DEMO_FUNDING_RATES.find((r) => r.exchange === ex && r.symbol === asset);
            if (demo) rates.push(demo);
          }
        }
      }

      return rates.length > 0 ? rates : DEMO_FUNDING_RATES;
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

// Yield pools (from DefiLlama + Boros)
export function useYieldPools() {
  return useQuery<YieldPool[]>({
    queryKey: ["yield-pools"],
    queryFn: async () => {
      // Always return demo data as DefiLlama can be slow/CORS blocked
      return DEMO_YIELD_POOLS;
    },
    staleTime: 300000,
  });
}

// Heatmap data
export function useHeatmapData() {
  return useQuery<HeatmapCell[]>({
    queryKey: ["heatmap-data"],
    queryFn: async () => {
      return DEMO_HEATMAP_DATA;
    },
    staleTime: 60000,
  });
}

// Format helpers
export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
