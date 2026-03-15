import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ExternalLink, Shield, AlertTriangle, Flame } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { useYieldPools, formatPercent, formatUSD } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { BOROS_REFERRAL_URL } from "@/lib/constants";

const ASSET_FILTERS = ["All", "ETH", "BTC", "USDC", "USDT", "SOL"];

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Low: "bg-primary/10 text-primary border-primary/30",
    Medium: "bg-chart-4/10 text-chart-4 border-chart-4/30",
    High: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const icons: Record<string, typeof Shield> = {
    Low: Shield,
    Medium: AlertTriangle,
    High: Flame,
  };
  const Icon = icons[level] || Shield;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[level] ?? colors.Low}`}>
      <Icon className="w-3 h-3" />
      {level}
    </span>
  );
}

export default function Yields() {
  const { data: pools, isLoading } = useYieldPools();
  const [assetFilter, setAssetFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"apy" | "tvl">("apy");

  const filtered = useMemo(() => {
    let result = pools ?? [];
    if (assetFilter !== "All") {
      result = result.filter((p) => p.asset === assetFilter);
    }
    result = [...result].sort((a, b) => sortBy === "apy" ? b.apy - a.apy : b.tvl - a.tvl);
    return result;
  }, [pools, assetFilter, sortBy]);

  // Chart data for selected asset
  const chartData = useMemo(() => {
    return filtered.slice(0, 8).map((p) => ({
      name: `${p.protocol} ${p.product}`.slice(0, 20),
      apy: p.apy,
      protocol: p.protocol,
    }));
  }, [filtered]);

  const bestBoros = filtered.find((p) => p.protocol === "Boros");

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Yield Comparison</h1>
        <p className="text-sm text-muted-foreground">Compare Boros vs DeFi vs CeFi yields</p>
      </div>

      {/* Asset filter */}
      <div className="flex flex-wrap gap-1 mb-6 bg-card border border-card-border rounded-lg p-1 w-fit" data-testid="yield-asset-tabs">
        {ASSET_FILTERS.map((asset) => (
          <button
            key={asset}
            onClick={() => setAssetFilter(asset)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              assetFilter === asset
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`yield-tab-${asset}`}
          >
            {asset}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-card border border-card-border rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold mb-3">Yield Comparison</h3>
        <div className="h-[260px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,75,109,0.3)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#9DAFCD" }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9DAFCD" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1C2B3D", border: "1px solid #2B3B55", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "APY"]}
                />
                <Bar dataKey="apy" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.protocol === "Boros" ? "#1BE3C2" : entry.protocol.includes("Pendle") ? "#6079FF" : "#374B6D"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data for this filter</div>
          )}
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        <div className="flex gap-1 bg-card border border-card-border rounded-lg p-0.5">
          <button
            onClick={() => setSortBy("apy")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              sortBy === "apy" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            APY
          </button>
          <button
            onClick={() => setSortBy("tvl")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              sortBy === "tvl" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            TVL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="yields-table">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground">
                  <th className="text-left py-3 px-4 text-xs font-medium">Protocol</th>
                  <th className="text-left py-3 px-4 text-xs font-medium">Product</th>
                  <th className="text-center py-3 px-4 text-xs font-medium">Asset</th>
                  <th className="text-right py-3 px-4 text-xs font-medium">APY/APR</th>
                  <th className="text-center py-3 px-4 text-xs font-medium">Type</th>
                  <th className="text-center py-3 px-4 text-xs font-medium">Maturity</th>
                  <th className="text-center py-3 px-4 text-xs font-medium">Risk</th>
                  <th className="text-right py-3 px-4 text-xs font-medium">TVL</th>
                  <th className="text-center py-3 px-4 text-xs font-medium"></th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filtered.map((pool, i) => (
                  <tr key={i} className={`border-b border-border/10 hover:bg-white/[0.02] ${pool.protocol === "Boros" ? "bg-primary/[0.03]" : ""}`}>
                    <td className="py-2.5 px-4 font-medium">
                      {pool.protocol === "Boros" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5" />}
                      {pool.protocol}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{pool.product}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums">{pool.asset}</td>
                    <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${pool.protocol === "Boros" ? "text-primary" : ""}`}>
                      {pool.apy.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${pool.type === "Fixed" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                        {pool.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-muted-foreground">{pool.maturity ?? "—"}</td>
                    <td className="py-2.5 px-4 text-center">
                      <RiskBadge level={pool.riskLevel} />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{formatUSD(pool.tvl)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <a href={pool.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA card */}
      {bestBoros && (
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg p-5 mb-16" data-testid="yield-cta">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold mb-1">Lock in {bestBoros.apy.toFixed(2)}% Fixed APR on Boros</h3>
              <p className="text-xs text-muted-foreground">
                {bestBoros.product} — higher than most variable DeFi lending rates
              </p>
            </div>
            <a
              href={BOROS_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 teal-cta text-xs px-4 py-2 rounded-lg whitespace-nowrap"
            >
              Trade on Boros
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      <StickyCTA text="Lock in the best rate on Boros" />
    </PageContainer>
  );
}
