import { useMemo } from "react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { useHeatmapData, formatPercent } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const ASSETS = ["BTC", "ETH", "SOL"];
const EXCHANGES = ["Binance", "Bybit", "Hyperliquid", "Boros Implied", "Pendle PT"];

export default function Compare() {
  const { data: heatmapData, isLoading } = useHeatmapData();

  const ratesForAsset = (asset: string) =>
    heatmapData?.filter((d) => d.asset === asset) ?? [];

  const bestRate = (asset: string) => {
    const rates = ratesForAsset(asset);
    if (rates.length === 0) return null;
    return rates.reduce((best, r) => (r.rate > best.rate ? r : best), rates[0]);
  };

  const summaryItems = useMemo(() => {
    if (!heatmapData) return [];
    return ASSETS.map((asset) => {
      const best = bestRate(asset);
      return { asset, best };
    }).filter((item) => item.best !== null);
  }, [heatmapData]);

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Rate Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Side-by-side funding rates across all sources
        </p>
      </div>

      {/* Asset Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {ASSETS.map((asset) => (
            <div
              key={asset}
              className="bg-card border border-card-border rounded-xl p-5"
            >
              <Skeleton className="h-5 w-16 mb-3" />
              <div className="space-y-2">
                {EXCHANGES.map((ex) => (
                  <Skeleton key={ex} className="h-6 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {ASSETS.map((asset) => {
            const rates = ratesForAsset(asset);
            const best = bestRate(asset);
            return (
              <div
                key={asset}
                className="bg-card border border-card-border rounded-xl p-5"
                data-testid={`card-${asset.toLowerCase()}`}
              >
                <h3 className="font-display text-base font-semibold mb-3">
                  {asset}
                </h3>
                <div className="space-y-2">
                  {EXCHANGES.map((exchange) => {
                    const cell = rates.find((r) => r.exchange === exchange);
                    const rate = cell?.rate;
                    const isBest =
                      best !== null &&
                      cell !== undefined &&
                      cell.exchange === best.exchange &&
                      cell.asset === best.asset;
                    const colorClass =
                      rate === undefined
                        ? "text-muted-foreground"
                        : rate < 0
                        ? "text-destructive"
                        : "text-secondary";
                    return (
                      <div
                        key={exchange}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs text-muted-foreground">
                          {exchange}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono tabular-nums text-sm ${colorClass}`}
                          >
                            {rate !== undefined ? formatPercent(rate) : "—"}
                          </span>
                          {isBest && (
                            <span className="bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                              Best
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Row */}
      {!isLoading && summaryItems.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-1">Best rates at a glance</p>
          <p className="text-sm flex flex-wrap gap-x-4 gap-y-1">
            {summaryItems.map(({ asset, best }, idx) => (
              <span key={asset}>
                <span className="text-muted-foreground">Best {asset} rate:</span>{" "}
                <span className="font-semibold text-foreground">{best!.exchange}</span>{" "}
                <span className="font-mono text-secondary font-semibold">
                  {formatPercent(best!.rate)}
                </span>
                {idx < summaryItems.length - 1 && (
                  <span className="text-muted-foreground/40 ml-4">|</span>
                )}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Embed hint */}
      <p className="text-xs text-muted-foreground/60 mb-16">
        Bookmark this page for a quick rate overview
      </p>

      <StickyCTA text="Trade the best rates on Boros & Pendle" />
    </PageContainer>
  );
}
