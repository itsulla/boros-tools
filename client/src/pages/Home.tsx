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
                UseBoros — Powered by Pendle
              </div>

              <img
                src="./brand/boros-by-pendle-logo.svg"
                alt="UseBoros"
                className="h-14 md:h-16 w-auto mb-5 mx-auto lg:mx-0"
              />

              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4" style={{ color: "#EBEFF5" }}>
                Funding Rate{" "}
                <span className="gradient-text">Analytics</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
                UseBoros — Real-time analytics and tools for Pendle Boros funding rate trading
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
      <div className="mb-12">
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

      {/* What is Pendle */}
      <div className="mb-12" data-testid="what-is-pendle">
        <h2 className="font-display text-lg font-semibold mb-4">What is Pendle?</h2>
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <a href="https://www.pendle.finance" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Pendle</a> is a DeFi protocol that lets you <span className="text-foreground font-medium">tokenize and trade future yield</span>. Think of it like bond stripping in traditional finance — you take a yield-bearing asset (like staked ETH) and split it into two separate tokens:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-background/50 rounded-lg p-4 border border-border/30">
              <p className="text-xs font-semibold text-primary mb-1">PT — Principal Token</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Represents the principal. Buy PT at a discount, redeem it for the full underlying asset at maturity. This is how you <span className="text-foreground">lock in a fixed yield</span>.
              </p>
              <div className="mt-3 bg-background rounded p-2.5 border border-border/20">
                <p className="text-[11px] font-mono text-muted-foreground">
                  <span className="text-foreground">Example:</span> Buy PT-stETH at 5% implied APY with 1-year maturity. For every 0.95 ETH you spend, you get 1 ETH back at maturity — guaranteed 5% return.
                </p>
              </div>
            </div>
            <div className="bg-background/50 rounded-lg p-4 border border-border/30">
              <p className="text-xs font-semibold text-secondary mb-1">YT — Yield Token</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Represents the yield stream. Holding YT gives you all the yield generated by the underlying asset until maturity. This is how you <span className="text-foreground">go long on yields</span>.
              </p>
              <div className="mt-3 bg-background rounded p-2.5 border border-border/20">
                <p className="text-[11px] font-mono text-muted-foreground">
                  <span className="text-foreground">Example:</span> Buy 10 YT-stETH. You receive all the staking yield from 10 ETH until expiry. If the average APY exceeds what you paid, you profit.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Pendle's AMM is purpose-built for yield trading — it adjusts its curve as tokens approach maturity, concentrating liquidity and improving capital efficiency. LPs earn from PT fixed yield, underlying SY yield, swap fees, and PENDLE incentives. All PT and YT trades happen through a single PT/SY liquidity pool using flash swaps.
          </p>

          <div className="flex items-center gap-4 pt-1">
            <a href="https://docs.pendle.finance" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Read the docs <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://app.pendle.finance/trade/markets" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Explore markets <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* What is Boros */}
      <div className="mb-12" data-testid="what-is-boros">
        <h2 className="font-display text-lg font-semibold mb-4">What is Boros?</h2>
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <a href="https://boros.pendle.finance" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Boros</a> is Pendle's <span className="text-foreground font-medium">interest rate swap platform for perpetual funding rates</span>. While Pendle V2 handles yield from staking and lending, Boros focuses on the massive funding rate market from perpetual futures — a $150B+ daily market across Binance, Bybit, Hyperliquid, and more.
          </p>

          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <p className="text-xs font-semibold text-foreground mb-2">How it works</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">1</div>
                <p className="text-xs text-muted-foreground"><span className="text-foreground">Deposit collateral</span> into a trading zone (e.g., ETH zone). Each zone can have multiple markets sharing the same base asset.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">2</div>
                <p className="text-xs text-muted-foreground"><span className="text-foreground">Open an interest rate swap.</span> You either pay fixed and receive floating, or receive fixed and pay floating — depending on your view on where rates are heading.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">3</div>
                <p className="text-xs text-muted-foreground"><span className="text-foreground">Manage your position</span> with cross-margin or isolated margin modes. Each market has a Mark Rate (TWAP oracle) for fair unrealized P&L valuation.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[11px] font-semibold text-primary mb-1">For Yield Seekers</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Lock in a fixed funding rate via a cash-and-carry strategy: long spot + short perp + fix rate on Boros = predictable yield.</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[11px] font-semibold text-secondary mb-1">For Hedgers</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Already running a perp position? Swap your floating funding rate to fixed on Boros. Eliminate funding rate uncertainty entirely.</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[11px] font-semibold text-chart-4 mb-1">For Speculators</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Think rates will rise or fall? Go long or short on the rate itself with leverage. Pure directional exposure to funding rates.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <a href="https://boros.pendle.finance" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Trade on Boros <ExternalLink className="w-3 h-3" />
            </a>
            <Link href="/strategies">
              <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                View strategies <ExternalLink className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
