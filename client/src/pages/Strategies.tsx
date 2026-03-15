import { useState } from "react";
import { ArrowRight, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { useBorosMarkets, formatPercent } from "@/lib/api";
import { BOROS_REFERRAL_URL } from "@/lib/constants";

interface Strategy {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  risk: "Low" | "Medium" | "High";
  steps: { action: string; detail: string }[];
  who: string;
  expectedReturn: string;
}

const STRATEGIES: Strategy[] = [
  {
    id: "cash-carry",
    title: "Cash & Carry Arbitrage",
    description: "Earn fixed yield by going long spot + short perp + fix funding on Boros",
    difficulty: "Advanced",
    risk: "Low",
    steps: [
      { action: "Buy Spot ETH", detail: "Purchase ETH on spot market" },
      { action: "Short ETH Perp", detail: "Open short perpetual futures position" },
      { action: "Short YU on Boros", detail: "Lock in your funding rate to fix yield" },
    ],
    who: "Yield seekers, conservative traders, institutions",
    expectedReturn: "5-15% APR (depending on spread)",
  },
  {
    id: "hedge",
    title: "Funding Rate Hedging",
    description: "Protect your perp position from funding rate volatility",
    difficulty: "Intermediate",
    risk: "Low",
    steps: [
      { action: "Have Existing Long Perp", detail: "Your current perpetual futures position" },
      { action: "Long YU on Boros", detail: "Receive floating, pay fixed funding rate" },
      { action: "Net Zero Floating", detail: "Floating cancels out — predictable cost" },
    ],
    who: "Large perp traders, market makers, funds",
    expectedReturn: "Eliminates funding rate uncertainty",
  },
  {
    id: "long-spec",
    title: "Rate Speculation (Long)",
    description: "Bet that funding rates will go up",
    difficulty: "Intermediate",
    risk: "High",
    steps: [
      { action: "Pay Fixed Rate", detail: "Lock in a fixed rate payment on Boros" },
      { action: "Receive Floating", detail: "Receive the variable funding rate" },
      { action: "Profit if Rates Rise", detail: "Profit = (floating - fixed) × notional" },
    ],
    who: "Traders with strong directional views on rates",
    expectedReturn: "Unlimited upside if rates surge",
  },
  {
    id: "short-spec",
    title: "Rate Speculation (Short)",
    description: "Bet that funding rates will decline",
    difficulty: "Intermediate",
    risk: "High",
    steps: [
      { action: "Receive Fixed Rate", detail: "Lock in a fixed rate income on Boros" },
      { action: "Pay Floating", detail: "Pay the variable funding rate" },
      { action: "Profit if Rates Drop", detail: "Profit = (fixed - floating) × notional" },
    ],
    who: "Contrarian traders expecting market cooldown",
    expectedReturn: "Profit if rates decline below fixed",
  },
];

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-primary/10 text-primary border-primary/30",
    Intermediate: "bg-chart-4/10 text-chart-4 border-chart-4/30",
    Advanced: "bg-secondary/10 text-secondary border-secondary/30",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[level] ?? ""}`}>
      {level}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Low: "bg-primary/10 text-primary border-primary/30",
    Medium: "bg-chart-4/10 text-chart-4 border-chart-4/30",
    High: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[level] ?? ""}`}>
      {level} Risk
    </span>
  );
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const [expanded, setExpanded] = useState(false);
  const { data: markets } = useBorosMarkets();
  const btcMarket = markets?.find((m) => m.underlying === "BTC");
  const ethMarket = markets?.find((m) => m.underlying === "ETH");

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden" data-testid={`strategy-${strategy.id}`}>
      {/* Header */}
      <div
        className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <DifficultyBadge level={strategy.difficulty} />
              <RiskBadge level={strategy.risk} />
            </div>
            <h3 className="text-base font-semibold mb-1">{strategy.title}</h3>
            <p className="text-sm text-muted-foreground">{strategy.description}</p>
          </div>
          <button className="text-muted-foreground p-1 flex-shrink-0">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/30 p-5 space-y-5">
          {/* Flow diagram */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Steps</h4>
            <div className="flex flex-col md:flex-row items-stretch gap-2">
              {strategy.steps.map((step, i) => (
                <div key={i} className="flex-1 flex items-start gap-2">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full gradient-bg text-background text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    {i < strategy.steps.length - 1 && (
                      <div className="w-px h-6 bg-border/50 md:hidden" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium">{step.action}</p>
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                  {i < strategy.steps.length - 1 && (
                    <ArrowRight className="hidden md:block w-4 h-4 text-muted-foreground/40 self-center flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current opportunity */}
          <div className="bg-background/50 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Opportunity</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">BTC Implied APR</p>
                <p className="text-sm font-bold tabular-nums text-primary">
                  {btcMarket ? formatPercent(btcMarket.impliedApr) : "+12.45%"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">ETH Implied APR</p>
                <p className="text-sm font-bold tabular-nums text-primary">
                  {ethMarket ? formatPercent(ethMarket.impliedApr) : "+8.72%"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Expected Return</p>
                <p className="text-sm font-bold">{strategy.expectedReturn}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Best For</p>
                <p className="text-sm text-muted-foreground">{strategy.who}</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <a
            href={BOROS_REFERRAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 gradient-bg text-background text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            data-testid={`cta-${strategy.id}`}
          >
            Try this strategy on Boros
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function Strategies() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Strategy Hub</h1>
        <p className="text-sm text-muted-foreground">Interactive guides for every Boros funding rate strategy</p>
      </div>

      <div className="space-y-4 mb-16" data-testid="strategy-list">
        {STRATEGIES.map((strategy) => (
          <StrategyCard key={strategy.id} strategy={strategy} />
        ))}
      </div>

      <StickyCTA text="Find the right strategy for your portfolio" />
    </PageContainer>
  );
}
