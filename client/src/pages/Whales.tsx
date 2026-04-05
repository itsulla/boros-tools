import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { formatUSD } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum", 42161: "Arbitrum", 56: "BSC", 8453: "Base",
  10: "Optimism", 5000: "Mantle", 146: "Sonic",
};

interface WhaleEvent {
  id: number;
  timestamp: string;
  chainId: number;
  marketAddress: string;
  marketName: string;
  asset: string;
  eventType: string;
  tvlBefore: number;
  tvlAfter: number;
  tvlChange: number;
  tvlChangePercent: number;
}

export default function Whales() {
  const [filter, setFilter] = useState<"all" | "inflow" | "outflow">("all");

  const { data: events, isLoading } = useQuery<WhaleEvent[]>({
    queryKey: ["whale-events"],
    queryFn: async () => {
      const res = await fetch("/api/pendle/whales?limit=100");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const filtered = events?.filter(e => {
    if (filter === "inflow") return e.eventType === "LARGE_INFLOW";
    if (filter === "outflow") return e.eventType === "LARGE_OUTFLOW";
    return true;
  }) ?? [];

  function timeAgo(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Whale Tracker</h1>
        <p className="text-sm text-muted-foreground">Large TVL movements across Pendle markets</p>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-card border border-card-border rounded-lg p-1 w-fit mb-6">
        {(["all", "inflow", "outflow"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${filter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All" : f === "inflow" ? "Inflows" : "Outflows"}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-card border border-card-border rounded-xl p-4 mb-6 text-xs text-muted-foreground">
        Tracking TVL changes exceeding $500K or 10% per 5-minute sync cycle. Data accumulates over time — larger movements are detected first.
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          No whale events detected yet. Events are captured during each 5-minute sync cycle when large TVL changes occur.
        </div>
      ) : (
        <div className="space-y-3 mb-16">
          {filtered.map(e => (
            <div key={e.id} className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-4">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${e.eventType === "LARGE_INFLOW" ? "bg-secondary/10" : "bg-destructive/10"}`}>
                {e.eventType === "LARGE_INFLOW" ? <TrendingUp className="w-5 h-5 text-secondary" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{e.marketName}</span>
                  <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded">{CHAIN_NAMES[e.chainId] ?? `Chain ${e.chainId}`}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  TVL: {formatUSD(e.tvlBefore)} → {formatUSD(e.tvlAfter)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold font-mono tabular-nums ${e.tvlChange > 0 ? "text-secondary" : "text-destructive"}`}>
                  {e.tvlChange > 0 ? "+" : ""}{formatUSD(e.tvlChange)}
                </p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(e.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <StickyCTA text="Follow the whales on Pendle" />
    </PageContainer>
  );
}
