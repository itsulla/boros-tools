import { Link } from "wouter";
import { Clock } from "lucide-react";
import { usePendleMarketList, formatUSD } from "@/lib/api";

export function ExpiringSoonList({ variant }: { variant: "compact" | "dense" }) {
  const { data: markets } = usePendleMarketList();
  const now = Date.now();
  const soon = (markets ?? [])
    .map(m => ({ ...m, days: Math.max(0, Math.ceil((new Date(m.expiry).getTime() - now) / 86400000)) }))
    .filter(m => m.days > 0 && m.days <= 30 && m.totalTvl >= 1_000_000)
    .sort((a, b) => a.days - b.days);

  if (variant === "dense") {
    const total = soon.slice(0, 20).reduce((s, m) => s + m.totalTvl, 0);
    return (
      <div className="bg-card border border-card-border rounded-xl p-4 mb-8 flex items-center gap-3">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground">
          <span className="font-semibold">{soon.length}</span> markets maturing in next 30 days · <span className="font-mono tabular-nums">{formatUSD(total)}</span> TVL
        </span>
        <Link href="/calendar">
          <span className="ml-auto text-xs text-primary hover:underline cursor-pointer">View calendar →</span>
        </Link>
      </div>
    );
  }

  // Compact — top 3 in a list
  const top = soon.slice(0, 3);
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Expiring Soon</h3>
      </div>
      {top.length === 0 ? (
        <p className="text-xs text-muted-foreground">No markets maturing in the next 30 days.</p>
      ) : (
        <div className="space-y-2">
          {top.map(m => (
            <div key={`${m.chainId}:${m.address}`} className="flex items-baseline justify-between gap-2">
              <span className="text-sm truncate">{m.name}</span>
              <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                {m.days}d · <span className="text-secondary">{(m.impliedApy * 100).toFixed(2)}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <Link href="/calendar">
        <span className="mt-3 inline-block text-xs text-primary hover:underline cursor-pointer">View calendar →</span>
      </Link>
    </div>
  );
}
