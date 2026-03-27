import { useState, useMemo } from "react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { useHeatmapData, formatPercent } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const EXCHANGES = ["Binance", "Bybit", "Hyperliquid", "Boros Implied", "Pendle PT"];
type SortMode = "default" | "highest" | "lowest" | "spread";

function rateToColor(rate: number): string {
  // Red for negative, gray for near-zero, green/teal for positive
  if (rate <= -10) return "rgba(221, 84, 83, 0.7)";
  if (rate < 0) return `rgba(221, 84, 83, ${0.2 + Math.abs(rate) * 0.05})`;
  if (rate < 2) return "rgba(157, 175, 205, 0.15)";
  if (rate < 5) return `rgba(27, 227, 194, ${0.1 + rate * 0.03})`;
  if (rate < 10) return `rgba(27, 227, 194, ${0.15 + rate * 0.03})`;
  if (rate < 20) return `rgba(27, 227, 194, ${0.25 + rate * 0.02})`;
  return `rgba(27, 227, 194, ${Math.min(0.85, 0.35 + rate * 0.015)})`;
}

function rateTextColor(rate: number): string {
  if (rate < 0) return "text-destructive";
  if (rate > 0) return "text-secondary";
  return "text-foreground";
}

export default function Heatmap() {
  const { data: heatmapData, isLoading } = useHeatmapData();
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const assets = useMemo(() => {
    if (!heatmapData) return [];
    const assetSet = new Set(heatmapData.map((d) => d.asset));
    let assetList = Array.from(assetSet);

    if (sortMode === "highest") {
      assetList.sort((a, b) => {
        const maxA = Math.max(...heatmapData.filter((d) => d.asset === a).map((d) => d.rate));
        const maxB = Math.max(...heatmapData.filter((d) => d.asset === b).map((d) => d.rate));
        return maxB - maxA;
      });
    } else if (sortMode === "lowest") {
      assetList.sort((a, b) => {
        const minA = Math.min(...heatmapData.filter((d) => d.asset === a).map((d) => d.rate));
        const minB = Math.min(...heatmapData.filter((d) => d.asset === b).map((d) => d.rate));
        return minA - minB;
      });
    } else if (sortMode === "spread") {
      assetList.sort((a, b) => {
        const ratesA = heatmapData.filter((d) => d.asset === a).map((d) => d.rate);
        const ratesB = heatmapData.filter((d) => d.asset === b).map((d) => d.rate);
        return (Math.max(...ratesB) - Math.min(...ratesB)) - (Math.max(...ratesA) - Math.min(...ratesA));
      });
    }
    return assetList;
  }, [heatmapData, sortMode]);

  const getRate = (asset: string, exchange: string) => {
    return heatmapData?.find((d) => d.asset === asset && d.exchange === exchange)?.rate;
  };

  // Insight cards
  const insights = useMemo(() => {
    if (!heatmapData) return { highestSpread: null, borosOpp: null };
    const assetSpreads = assets.map((asset) => {
      const rates = heatmapData.filter((d) => d.asset === asset).map((d) => d.rate);
      return { asset, spread: Math.max(...rates) - Math.min(...rates) };
    });
    const highestSpread = assetSpreads.sort((a, b) => b.spread - a.spread)[0];

    const borosOpps = assets.map((asset) => {
      const borosRate = getRate(asset, "Boros Implied") ?? 0;
      const cexRates = heatmapData.filter((d) => d.asset === asset && d.exchange !== "Boros Implied").map((d) => d.rate);
      const avgCex = cexRates.reduce((a, b) => a + b, 0) / cexRates.length;
      return { asset, diff: borosRate - avgCex };
    });
    const borosOpp = borosOpps.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

    return { highestSpread, borosOpp };
  }, [heatmapData, assets]);

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">Funding Rate Heatmap</h1>
          <p className="text-sm text-muted-foreground">Visual overview across exchanges & assets</p>
        </div>
        <div className="flex gap-1 bg-card border border-card-border rounded-lg p-1">
          {(
            [
              { mode: "default" as SortMode, label: "Default" },
              { mode: "highest" as SortMode, label: "Highest" },
              { mode: "lowest" as SortMode, label: "Lowest" },
              { mode: "spread" as SortMode, label: "Spread" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                sortMode === mode ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`sort-${mode}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="heatmap-table">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground w-24">Asset</th>
                  {EXCHANGES.map((ex) => (
                    <th key={ex} className="text-center py-3 px-4 text-xs font-medium text-muted-foreground min-w-[120px]">
                      {ex}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset} className="border-b border-border/10">
                    <td className="py-2.5 px-4 font-semibold text-sm">{asset}</td>
                    {EXCHANGES.map((exchange) => {
                      const rate = getRate(asset, exchange);
                      return (
                        <td key={exchange} className="py-2 px-3 text-center">
                          <div
                            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md font-mono text-xs font-semibold tabular-nums ${rateTextColor(rate ?? 0)}`}
                            style={{ backgroundColor: rateToColor(rate ?? 0), minWidth: "80px" }}
                          >
                            {rate !== undefined ? formatPercent(rate) : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
        <span>−20%</span>
        <div className="flex-1 h-3 rounded-full overflow-hidden flex">
          <div className="flex-1" style={{ background: "linear-gradient(90deg, rgba(221,84,83,0.7) 0%, rgba(157,175,205,0.15) 35%, rgba(27,227,194,0.2) 50%, rgba(27,227,194,0.5) 75%, rgba(27,227,194,0.8) 100%)" }} />
        </div>
        <span>+40%</span>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
        {insights.highestSpread && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Highest Cross-Exchange Spread</p>
            <p className="text-lg font-bold">
              <span className="text-primary">{insights.highestSpread.asset}</span>
              <span className="text-muted-foreground ml-2 text-sm">
                {insights.highestSpread.spread.toFixed(2)}% spread
              </span>
            </p>
          </div>
        )}
        {insights.borosOpp && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Boros Opportunity</p>
            <p className="text-lg font-bold">
              <span className="text-secondary">{insights.borosOpp.asset}</span>
              <span className="text-muted-foreground ml-2 text-sm">
                {formatPercent(insights.borosOpp.diff)} vs CEX avg
              </span>
            </p>
          </div>
        )}
      </div>

      <StickyCTA text="Spot an opportunity? Trade it on Boros" />
    </PageContainer>
  );
}
