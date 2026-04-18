import { useWhales, formatUSD } from "@/lib/api";
import { OpportunityCard } from "./OpportunityCard";

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function WhaleActivityCard({ variant }: { variant: "compact" | "dense" }) {
  const { data: whales, isLoading } = useWhales(variant === "dense" ? 3 : 1);
  const events = whales ?? [];

  return (
    <OpportunityCard icon="🐋" title="Whale Activity" variant={variant} isLoading={isLoading} cta={{ label: "See all whales", href: "/whales" }}>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent whale events. Activity is detected during 5-min sync cycles.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map(e => (
            <div key={e.id} className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold font-mono tabular-nums ${e.tvlChange > 0 ? "text-secondary" : "text-destructive"}`}>
                  {e.tvlChange > 0 ? "+" : ""}{formatUSD(Math.abs(e.tvlChange))}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{e.marketName}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(e.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </OpportunityCard>
  );
}
