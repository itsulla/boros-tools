import { useState } from "react";
import { ArrowRight, AlertCircle, CheckCircle2, Minus } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { useFundingRates, useBorosMarkets, formatPercent } from "@/lib/api";
import { DEMO_BOROS_RATES } from "@/lib/demo-data";
import { Skeleton } from "@/components/ui/skeleton";

const ASSETS = ["BTC", "ETH", "SOL"] as const;

function getArbColor(spread: number) {
  if (Math.abs(spread) >= 2) return "text-primary";
  if (Math.abs(spread) >= 1) return "text-chart-4";
  return "text-muted-foreground";
}

function getArbBadge(spread: number) {
  if (Math.abs(spread) >= 2) return { text: "Strong", color: "bg-primary/10 text-primary border-primary/30" };
  if (Math.abs(spread) >= 1) return { text: "Marginal", color: "bg-chart-4/10 text-chart-4 border-chart-4/30" };
  return { text: "Low", color: "bg-muted text-muted-foreground border-border/30" };
}

export default function Arbitrage() {
  const [selectedAsset, setSelectedAsset] = useState<string>("BTC");
  const { data: fundingRates, isLoading: ratesLoading } = useFundingRates();
  const { data: markets } = useBorosMarkets();

  const borosRates: Record<string, number> = {};
  if (markets) {
    for (const m of markets) {
      borosRates[m.underlying] = m.impliedApr;
    }
  }
  // Merge with demo defaults
  const effectiveBorosRates = { ...DEMO_BOROS_RATES, ...borosRates };

  const filteredRates = fundingRates?.filter((r) => r.symbol === selectedAsset) ?? [];
  const borosImplied = effectiveBorosRates[selectedAsset] ?? 0;

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Arbitrage Scanner</h1>
        <p className="text-sm text-muted-foreground">Cross-exchange funding rate comparison & arbitrage opportunities</p>
      </div>

      {/* Asset tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-card-border rounded-lg p-1 w-fit" data-testid="asset-tabs">
        {ASSETS.map((asset) => (
          <button
            key={asset}
            onClick={() => setSelectedAsset(asset)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              selectedAsset === asset
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${asset}`}
          >
            {asset}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium text-xs">Exchange</th>
                <th className="text-left py-3 px-4 font-medium text-xs">Symbol</th>
                <th className="text-right py-3 px-4 font-medium text-xs">Current Rate (Ann.)</th>
                <th className="text-right py-3 px-4 font-medium text-xs">7d Average</th>
                <th className="text-right py-3 px-4 font-medium text-xs">Boros Implied</th>
                <th className="text-right py-3 px-4 font-medium text-xs">Spread vs Boros</th>
                <th className="text-center py-3 px-4 font-medium text-xs">Arb Opportunity</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {ratesLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-border/10">
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : (
                filteredRates.map((rate, i) => {
                  const spread = borosImplied - rate.annualizedRate;
                  const badge = getArbBadge(spread);
                  return (
                    <tr key={i} className="border-b border-border/10 hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-sans font-medium">{rate.exchange}</td>
                      <td className="py-3 px-4 text-muted-foreground">{rate.symbol}USDT</td>
                      <td className="py-3 px-4 text-right tabular-nums">{formatPercent(rate.annualizedRate)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{formatPercent(rate.avg7d)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-primary">{formatPercent(borosImplied)}</td>
                      <td className={`py-3 px-4 text-right tabular-nums ${getArbColor(spread)}`}>
                        {formatPercent(spread)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                          {Math.abs(spread) >= 2 ? <CheckCircle2 className="w-3 h-3" /> : Math.abs(spread) >= 1 ? <AlertCircle className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* How Arbitrage Works */}
      <div className="bg-card border border-card-border rounded-xl p-6 mb-16" data-testid="arb-explainer">
        <h3 className="text-base font-semibold mb-4">How Funding Rate Arbitrage Works</h3>
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          {[
            { step: "1", title: "Identify Spread", desc: "Find an exchange where funding rates differ from Boros implied rates" },
            { step: "2", title: "Open Positions", desc: "Go long where rates are low, short where they're high" },
            { step: "3", title: "Lock Rate on Boros", desc: "Fix your funding rate on Boros to eliminate floating risk" },
          ].map((s, i) => (
            <div key={i} className="flex-1 flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full teal-cta text-sm font-bold">
                {s.step}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {i < 2 && <ArrowRight className="hidden md:block w-5 h-5 text-muted-foreground/40 self-center flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <StickyCTA text="Capture funding rate arbitrage on Boros" />
    </PageContainer>
  );
}
