import { usePendleMarketList, formatUSD } from "@/lib/api";
import { OpportunityCard } from "./OpportunityCard";

export function BestYieldCard({ variant }: { variant: "compact" | "dense" }) {
  const { data: markets, isLoading } = usePendleMarketList();
  const active = (markets ?? []).filter(m => new Date(m.expiry).getTime() > Date.now() && m.totalTvl >= 1_000_000);
  const best = active.reduce((b, m) => m.impliedApy > (b?.impliedApy ?? 0) ? m : b, null as any);
  const days = best ? Math.max(0, Math.ceil((new Date(best.expiry).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <OpportunityCard icon="🌟" title="Best Yield Today" variant={variant} isLoading={isLoading} cta={{ label: "View on Screener", href: "/screener" }}>
      {best ? (
        <>
          <p className="text-2xl font-bold font-mono tabular-nums text-secondary mb-1">{(best.impliedApy * 100).toFixed(2)}%</p>
          <p className="text-xs text-foreground font-medium mb-1">{best.name}</p>
          {variant === "dense" && (
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <div>Chain {best.chainId} · {days}d to maturity</div>
              <div>TVL {formatUSD(best.totalTvl)}</div>
            </div>
          )}
          {variant === "compact" && <p className="text-[11px] text-muted-foreground">{days}d · {formatUSD(best.totalTvl)} TVL</p>}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No eligible markets</p>
      )}
    </OpportunityCard>
  );
}
