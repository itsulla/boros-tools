import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { usePendleMarketList, usePendleHistory } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const TIMEFRAMES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
];

export default function History() {
  const [selectedMarketKey, setSelectedMarketKey] = useState<string>("");
  const [timeframeDays, setTimeframeDays] = useState(30);

  const { data: markets } = usePendleMarketList();

  // Sort markets by TVL descending
  const sortedMarkets = useMemo(() => {
    if (!markets) return [];
    return [...markets].sort((a, b) => (b.totalTvl ?? 0) - (a.totalTvl ?? 0));
  }, [markets]);

  // Parse selected market key into chainId + address
  const selectedMarket = useMemo(() => {
    if (!selectedMarketKey) return null;
    const [chainId, address] = selectedMarketKey.split("|");
    return { chainId: Number(chainId), address };
  }, [selectedMarketKey]);

  const {
    data: historyData,
    isLoading,
    isError,
    refetch,
  } = usePendleHistory(
    selectedMarket?.chainId ?? null,
    selectedMarket?.address ?? null
  );

  const chartData = useMemo(() => {
    if (!historyData?.results) return [];
    const cutoff = Date.now() - timeframeDays * 86400000;
    return historyData.results
      .filter((r: any) => new Date(r.timestamp).getTime() > cutoff)
      .map((r: any) => ({
        timestamp: r.timestamp,
        date: new Date(r.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        impliedApy: +(r.impliedApy * 100).toFixed(4),
        underlyingApy: +(r.underlyingApy * 100).toFixed(4),
      }));
  }, [historyData, timeframeDays]);

  const latestPoint =
    chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <PageContainer>
      {/* Title */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Yield History</h1>
        <p className="text-sm text-muted-foreground">
          Track how Pendle market APYs change over time
        </p>
      </div>

      {/* Market selector */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          Select Market
        </label>
        <select
          value={selectedMarketKey}
          onChange={(e) => setSelectedMarketKey(e.target.value)}
          className="w-full sm:w-auto min-w-[320px] bg-card border border-card-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">— Choose a market —</option>
          {sortedMarkets.map((m) => (
            <option key={`${m.chainId}|${m.address}`} value={`${m.chainId}|${m.address}`}>
              {m.name} ({m.asset}) — Chain {m.chainId}
            </option>
          ))}
        </select>
      </div>

      {/* Timeframe buttons */}
      {selectedMarketKey && (
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-card border border-card-border rounded-lg p-1 flex gap-1">
            {TIMEFRAMES.map(({ label, days }) => (
              <button
                key={label}
                onClick={() => setTimeframeDays(days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  timeframeDays === days
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart area */}
      {!selectedMarketKey ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Select a market to view APY history
        </div>
      ) : isLoading ? (
        <div className="bg-card border border-card-border rounded-xl p-4 mb-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : isError || (!isLoading && !historyData) ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-sm text-muted-foreground">Unable to load history data</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-card border border-card-border text-foreground hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-card border border-card-border rounded-xl p-4 mb-6">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
                No data available for this timeframe
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(55,75,109,0.3)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9DAFCD" }}
                    tickLine={false}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9DAFCD" }}
                    tickFormatter={(v) => v.toFixed(1) + "%"}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1C2B3D",
                      border: "1px solid #2B3B55",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(label) => label}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)}%`,
                      name,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="impliedApy"
                    name="Implied APY"
                    stroke="#1BE3C2"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="underlyingApy"
                    name="Underlying APY"
                    stroke="#374B6D"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Current rate card */}
          {latestPoint && (
            <div className="bg-card border border-card-border rounded-xl p-5 mb-16">
              <h3 className="text-sm font-semibold mb-4">Current Rates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Implied APY</p>
                  <p className="text-xl font-mono font-semibold text-primary">
                    {latestPoint.impliedApy.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Underlying APY</p>
                  <p className="text-xl font-mono font-semibold text-foreground">
                    {latestPoint.underlyingApy.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <StickyCTA text="Find the best entry point on Pendle" />
    </PageContainer>
  );
}
