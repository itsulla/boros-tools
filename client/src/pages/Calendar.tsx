import { useState, useMemo } from "react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { usePendleMarketList, formatUSD } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type SortKey = "expiry" | "apy" | "tvl";

interface BucketConfig {
  label: string;
  minDays: number;
  maxDays: number;
  headerColor: string;
  borderColor: string;
  badgeColor: string;
}

const BUCKETS: BucketConfig[] = [
  {
    label: "Expiring This Week",
    minDays: -Infinity,
    maxDays: 7,
    headerColor: "text-destructive",
    borderColor: "border-destructive/30",
    badgeColor: "text-destructive",
  },
  {
    label: "Next 2 Weeks",
    minDays: 7,
    maxDays: 14,
    headerColor: "text-chart-4",
    borderColor: "border-chart-4/30",
    badgeColor: "text-chart-4",
  },
  {
    label: "This Month",
    minDays: 14,
    maxDays: 30,
    headerColor: "text-chart-4",
    borderColor: "border-chart-4/30",
    badgeColor: "text-chart-4",
  },
  {
    label: "Next 3 Months",
    minDays: 30,
    maxDays: 90,
    headerColor: "text-primary",
    borderColor: "border-primary/30",
    badgeColor: "text-primary",
  },
  {
    label: "6+ Months",
    minDays: 90,
    maxDays: Infinity,
    headerColor: "text-muted-foreground",
    borderColor: "border-border/30",
    badgeColor: "text-muted-foreground",
  },
];

function getBucket(daysToExpiry: number): BucketConfig {
  for (const bucket of BUCKETS) {
    if (daysToExpiry < bucket.maxDays) return bucket;
  }
  return BUCKETS[BUCKETS.length - 1];
}

export default function Calendar() {
  const { data: markets, isLoading } = usePendleMarketList();
  const [sortBy, setSortBy] = useState<SortKey>("expiry");

  const grouped = useMemo(() => {
    const all = markets ?? [];

    const withDays = all.map((m) => ({
      ...m,
      daysToExpiry: Math.ceil(
        (new Date(m.expiry).getTime() - Date.now()) / 86400000
      ),
    }));

    // Sort according to current sort key
    const sorted = [...withDays].sort((a, b) => {
      if (sortBy === "expiry") return a.daysToExpiry - b.daysToExpiry;
      if (sortBy === "apy") return b.impliedApy - a.impliedApy;
      return b.totalTvl - a.totalTvl;
    });

    // Group into buckets
    return BUCKETS.map((bucket) => ({
      bucket,
      markets: sorted.filter((m) => {
        const d = m.daysToExpiry;
        return d >= bucket.minDays && d < bucket.maxDays;
      }),
    })).filter((g) => g.markets.length > 0);
  }, [markets, sortBy]);

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Maturity Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track Pendle market expirations
        </p>
      </div>

      {/* Sort toggle */}
      <div className="mb-6">
        <div className="inline-flex bg-card border border-card-border rounded-lg p-1 gap-1">
          {(["By Expiry", "By APY", "By TVL"] as const).map((label) => {
            const key: SortKey =
              label === "By Expiry" ? "expiry" : label === "By APY" ? "apy" : "tvl";
            const active = sortBy === key;
            return (
              <button
                key={label}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-6 w-48 mb-3" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8 pb-20">
          {grouped.map(({ bucket, markets: bucketMarkets }) => (
            <div key={bucket.label}>
              {/* Group header */}
              <div
                className={`pl-3 border-l-2 ${bucket.borderColor} mb-3`}
              >
                <h2 className={`text-sm font-semibold ${bucket.headerColor}`}>
                  {bucket.label} ({bucketMarkets.length})
                </h2>
              </div>

              {/* Market cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bucketMarkets.map((market) => (
                  <div
                    key={`${market.chainId}-${market.address ?? market.name}`}
                    className="bg-card border border-card-border rounded-lg p-4"
                  >
                    {/* Name */}
                    <p className="font-semibold text-sm leading-snug mb-2 truncate">
                      {market.name}
                    </p>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/30 text-muted-foreground border border-border/30">
                        Chain {market.chainId}
                      </span>
                      {market.asset && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/30 text-muted-foreground border border-border/30">
                          {market.asset}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Implied APY</span>
                        <span className="font-medium text-foreground">
                          {(market.impliedApy * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">TVL</span>
                        <span className="font-medium text-foreground">
                          {formatUSD(market.totalTvl)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Expires in</span>
                        <span className={`font-semibold ${bucket.badgeColor}`}>
                          {market.daysToExpiry}d
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No markets found.
            </div>
          )}
        </div>
      )}

      <StickyCTA text="Roll your positions on Pendle" />
    </PageContainer>
  );
}
