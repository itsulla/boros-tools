import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PageContainer, StickyCTA } from "@/components/Layout";
import {
  useBorosMarkets, useChartData, useOrderBook, useRecentTrades,
  formatPercent, formatNumber,
} from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const TIMEFRAMES = ["1H", "4H", "1D", "1W"];

export default function Terminal() {
  const { data: markets, isLoading: marketsLoading } = useBorosMarkets();
  const [selectedMarket, setSelectedMarket] = useState("1");
  const [timeframe, setTimeframe] = useState("1D");

  const market = markets?.find((m) => m.id === selectedMarket) ?? markets?.[0];
  const marketId = market?.id ?? "1";

  const { data: chartData } = useChartData(marketId, timeframe);
  const { data: orderBook } = useOrderBook(marketId);
  const { data: trades } = useRecentTrades(marketId);

  const kpis = market
    ? [
        { label: "Implied APR", value: formatPercent(market.impliedApr), color: "text-primary" },
        { label: "Mark APR", value: formatPercent(market.markApr), color: "text-foreground" },
        { label: "Underlying APR", value: formatPercent(market.underlyingApr), color: "text-secondary" },
        { label: "Best Bid", value: market.bestBid.toFixed(2) + "%", color: "text-primary" },
        { label: "Best Ask", value: market.bestAsk.toFixed(2) + "%", color: "text-destructive" },
        { label: "Spread", value: market.spread.toFixed(2) + "%", color: "text-chart-4" },
      ]
    : [];

  const maxBookVol = Math.max(
    ...(orderBook?.bids.map((b) => b.size) ?? [1]),
    ...(orderBook?.asks.map((a) => a.size) ?? [1])
  );

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">Funding Rate Terminal</h1>
          <p className="text-sm text-muted-foreground">Live rates, charts & order book depth</p>
        </div>
        {!marketsLoading && markets && (
          <Select value={selectedMarket} onValueChange={setSelectedMarket}>
            <SelectTrigger className="w-[200px] bg-card border-card-border" data-testid="select-market">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6" data-testid="terminal-kpis">
        {marketsLoading
          ? [...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-lg p-3">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div key={kpi.label} className="bg-card border border-card-border rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{kpi.label}</p>
                <p className={`text-base font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
      </div>

      {/* Chart + Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Rate Chart</h3>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    timeframe === tf
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  data-testid={`btn-tf-${tf}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[320px]">
            {chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1BE3C2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1BE3C2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,75,109,0.3)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#9DAFCD" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9DAFCD" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1C2B3D", border: "1px solid #2B3B55", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#BFCBDF" }}
                    formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === "impliedApr" ? "Implied APR" : "Underlying APR"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "#BFCBDF" }}
                    formatter={(val) => (val === "impliedApr" ? "Implied APR" : "Underlying APR")}
                  />
                  <Area type="monotone" dataKey="impliedApr" stroke="#1BE3C2" fill="url(#gradTeal)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="underlyingApr" stroke="#6079FF" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading chart...</div>
            )}
          </div>
        </div>

        {/* Order Book */}
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Order Book</h3>
          <div className="space-y-0.5 text-xs font-mono">
            {/* Asks (reversed - highest at top) */}
            {orderBook?.asks.map((ask, i) => (
              <div key={`ask-${i}`} className="relative flex items-center justify-between px-2 py-0.5 rounded-sm">
                <div
                  className="absolute inset-0 bg-destructive/10 rounded-sm"
                  style={{ width: `${(ask.size / maxBookVol) * 100}%`, marginLeft: "auto" }}
                />
                <span className="relative text-destructive tabular-nums">{ask.price.toFixed(4)}%</span>
                <span className="relative text-muted-foreground tabular-nums">{formatNumber(ask.size)}</span>
              </div>
            ))}
            {/* Mid price */}
            <div className="text-center py-1.5 text-chart-4 font-semibold text-sm border-y border-border/30">
              {market ? `${((market.bestBid + market.bestAsk) / 2).toFixed(4)}%` : "—"}
            </div>
            {/* Bids */}
            {orderBook?.bids.map((bid, i) => (
              <div key={`bid-${i}`} className="relative flex items-center justify-between px-2 py-0.5 rounded-sm">
                <div
                  className="absolute inset-0 bg-primary/10 rounded-sm"
                  style={{ width: `${(bid.size / maxBookVol) * 100}%` }}
                />
                <span className="relative text-primary tabular-nums">{bid.price.toFixed(4)}%</span>
                <span className="relative text-muted-foreground tabular-nums">{formatNumber(bid.size)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-16">
        <h3 className="text-sm font-semibold mb-3">Recent Trades</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/30">
                <th className="text-left py-2 px-2 font-medium">Time</th>
                <th className="text-left py-2 px-2 font-medium">Side</th>
                <th className="text-right py-2 px-2 font-medium">Size</th>
                <th className="text-right py-2 px-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {trades?.map((trade, i) => (
                <tr key={i} className="border-b border-border/10 hover:bg-white/[0.02]">
                  <td className="py-1.5 px-2 text-muted-foreground tabular-nums">{trade.time}</td>
                  <td className={`py-1.5 px-2 font-medium ${trade.side === "buy" ? "text-primary" : "text-destructive"}`}>
                    {trade.side.toUpperCase()}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(trade.size)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{trade.price.toFixed(4)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <StickyCTA text="Ready to trade? Lock in rates on Boros" />
    </PageContainer>
  );
}
