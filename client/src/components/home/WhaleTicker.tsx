import { Link } from "wouter";
import { useWhales, formatUSD } from "@/lib/api";

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 42161: "Arbitrum", 56: "BSC", 8453: "Base" };

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function WhaleTicker() {
  const { data: whales } = useWhales(10);
  const events = whales ?? [];

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Whale Ticker</h3>
        <Link href="/whales"><span className="text-xs text-primary hover:underline cursor-pointer">Full tracker →</span></Link>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent whale events.</p>
      ) : (
        <div className="space-y-1 font-mono text-xs">
          {events.map(e => (
            <div key={e.id} className="flex items-baseline gap-2">
              <span className={`shrink-0 ${e.tvlChange > 0 ? "text-secondary" : "text-destructive"}`}>→ {e.tvlChange > 0 ? "+" : ""}{formatUSD(Math.abs(e.tvlChange))}</span>
              <span className="text-foreground truncate">· {e.marketName}</span>
              <span className="text-muted-foreground">· {CHAIN_NAMES[e.chainId] ?? `Ch${e.chainId}`}</span>
              <span className="text-muted-foreground ml-auto shrink-0">{timeAgo(e.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
