import { useState, useMemo } from "react";
import { Link } from "wouter";
import { usePendleMarketList, formatUSD, useSparklines, sparklineKey } from "@/lib/api";
import { Sparkline } from "@/components/Sparkline";

const CHAINS: Record<number, string> = { 1: "ETH", 42161: "ARB", 56: "BSC", 8453: "BASE" };
type Filter = "all" | "stables" | "eth" | "btc";

function classify(asset: string): "stables" | "eth" | "btc" | "other" {
  const a = asset.toUpperCase();
  if (["USDC", "USDT", "USDE", "USDG", "DAI", "GHO", "CRVUSD", "FRAX", "PYUSD"].includes(a) || a.includes("USD")) return "stables";
  if (a.includes("ETH")) return "eth";
  if (a.includes("BTC")) return "btc";
  return "other";
}

export function TopMarketsTable() {
  const { data: markets, isLoading } = usePendleMarketList();
  const { data: sparklines } = useSparklines();
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const active = (markets ?? []).filter(m => new Date(m.expiry).getTime() > Date.now() && m.totalTvl >= 1_000_000);
    const filtered = filter === "all" ? active : active.filter(m => classify(m.asset) === filter);
    // Score: impliedApy × sqrt(tvl) × min(days, 180)
    const scored = filtered.map(m => {
      const days = Math.max(0, Math.ceil((new Date(m.expiry).getTime() - Date.now()) / 86400000));
      return { m, score: m.impliedApy * Math.sqrt(m.totalTvl) * Math.min(days, 180), days };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 15);
  }, [markets, filter]);

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-8">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/30 flex-wrap">
        <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Top Markets</h3>
        <div className="flex gap-1 bg-background border border-border rounded-lg p-0.5">
          {(["all", "stables", "eth", "btc"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors capitalize ${filter === f ? "bg-primary text-[#090D18]" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "All" : f === "stables" ? "Stables" : f.toUpperCase()}
            </button>
          ))}
        </div>
        <Link href="/screener">
          <span className="text-xs text-primary hover:underline cursor-pointer">Screener →</span>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-muted-foreground">
              <th className="text-left px-4 py-2 text-[11px] font-medium">Market</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium">Chain</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium">TVL</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium">Impl APY</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium">Under APY</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium">Days</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium">Trend</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No markets match</td></tr>
            ) : (
              rows.map(({ m, days }) => (
                <tr key={`${m.chainId}:${m.address}`} className="border-b border-border/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 font-sans font-medium truncate max-w-xs">{m.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{CHAINS[m.chainId] ?? `Ch${m.chainId}`}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatUSD(m.totalTvl)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-secondary">{(m.impliedApy * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{(m.underlyingApy * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{days}d</td>
                  <td className="px-4 py-2">
                    <Link href="/history">
                      <span className="cursor-pointer inline-block"><Sparkline data={sparklines?.[sparklineKey(m.chainId, m.address)] ?? []} /></span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
