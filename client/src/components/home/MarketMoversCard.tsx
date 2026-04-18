import { TrendingUp } from "lucide-react";
import { useMarketMovers } from "@/lib/api";
import { OpportunityCard } from "./OpportunityCard";
import { EmptyState } from "@/components/ui/empty-state";

export function MarketMoversCard({ variant }: { variant: "compact" | "dense" }) {
  const { data: movers, isLoading } = useMarketMovers(7, variant === "dense" ? 3 : 1);
  const list = movers ?? [];

  return (
    <OpportunityCard icon="📈" title="Biggest Movers (7d)" variant={variant} isLoading={isLoading} cta={{ label: "View history", href: "/history" }}>
      {list.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-4 h-4" />}
          title="Collecting data"
          description="Market movers appear after a few days of snapshots."
          className="py-4"
        />
      ) : (
        <div className="space-y-1.5">
          {list.map(m => {
            const up = m.apyChangeBps > 0;
            return (
              <div key={`${m.chainId}:${m.address}`} className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">→ {(m.currentApy * 100).toFixed(2)}%</p>
                </div>
                <span className={`text-sm font-bold font-mono tabular-nums shrink-0 ${up ? "text-secondary" : "text-destructive"}`}>
                  {up ? "+" : ""}{m.apyChangeBps}bps
                </span>
              </div>
            );
          })}
        </div>
      )}
    </OpportunityCard>
  );
}
