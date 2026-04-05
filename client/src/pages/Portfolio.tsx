import { useState, useMemo, useEffect } from "react";
import { ExternalLink, AlertTriangle, Plus, X, Share2, Check } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { usePendleMarketList, formatUSD, type PendleMarketRaw } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  42161: "Arbitrum",
  56: "BSC",
  8453: "Base",
  10: "Optimism",
  5000: "Mantle",
  146: "Sonic",
  534352: "Scroll",
  81457: "Blast",
  59144: "Linea",
};

function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

function classifyAsset(m: PendleMarketRaw): "stables" | "eth" | "btc" | "other" {
  const cats = m.categoryIds ?? [];
  if (cats.includes("stables")) return "stables";
  if (cats.includes("eth")) return "eth";
  if (cats.includes("btc")) return "btc";
  return "other";
}

function scoreMarket(m: PendleMarketRaw, maxTvl: number): number {
  const daysToMaturity = Math.max(0, Math.ceil((new Date(m.expiry).getTime() - Date.now()) / 86400000));
  if (daysToMaturity <= 0) return -1;
  const normalizedTvl = maxTvl > 0 ? Math.log10(Math.max(m.totalTvl, 1)) / Math.log10(maxTvl) : 0;
  const maturityFactor = Math.min(daysToMaturity, 365) / 365;
  return (m.impliedApy * 0.6) + (normalizedTvl * 0.3) + (maturityFactor * 0.1);
}

function autoAllocate(markets: PendleMarketRaw[], investment: number, maxPools: number): { market: PendleMarketRaw; allocation: number; weight: number }[] {
  if (markets.length === 0) return [];
  const capped = markets.slice(0, maxPools);
  const maxAlloc = 1 / Math.max(maxPools, 1); // equal max weight per pool
  const result: { market: PendleMarketRaw; allocation: number; weight: number }[] = [];
  let remaining = investment;

  for (const m of capped) {
    if (remaining <= 0) break;
    const maxForThis = investment * maxAlloc;
    const alloc = Math.min(remaining, maxForThis);
    result.push({ market: m, allocation: alloc, weight: alloc / investment });
    remaining -= alloc;
  }

  // If still remaining (e.g., all markets hit 40%), distribute evenly across existing
  if (remaining > 0 && result.length > 0) {
    const extra = remaining / result.length;
    for (const r of result) {
      r.allocation += extra;
      r.weight = r.allocation / investment;
    }
  }

  return result;
}

export default function Portfolio() {
  const [mode, setMode] = useState<"auto" | "advanced">("auto");
  const [investment, setInvestment] = useState(10000);
  const [assetClass, setAssetClass] = useState<"stables" | "eth" | "btc" | "all">("all");
  const [maxPools, setMaxPools] = useState(3);
  const [minTvl, setMinTvl] = useState(1_000_000);
  // Advanced mode
  const [manualPositions, setManualPositions] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const searchPart = hash.split("?")[1];
    if (!searchPart) return;
    const params = new URLSearchParams(searchPart);

    if (params.get("inv")) setInvestment(Number(params.get("inv")));
    if (params.get("ac")) setAssetClass(params.get("ac") as any);
    if (params.get("tvl")) setMinTvl(Number(params.get("tvl")));
    if (params.get("pools")) setMaxPools(Number(params.get("pools")));
    if (params.get("mode")) setMode(params.get("mode") as any);
    if (params.get("pos")) {
      const positions = new Map<string, number>();
      params.get("pos")!.split(",").forEach(p => {
        const [addr, amt] = p.split(":");
        if (addr && amt) positions.set(addr, Number(amt));
      });
      setManualPositions(positions);
    }
  }, []); // run once on mount

  function generateShareUrl(): string {
    const params = new URLSearchParams();
    params.set("inv", String(investment));
    params.set("ac", assetClass);
    params.set("tvl", String(minTvl));
    params.set("mode", mode);
    if (mode === "auto") {
      params.set("pools", String(maxPools));
    } else if (manualPositions.size > 0) {
      const posStr = Array.from(manualPositions.entries())
        .map(([addr, amt]) => `${addr}:${amt}`)
        .join(",");
      params.set("pos", posStr);
    }
    return `${window.location.origin}${window.location.pathname}#/portfolio?${params}`;
  }

  function handleShare() {
    const url = generateShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data: markets, isLoading } = usePendleMarketList();

  const filteredMarkets = useMemo(() => {
    if (!markets) return [];
    return markets.filter(m => {
      const daysToMaturity = Math.ceil((new Date(m.expiry).getTime() - Date.now()) / 86400000);
      if (daysToMaturity <= 0) return false;
      if (m.totalTvl < minTvl) return false;
      if (assetClass !== "all" && classifyAsset(m) !== assetClass) return false;
      return true;
    });
  }, [markets, assetClass, minTvl]);

  const autoResult = useMemo(() => {
    if (mode !== "auto" || filteredMarkets.length === 0) return [];
    const maxTvl = Math.max(...filteredMarkets.map(m => m.totalTvl));
    const scored = filteredMarkets
      .map(m => ({ market: m, score: scoreMarket(m, maxTvl) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return autoAllocate(scored.map(s => s.market), investment, maxPools);
  }, [mode, filteredMarkets, investment, maxPools]);

  // For advanced mode
  const advancedResult = useMemo(() => {
    if (mode !== "advanced" || !markets) return [];
    return Array.from(manualPositions.entries())
      .map(([address, alloc]) => {
        const market = markets.find(m => m.address === address);
        if (!market) return null;
        return { market, allocation: alloc, weight: alloc / investment };
      })
      .filter(Boolean) as { market: PendleMarketRaw; allocation: number; weight: number }[];
  }, [mode, markets, manualPositions, investment]);

  const activeResult = mode === "auto" ? autoResult : advancedResult;

  const blendedApy = useMemo(() => {
    if (activeResult.length === 0) return 0;
    const totalAllocated = activeResult.reduce((s, r) => s + r.allocation, 0);
    if (totalAllocated === 0) return 0;
    return activeResult.reduce((s, r) => s + r.market.impliedApy * r.allocation, 0) / totalAllocated;
  }, [activeResult]);

  const annualReturn = investment * blendedApy;
  const monthlyReturn = annualReturn / 12;

  return (
    <PageContainer>
      {/* Title */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Portfolio Strategy Engine</h1>
        <p className="text-muted-foreground text-sm mt-1">Model your Pendle yield portfolio</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-card border border-card-border rounded-lg p-1 w-fit mb-6">
        <button onClick={() => setMode("auto")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "auto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Auto</button>
        <button onClick={() => setMode("advanced")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "advanced" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Advanced</button>
      </div>

      {/* Inputs card */}
      <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
        {/* Investment amount */}
        <label className="block text-sm font-medium text-muted-foreground mb-2">Investment Amount</label>
        <div className="relative w-full max-w-xs mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <input type="number" value={investment} onChange={e => setInvestment(Math.max(0, Number(e.target.value)))} className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {/* Asset class filter */}
        <label className="block text-sm font-medium text-muted-foreground mb-2">Asset Class</label>
        <div className="flex gap-1 bg-background border border-border rounded-lg p-1 w-fit mb-6">
          {(["all", "stables", "eth", "btc"] as const).map(ac => (
            <button key={ac} onClick={() => setAssetClass(ac)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${assetClass === ac ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {ac === "all" ? "All" : ac === "stables" ? "Stablecoins" : ac.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Min TVL filter */}
        <label className="block text-sm font-medium text-muted-foreground mb-2">Minimum TVL: {formatUSD(minTvl)}</label>
        <input type="range" min={100000} max={50000000} step={100000} value={minTvl} onChange={e => setMinTvl(Number(e.target.value))} className="w-full max-w-xs accent-primary" />

        {/* Number of pools (auto mode only) */}
        {mode === "auto" && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Number of Pools: {maxPools}</label>
            <div className="flex gap-1 bg-background border border-border rounded-lg p-1 w-fit">
              {[2, 3, 5, 8, 10].map(n => (
                <button key={n} onClick={() => setMaxPools(n)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${maxPools === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced mode: market picker */}
      {mode === "advanced" && (
        <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">Add Markets</label>
          <input type="text" placeholder="Search markets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-primary" />

          {/* Available markets list */}
          <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
            {filteredMarkets
              .filter(m => !manualPositions.has(m.address))
              .filter(m => !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.asset.toLowerCase().includes(searchTerm.toLowerCase()))
              .slice(0, 20)
              .map(m => (
                <button key={m.address} onClick={() => { const newMap = new Map(manualPositions); newMap.set(m.address, 0); setManualPositions(newMap); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/[0.03] rounded-lg transition-colors">
                  <span>{m.name} <span className="text-muted-foreground">({m.asset})</span></span>
                  <span className="flex items-center gap-2">
                    <span className="text-primary font-mono text-xs">{(m.impliedApy * 100).toFixed(2)}%</span>
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </span>
                </button>
              ))}
          </div>

          {/* Selected positions */}
          {manualPositions.size > 0 && (
            <div className="border-t border-border/30 pt-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium mb-2">
                Selected ({manualPositions.size}) — Remaining: {formatUSD(Math.max(0, investment - Array.from(manualPositions.values()).reduce((s, v) => s + v, 0)))}
              </p>
              {Array.from(manualPositions.entries()).map(([address, alloc]) => {
                const market = markets?.find(m => m.address === address);
                if (!market) return null;
                const overConcentrated = investment > 0 && alloc / investment > 0.4;
                return (
                  <div key={address} className="flex items-center gap-2">
                    <span className="text-sm flex-1 truncate">{market.name}</span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <input type="number" value={alloc || ""} onChange={e => { const newMap = new Map(manualPositions); newMap.set(address, Math.max(0, Number(e.target.value))); setManualPositions(newMap); }} className={`w-full pl-5 pr-2 py-1 bg-background border rounded text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary ${overConcentrated ? "border-destructive" : "border-border"}`} />
                    </div>
                    <button onClick={() => { const newMap = new Map(manualPositions); newMap.delete(address); setManualPositions(newMap); }} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Concentration warning */}
          {advancedResult.some(r => r.weight > 0.4) && (
            <div className="mt-3 flex items-start gap-2 text-xs text-chart-4 bg-chart-4/5 border border-chart-4/20 rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>High concentration: {advancedResult.filter(r => r.weight > 0.4).map(r => `${r.market.name} is ${(r.weight * 100).toFixed(0)}%`).join(", ")} of your portfolio</span>
            </div>
          )}
        </div>
      )}

      {/* Results section */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : activeResult.length > 0 ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Blended APY</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary">{(blendedApy * 100).toFixed(2)}%</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Projected Annual Return</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary">{formatUSD(annualReturn)}</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Projected Monthly Return</p>
              <p className="text-2xl font-bold font-mono tabular-nums">{formatUSD(monthlyReturn)}</p>
            </div>
          </div>

          {/* Share button */}
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary/30 text-primary rounded-lg hover:bg-primary/10 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Link copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3 h-3" />
                  Share portfolio
                </>
              )}
            </button>
          </div>

          {/* Allocation table */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Market</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Chain</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Asset</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Allocation</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Weight</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">APY</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Return</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Maturity</th>
                  </tr>
                </thead>
                <tbody>
                  {activeResult.map(({ market: m, allocation, weight }) => {
                    const daysToMaturity = Math.ceil((new Date(m.expiry).getTime() - Date.now()) / 86400000);
                    const projectedReturn = allocation * m.impliedApy * (daysToMaturity / 365);
                    return (
                      <tr key={m.address} className="border-b border-border/10 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            {m.name}
                            {m.totalTvl < 1_000_000 && <span className="bg-chart-4/10 text-chart-4 border border-chart-4/30 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">Low Liquidity</span>}
                            {daysToMaturity < 14 && <span className="bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">Near Expiry</span>}
                            {m.categoryIds?.includes("points") && <span className="bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">Points</span>}
                            {m.isNew && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">New</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{chainName(m.chainId)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{classifyAsset(m) === "stables" ? "Stablecoin" : classifyAsset(m) === "eth" ? "ETH" : classifyAsset(m) === "btc" ? "BTC" : m.asset}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{formatUSD(allocation)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{(weight * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-primary">{(m.impliedApy * 100).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-primary">{formatUSD(projectedReturn)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{daysToMaturity}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center text-muted-foreground text-sm mb-6">
          {mode === "auto" ? "No markets match your filters. Try lowering the minimum TVL or selecting a different asset class." : "Add markets above to build your portfolio."}
        </div>
      )}

      {/* Risk disclaimer */}
      <div className="bg-card border border-destructive/30 rounded-xl p-4 flex items-start gap-3 mb-6">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground mb-1">Risk Disclaimer</p>
          <p>This is a projection tool, not financial advice. PT yields are fixed only if held to maturity — early exit may result in losses. Returns depend on protocol risk, smart contract risk, and market conditions. Smaller pools carry higher liquidity risk. Always DYOR.</p>
        </div>
      </div>

      {/* CTA */}
      <a href="https://app.pendle.finance/trade/markets" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        Build your portfolio on Pendle <ExternalLink className="w-3.5 h-3.5" />
      </a>

      <StickyCTA text="Build your portfolio on Pendle" />
    </PageContainer>
  );
}
