import { ExternalLink } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { formatUSD } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface SPendleData {
  pendlePrice: number | null;
  mcap: number | null;
  totalTvl: number | null;
  stakingTvl: number | null;
  stakingPctOfMcap: number | null;
  annualFees: number | null;
  annualRevenue: number | null;
  holdersRevenue: number | null;
  stakingApy: number | null;
  dailyBuyback: number | null;
  dailyPendleBought: number | null;
  tvlToMcapRatio: number | null;
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SPendle() {
  const { data, isLoading } = useQuery<SPendleData | null>({
    queryKey: ["spendle-stats"],
    queryFn: async () => {
      const res = await fetch("/api/pendle/spendle");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 300_000,
  });

  const fmt = (v: number | null | undefined, decimals = 2) => v != null ? `$${v.toFixed(decimals)}` : "—";
  const fmtPct = (v: number | null | undefined) => v != null ? `${(v * 100).toFixed(2)}%` : "—";
  const fmtNum = (v: number | null | undefined) => v != null ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v) : "—";

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">sPENDLE Dashboard</h1>
        <p className="text-sm text-muted-foreground">Staking analytics, buyback data & yield metrics</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !data ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center text-muted-foreground text-sm mb-8">
          Unable to load sPENDLE data. Please try again later.
        </div>
      ) : (
        <>
          {/* Price & Market */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Market Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="PENDLE Price" value={fmt(data.pendlePrice)} />
            <StatCard label="Market Cap" value={data.mcap ? formatUSD(data.mcap) : "—"} />
            <StatCard label="Total TVL" value={data.totalTvl ? formatUSD(data.totalTvl) : "—"} />
            <StatCard label="TVL / Market Cap" value={data.tvlToMcapRatio ? `${data.tvlToMcapRatio.toFixed(1)}x` : "—"} highlight sub="Higher = more undervalued" />
          </div>

          {/* Staking */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">sPENDLE Staking</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Staking TVL" value={data.stakingTvl ? formatUSD(data.stakingTvl) : "—"} />
            <StatCard label="Staked % of MCap" value={fmtPct(data.stakingPctOfMcap)} sub="Higher = more conviction" />
            <StatCard label="sPENDLE APY" value={fmtPct(data.stakingApy)} highlight sub="From protocol revenue" />
            <StatCard label="Holders Revenue (Ann.)" value={data.holdersRevenue ? formatUSD(data.holdersRevenue) : "—"} sub="80% of protocol revenue" />
          </div>

          {/* Revenue & Buybacks */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Revenue & Buybacks</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Annual Fees" value={data.annualFees ? formatUSD(data.annualFees) : "—"} />
            <StatCard label="Annual Revenue" value={data.annualRevenue ? formatUSD(data.annualRevenue) : "—"} />
            <StatCard label="Daily Buyback" value={data.dailyBuyback ? formatUSD(data.dailyBuyback) : "—"} highlight sub="PENDLE bought daily" />
            <StatCard label="Daily PENDLE Bought" value={data.dailyPendleBought ? fmtNum(data.dailyPendleBought) : "—"} sub={data.pendlePrice ? `@ $${data.pendlePrice.toFixed(2)}/PENDLE` : ""} />
          </div>

          {/* Explainer */}
          <div className="bg-card border border-card-border rounded-xl p-5 mb-8">
            <h3 className="text-sm font-semibold mb-3">How sPENDLE Works</h3>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>sPENDLE replaced vePENDLE in January 2026. It's a liquid staking token — stake PENDLE 1:1, receive sPENDLE. No lock-up required.</p>
              <p><span className="text-foreground font-medium">Unstaking:</span> 14-day cooldown period, or instant redemption with a 5% fee.</p>
              <p><span className="text-foreground font-medium">Revenue sharing:</span> Up to 80% of protocol revenue is used for PENDLE buybacks from the open market, distributed to sPENDLE holders.</p>
              <p><span className="text-foreground font-medium">Governance:</span> sPENDLE holders participate in governance voting and receive boosted yields on Pendle pools.</p>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-4 mb-8">
        <a href="https://app.pendle.finance/vependle/overview" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Stake on Pendle <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <StickyCTA text="Earn yield by staking PENDLE" />
    </PageContainer>
  );
}
