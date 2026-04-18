import { usePendleMarketList, useSpendleStats, formatUSD } from "@/lib/api";

interface Tile { label: string; value: string; sub?: string; }

export function LiveStatsStrip({ variant }: { variant: "compact" | "dense" }) {
  const { data: markets } = usePendleMarketList();
  const { data: spendle } = useSpendleStats();

  const active = (markets ?? []).filter(m => new Date(m.expiry).getTime() > Date.now());
  const bestApy = active.filter(m => m.totalTvl >= 1_000_000).reduce((b, m) => m.impliedApy > (b?.impliedApy ?? 0) ? m : b, null as any);
  const totalTvl = active.reduce((s, m) => s + (m.totalTvl ?? 0), 0);
  const avgApy = active.length ? active.reduce((s, m) => s + (m.impliedApy ?? 0), 0) / active.length : 0;

  const compact: Tile[] = [
    { label: "Best Yield", value: bestApy ? `${(bestApy.impliedApy * 100).toFixed(2)}%` : "—", sub: bestApy?.name?.slice(0, 20) ?? "" },
    { label: "Total TVL", value: totalTvl > 0 ? formatUSD(totalTvl) : "—", sub: `${active.length} markets` },
    { label: "sPENDLE APY", value: spendle?.stakingApy != null ? `${(spendle.stakingApy * 100).toFixed(2)}%` : "—", sub: "From revenue" },
  ];

  const dense: Tile[] = [
    { label: "Best APY", value: bestApy ? `${(bestApy.impliedApy * 100).toFixed(2)}%` : "—" },
    { label: "Total TVL", value: totalTvl > 0 ? formatUSD(totalTvl) : "—" },
    { label: "sPENDLE APY", value: spendle?.stakingApy != null ? `${(spendle.stakingApy * 100).toFixed(2)}%` : "—" },
    { label: "Markets", value: String(active.length) },
    { label: "Avg APY", value: `${(avgApy * 100).toFixed(2)}%` },
    { label: "PENDLE", value: spendle?.pendlePrice != null ? `$${spendle.pendlePrice.toFixed(2)}` : "—" },
  ];

  const tiles = variant === "dense" ? dense : compact;
  const cols = variant === "dense" ? "grid-cols-2 md:grid-cols-6" : "grid-cols-1 md:grid-cols-3";
  return (
    <div className={`grid ${cols} gap-3 mb-8`}>
      {tiles.map(t => (
        <div key={t.label} className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t.label}</p>
          <p className="text-xl font-bold font-mono tabular-nums text-foreground">{t.value}</p>
          {t.sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}
