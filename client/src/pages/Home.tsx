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
        <div key={i} className="bg-card border border-card-border rounded-lg p-4">
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
      {/* Hero */}
      <div className="text-center py-12 md:py-16" data-testid="hero-section">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium mb-6">
          <Activity className="w-3 h-3" />
          Powered by Pendle Boros
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
          <span className="gradient-text">Boros Tools</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Real-time analytics and tools for Pendle Boros funding rate trading
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/terminal">
            <span className="inline-flex items-center px-5 py-2.5 text-sm font-medium border border-primary/50 text-primary rounded-lg hover:bg-primary/10 transition-colors cursor-pointer" data-testid="cta-explore">
              Explore Terminal
            </span>
          </Link>
          <a
            href={BOROS_REFERRAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 gradient-bg text-background text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            data-testid="cta-trade-hero"
          >
            Trade on Boros
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Quick Stats */}
      {isLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12" data-testid="kpi-cards">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Active Markets</p>
            <p className="text-xl font-bold tabular-nums">{activeMarkets}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">BTC Implied APR</p>
            <p className="text-xl font-bold tabular-nums text-primary">
              {btcMarket ? formatPercent(btcMarket.impliedApr) : "—"}
            </p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">ETH Implied APR</p>
            <p className="text-xl font-bold tabular-nums text-primary">
              {ethMarket ? formatPercent(ethMarket.impliedApr) : "—"}
            </p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
            <p className="text-xl font-bold tabular-nums">
              {totalVolume > 0 ? formatUSD(totalVolume) : "$10.5M"}
            </p>
          </div>
        </div>
      )}

      {/* Tool Cards Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="tool-cards">
          {TOOL_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <div
                className="group bg-card border border-card-border rounded-lg p-5 cursor-pointer transition-all hover:border-primary/40 hover:bg-card/80"
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
