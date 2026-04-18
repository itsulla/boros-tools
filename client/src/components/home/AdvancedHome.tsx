import { PageContainer } from "@/components/Layout";
import { usePendleStatus } from "@/lib/api";
import { LiveStatsStrip } from "./LiveStatsStrip";
import { BestYieldCard } from "./BestYieldCard";
import { WhaleActivityCard } from "./WhaleActivityCard";
import { MarketMoversCard } from "./MarketMoversCard";
import { FeaturedStrategyCard } from "./FeaturedStrategyCard";
import { TopMarketsTable } from "./TopMarketsTable";
import { WhaleTicker } from "./WhaleTicker";
import { ExpiringSoonList } from "./ExpiringSoonList";
import { QuickToolsStrip } from "./QuickToolsStrip";

function syncAgeLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function AdvancedHome() {
  const { data: status } = usePendleStatus();
  const isFresh = status && !status.isStale;

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">UseBoros · Command Center</h1>
          <p className="text-xs text-muted-foreground mt-1">Live Pendle & Boros data at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isFresh ? "bg-secondary animate-pulse" : "bg-destructive"}`} />
          <span className="text-xs text-muted-foreground">
            {isFresh ? "Live" : "Stale"} · synced {syncAgeLabel(status?.lastSyncAt)}
          </span>
        </div>
      </div>

      <LiveStatsStrip variant="dense" />

      <div className="mb-8">
        <h2 className="font-display text-base font-semibold mb-4">Live Opportunities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BestYieldCard variant="dense" />
          <WhaleActivityCard variant="dense" />
          <MarketMoversCard variant="dense" />
          <FeaturedStrategyCard variant="dense" />
        </div>
      </div>

      <TopMarketsTable />
      <WhaleTicker />
      <ExpiringSoonList variant="dense" />
      <QuickToolsStrip />
    </PageContainer>
  );
}
