import { useState, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { usePendleMarketList, formatUSD } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function Calculator() {
  const { data: markets, isLoading } = usePendleMarketList();
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [capital, setCapital] = useState<number>(10000);

  const sortedMarkets = useMemo(() => {
    if (!markets) return [];
    return [...markets].sort((a, b) => b.totalTvl - a.totalTvl);
  }, [markets]);

  const selectedMarket = useMemo(() => {
    if (!selectedAddress || !markets) return null;
    return markets.find((m) => m.address === selectedAddress) ?? null;
  }, [selectedAddress, markets]);

  const calculations = useMemo(() => {
    if (!selectedMarket) return null;
    const daysToMaturity = Math.ceil(
      (new Date(selectedMarket.expiry).getTime() - Date.now()) / 86400000
    );
    const fixedReturn = capital * selectedMarket.impliedApy * (daysToMaturity / 365);
    const variableReturn = capital * selectedMarket.underlyingApy * (daysToMaturity / 365);
    const dailyReturn = fixedReturn / daysToMaturity;
    const advantage = fixedReturn - variableReturn;
    return { daysToMaturity, fixedReturn, variableReturn, dailyReturn, advantage };
  }, [selectedMarket, capital]);

  return (
    <PageContainer>
      {/* Title */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Fixed Yield Calculator</h1>
        <p className="text-sm text-muted-foreground">Calculate your projected PT returns</p>
      </div>

      {/* Input card */}
      <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
        <div className="space-y-5">
          {/* Market selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Select Market
            </label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">— Choose a market —</option>
                {sortedMarkets.map((m) => (
                  <option key={`${m.chainId}-${m.address}`} value={m.address}>
                    {m.name} ({m.asset}) — {(m.impliedApy * 100).toFixed(2)}%
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Capital input */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Capital Amount
            </label>
            <div className="flex items-center border border-card-border rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary/50">
              <span className="px-3 py-2 text-sm text-muted-foreground border-r border-card-border select-none">
                $
              </span>
              <input
                type="number"
                min={0}
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground font-mono tabular-nums focus:outline-none"
                placeholder="10000"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results card */}
      {selectedMarket && calculations && (
        <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4">Projected Returns</h2>

          {/* 4-stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-background/50 border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Fixed APY</p>
              <p className="text-lg font-mono tabular-nums font-semibold text-primary">
                {(selectedMarket.impliedApy * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-background/50 border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Days to Maturity</p>
              <p className="text-lg font-mono tabular-nums font-semibold">
                {calculations.daysToMaturity}
              </p>
            </div>
            <div className="bg-background/50 border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Return</p>
              <p className="text-lg font-mono tabular-nums font-semibold text-primary">
                ${calculations.fixedReturn.toFixed(2)}
              </p>
            </div>
            <div className="bg-background/50 border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Daily Return</p>
              <p className="text-lg font-mono tabular-nums font-semibold">
                ${calculations.dailyReturn.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Comparison section */}
          <div className="border-t border-border/30 pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Fixed vs Variable Comparison
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fixed yield</span>
              <span className="font-mono tabular-nums text-sm font-semibold text-primary">
                ${calculations.fixedReturn.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Variable yield (if rate holds)
              </span>
              <span className="font-mono tabular-nums text-sm text-muted-foreground">
                ${calculations.variableReturn.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/20 pt-3">
              <span className="text-sm font-medium">
                {calculations.advantage >= 0 ? "Advantage" : "Disadvantage"}
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-semibold ${
                  calculations.advantage >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {calculations.advantage >= 0 ? "+" : "-"}$
                {Math.abs(calculations.advantage).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Market metadata */}
          <div className="border-t border-border/30 pt-4 mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              TVL:{" "}
              <span className="font-mono tabular-nums text-foreground">
                {formatUSD(selectedMarket.totalTvl)}
              </span>
            </span>
            <span>
              Expiry:{" "}
              <span className="font-mono tabular-nums text-foreground">
                {new Date(selectedMarket.expiry).toLocaleDateString()}
              </span>
            </span>
            <span>
              Chain ID:{" "}
              <span className="font-mono tabular-nums text-foreground">
                {selectedMarket.chainId}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mb-16">
        <a
          href="https://app.pendle.finance/trade/markets"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 teal-cta text-sm px-5 py-2.5 rounded-lg"
        >
          Trade on Pendle
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <StickyCTA text="Lock in fixed yields on Pendle" />
    </PageContainer>
  );
}
