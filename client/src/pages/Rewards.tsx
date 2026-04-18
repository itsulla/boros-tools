import { Fragment, useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { usePendleMarketList, usePendleMarketDetail, formatUSD } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useMode } from "@/lib/mode-context";

function RewardDetail({ chainId, address }: { chainId: number; address: string }) {
  const { data: detail, isLoading, isError, refetch } = usePendleMarketDetail(chainId, address);

  if (isLoading) {
    return (
      <div className="bg-background/30 p-4 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-background/30 p-4 text-sm text-muted-foreground">
        Unable to load details.{" "}
        <button
          onClick={() => refetch()}
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  const breakdown: any[] | null | undefined = detail?.underlyingRewardApyBreakdown;

  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="bg-background/30 p-4 text-sm text-muted-foreground">
        No reward breakdown available.
      </div>
    );
  }

  return (
    <div className="bg-background/30 p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
        Reward APY Breakdown
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground">
            <th className="text-left text-xs font-medium pb-2 pr-4">Source</th>
            <th className="text-left text-xs font-medium pb-2 pr-4">Type</th>
            <th className="text-right text-xs font-medium pb-2">APY Contribution</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((item: any, i: number) => (
            <tr key={i} className="border-b border-border/10 last:border-0">
              <td className="py-2 pr-4 text-foreground">
                {item.source ?? item.symbol ?? "—"}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {item.type ?? "External Reward"}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-primary">
                {((item.apy ?? 0) * 100).toFixed(4)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const REWARDS_COLUMNS = [
  { id: "name", label: "Market Name", mode: "both" as const },
  { id: "chain", label: "Chain", mode: "advanced" as const },
  { id: "asset", label: "Asset", mode: "both" as const },
  { id: "impliedApy", label: "Implied APY", mode: "both" as const },
  { id: "tvl", label: "TVL", mode: "both" as const },
];

export default function Rewards() {
  const { data: markets, isLoading } = usePendleMarketList({ hasPoints: true });
  const { mode } = useMode();
  const [sortBy, setSortBy] = useState<"apy" | "tvl">("apy");
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);

  const visibleColumns = REWARDS_COLUMNS.filter(c => c.mode === "both" || c.mode === mode);

  const sorted = useMemo(() => {
    if (!markets) return [];
    return [...markets].sort((a, b) =>
      sortBy === "apy"
        ? b.impliedApy - a.impliedApy
        : b.totalTvl - a.totalTvl
    );
  }, [markets, sortBy]);

  function toggleRow(address: string) {
    setExpandedMarket((prev) => (prev === address ? null : address));
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold mb-1">Rewards Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Pendle markets earning external rewards &amp; points
        </p>
      </div>

      {/* Sort toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSortBy("apy")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            sortBy === "apy"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
          }`}
        >
          By APY
        </button>
        <button
          onClick={() => setSortBy("tvl")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            sortBy === "tvl"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
          }`}
        >
          By TVL
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-muted-foreground">
              {visibleColumns.map(c => (
                <th key={c.id} className={`text-xs font-medium px-4 py-3 ${c.id === "impliedApy" || c.id === "tvl" ? "text-right" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/10 last:border-0">
                  {visibleColumns.map(c => (
                    <td key={c.id} className="px-4 py-3">
                      <Skeleton className={`h-4 ${c.id === "name" ? "w-48" : c.id === "impliedApy" || c.id === "tvl" ? "w-16 ml-auto" : "w-12"}`} />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No markets with reward programs found.
                </td>
              </tr>
            )}

            {!isLoading &&
              sorted.map((m) => {
                const isExpanded = expandedMarket === m.address;
                return (
                  <Fragment key={m.address}>
                    <tr
                      onClick={() => toggleRow(m.address)}
                      className="border-b border-border/10 last:border-0 hover:bg-white/[0.04] cursor-pointer transition-colors duration-150"
                    >
                      {visibleColumns.map(c => {
                        switch (c.id) {
                          case "name":
                            return (
                              <td key={c.id} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">{m.name}</span>
                                  <span className="bg-secondary/10 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                    Points
                                  </span>
                                </div>
                              </td>
                            );
                          case "chain":
                            return <td key={c.id} className="px-4 py-3 text-muted-foreground font-mono tabular-nums">{m.chainId}</td>;
                          case "asset":
                            return <td key={c.id} className="px-4 py-3 text-muted-foreground">{m.asset}</td>;
                          case "impliedApy":
                            return <td key={c.id} className="px-4 py-3 text-right font-mono tabular-nums text-primary">{(m.impliedApy * 100).toFixed(2)}%</td>;
                          case "tvl":
                            return (
                              <td key={c.id} className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                                <div className="flex items-center justify-end gap-2">
                                  {formatUSD(m.totalTvl)}
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>

                    {isExpanded && (
                      <tr key={`${m.address}-detail`} className="border-b border-border/10 last:border-0">
                        <td colSpan={visibleColumns.length} className="p-0">
                          <RewardDetail chainId={m.chainId} address={m.address} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      <StickyCTA text="Earn rewards on Pendle" />
    </PageContainer>
  );
}
