import { Link } from "wouter";
import {
  BarChart3,
  ArrowLeftRight,
  Calculator,
  Grid3x3,
  TrendingUp,
  BookOpen,
  ExternalLink,
  Activity,
} from "lucide-react";
import { PageContainer } from "@/components/Layout";
import { useBorosMarkets, formatPercent, formatUSD } from "@/lib/api";
import { BOROS_REFERRAL_URL } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

const TOOL_CARDS = [
  { icon: BarChart3, name: "Funding Rate Terminal", desc: "Live rates, charts & order book depth", href: "/terminal", color: "text-chart-1" },
  { icon: ArrowLeftRight, name: "Arbitrage Scanner", desc: "Cross-exchange funding rate opportunities", href: "/arbitrage", color: "text-chart-2" },
  { icon: Calculator, name: "P&L Simulator", desc: "Model positions before you trade", href: "/simulator", color: "text-chart-3" },
  { icon: Grid3x3, name: "Funding Rate Heatmap", desc: "Visual overview across exchanges & assets", href: "/heatmap", color: "text-chart-4" },
  { icon: TrendingUp, name: "Yield Comparison", desc: "Compare Boros vs DeFi vs CeFi yields", href: "/yields", color: "text-chart-1" },
  { icon: BookOpen, name: "Strategy Hub", desc: "Interactive guides for every Boros strategy", href: "/strategies", color: "text-chart-2" },
];

function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card p-4">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { data: markets, isLoading } = useBorosMarkets();

  const activeMarkets = markets?.length ?? 0;
  const btcMarket = markets?.find((m) => m.underlying === "BTC");
  const ethMarket = markets?.find((m) => m.underlying === "ETH");
  const totalVolume = markets?.reduce((sum, m) => sum + m.volume24h, 0) ?? 0;

  return (
    <PageContainer>
      {/* Hero Section with background */}
      <div
        className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 px-4 sm:px-6 lg:px-8 mb-8 overflow-hidden"
        data-testid="hero-section"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('./brand/boros-poster-galaxy.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0D1420]/80 via-[#0D1420]/70 to-[#0D1420]" />

        <div className="relative z-10 py-14 md:py-20">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 max-w-7xl mx-auto">
            {/* Left side: text content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium mb-6">
                <Activity className="w-3 h-3" />
                Powered by Pendle Boros
              </div>

              <img
                src="./brand/boros-by-pendle-logo.svg"
                alt="Boros by Pendle"
                className="h-14 md:h-16 w-auto mb-5 mx-auto lg:mx-0"
              />

              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4" style={{ color: "#EBEFF5" }}>
                Funding Rate{" "}
                <span className="gradient-text">Analytics</span>
              </h1>
              <p className="text-base md:text-lg max-w-xl mx-auto lg:mx-0 mb-8" style={{ color: "#9DAFCD" }}>
                Real-time analytics and tools for Pendle Boros funding rate trading
              </p>
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <Link href="/terminal">
                  <span className="inline-flex items-center px-5 py-2.5 text-sm font-medium border border-primary/50 text-primary rounded-lg hover:bg-primary/10 transition-colors cursor-pointer" data-testid="cta-explore">
                    Explore Terminal
                  </span>
                </Link>
                <a
                  href={BOROS_REFERRAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 teal-cta text-sm px-5 py-2.5 rounded-lg"
                  data-testid="cta-trade-hero"
                >
                  Trade on Boros
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right side: poster artwork */}
            <div className="flex-shrink-0 w-full max-w-xs lg:max-w-sm">
              <div
                className="w-full aspect-square rounded-2xl overflow-hidden"
                style={{
                  backgroundImage: "url('./brand/boros-poster-orbital-waves.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow: "0 0 60px rgba(27, 227, 194, 0.1), 0 0 120px rgba(96, 121, 255, 0.08)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {isLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12" data-testid="kpi-cards">
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Active Markets</p>
            <p className="text-xl font-bold tabular-nums">{activeMarkets}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground mb-1">BTC Implied APR</p>
            <p className="text-xl font-bold tabular-nums text-primary">
              {btcMarket ? formatPercent(btcMarket.impliedApr) : "—"}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground mb-1">ETH Implied APR</p>
            <p className="text-xl font-bold tabular-nums text-primary">
              {ethMarket ? formatPercent(ethMarket.impliedApr) : "—"}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
            <p className="text-xl font-bold tabular-nums">
              {totalVolume > 0 ? formatUSD(totalVolume) : "$10.5M"}
            </p>
          </div>
        </div>
      )}

      {/* Tool Cards Grid */}
      <div className="mb-8">
        <h2 className="font-display text-lg font-semibold mb-4">Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="tool-cards">
          {TOOL_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <div
                className="group bg-card border border-card-border rounded-xl p-5 cursor-pointer transition-all pendle-glow hover:bg-card/80"
                data-testid={`card-${card.href.slice(1)}`}
              >
                <card.icon className={`w-8 h-8 mb-3 ${card.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                <h3 className="text-sm font-semibold mb-1">{card.name}</h3>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
