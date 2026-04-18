import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowUpDown, Search } from "lucide-react";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { usePendleMarketList, formatUSD, type PendleMarketRaw, useSparklines, sparklineKey } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useMode } from "@/lib/mode-context";
import { Sparkline } from "@/components/Sparkline";
import { EmptyState } from "@/components/ui/empty-state";

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

const CHAIN_FILTERS = ["All", "Ethereum", "Arbitrum", "BSC", "Base"];

const TVL_OPTIONS: { label: string; value: number }[] = [
  { label: "$0", value: 0 },
  { label: "$100K", value: 100_000 },
  { label: "$1M", value: 1_000_000 },
  { label: "$5M", value: 5_000_000 },
  { label: "$10M", value: 10_000_000 },
];

type SortField =
  | "name"
  | "chain"
  | "asset"
  | "impliedApy"
  | "underlyingApy"
  | "spread"
  | "tvl"
  | "liquidity"
  | "daysToMaturity";

function daysUntil(expiry: string): number {
  const now = Date.now();
  const exp = new Date(expiry).getTime();
  return Math.max(0, Math.floor((exp - now) / (1000 * 60 * 60 * 24)));
}

function pct(val: number): string {
  return `${(val * 100).toFixed(2)}%`;
}

const SCREENER_COLUMNS = [
  { id: "name", label: "Market", mode: "both" as const, sortable: true, field: "name" as SortField },
  { id: "chain", label: "Chain", mode: "both" as const, sortable: true, field: "chain" as SortField },
  { id: "asset", label: "Asset", mode: "both" as const, sortable: true, field: "asset" as SortField },
  { id: "impliedApy", label: "Impl APY", mode: "both" as const, sortable: true, field: "impliedApy" as SortField },
  { id: "underlyingApy", label: "Under APY", mode: "advanced" as const, sortable: true, field: "underlyingApy" as SortField },
  { id: "spread", label: "Spread", mode: "advanced" as const, sortable: true, field: "spread" as SortField },
  { id: "tvl", label: "TVL", mode: "both" as const, sortable: true, field: "tvl" as SortField },
  { id: "liquidity", label: "Liquidity", mode: "advanced" as const, sortable: true, field: "liquidity" as SortField },
  { id: "daysToMaturity", label: "Days", mode: "advanced" as const, sortable: true, field: "daysToMaturity" as SortField },
  { id: "trend", label: "Trend", mode: "both" as const, sortable: false, field: null },
];

export default function Screener() {
  const { data: markets, isLoading } = usePendleMarketList();
  const { mode } = useMode();
  const { data: sparklines } = useSparklines();

  const visibleColumns = SCREENER_COLUMNS.filter(c => c.mode === "both" || c.mode === mode);

  const [search, setSearch] = useState("");
  const [chainFilter, setChainFilter] = useState("All");
  const [minTvl, setMinTvl] = useState(0);
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortField, setSortField] = useState<SortField>("impliedApy");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    if (!markets) return [];
    let list = markets as PendleMarketRaw[];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }

    if (chainFilter !== "All") {
      list = list.filter((m) => chainName(m.chainId) === chainFilter);
    }

    if (minTvl > 0) {
      list = list.filter((m) => m.totalTvl >= minTvl);
    }

    if (activeOnly) {
      const now = Date.now();
      list = list.filter((m) => new Date(m.expiry).getTime() > now);
    }

    list = [...list].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      switch (sortField) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "chain":
          av = chainName(a.chainId).toLowerCase();
          bv = chainName(b.chainId).toLowerCase();
          break;
        case "asset":
          av = a.asset.toLowerCase();
          bv = b.asset.toLowerCase();
          break;
        case "impliedApy":
          av = a.impliedApy;
          bv = b.impliedApy;
          break;
        case "underlyingApy":
          av = a.underlyingApy;
          bv = b.underlyingApy;
          break;
        case "spread":
          av = a.impliedApy - a.underlyingApy;
          bv = b.impliedApy - b.underlyingApy;
          break;
        case "tvl":
          av = a.totalTvl;
          bv = b.totalTvl;
          break;
        case "liquidity":
          av = a.liquidity;
          bv = b.liquidity;
          break;
        case "daysToMaturity":
          av = daysUntil(a.expiry);
          bv = daysUntil(b.expiry);
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });

    return list;
  }, [markets, search, chainFilter, minTvl, activeOnly, sortField, sortDir]);

  function SortHeader({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <th
        className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${className ?? ""}`}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <ArrowUpDown
            className={`w-3 h-3 flex-shrink-0 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`}
          />
        </span>
      </th>
    );
  }

  return (
    <PageContainer>
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">APY Screener</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Filter and sort all Pendle V2 markets
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-card-border rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search markets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-52"
            />
          </div>

          {/* Chain filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {CHAIN_FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => setChainFilter(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  chainFilter === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Min TVL */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Min TVL:</span>
            {TVL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMinTvl(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  minTvl === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Active only toggle */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto">
            <span className="text-xs text-muted-foreground">Active only</span>
            <button
              role="switch"
              aria-checked={activeOnly}
              onClick={() => setActiveOnly((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                activeOnly ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                  activeOnly ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground mb-3">
        {isLoading ? "Loading…" : `${filtered.length} markets`}
      </p>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden overflow-x-auto mb-8">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-border/20 bg-white/[0.02]">
            <tr>
              {visibleColumns.map(c => {
                if (!c.sortable || c.field === null) {
                  return (
                    <th key={c.id} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {c.label}
                    </th>
                  );
                }
                const rightAlign = ["impliedApy", "underlyingApy", "spread", "tvl", "liquidity", "daysToMaturity"].includes(c.id);
                return (
                  <SortHeader key={c.id} field={c.field} className={rightAlign ? "text-right" : ""}>
                    {c.label}
                  </SortHeader>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10">
                    {Array.from({ length: visibleColumns.length }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((market) => {
                  const spread = market.impliedApy - market.underlyingApy;
                  const days = daysUntil(market.expiry);
                  const hasPoints = market.categoryIds?.includes("points");

                  return (
                    <tr
                      key={`${market.chainId}-${market.address}`}
                      className="border-b border-border/10 hover:bg-white/[0.04] transition-colors duration-150"
                    >
                      {visibleColumns.map(c => {
                        switch (c.id) {
                          case "name":
                            return (
                              <td key={c.id} className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-foreground font-medium text-xs leading-snug">{market.name}</span>
                                  {hasPoints && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium bg-primary/10 text-primary border-primary/30">Points</span>
                                  )}
                                  {market.isNew && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium bg-blue-500/10 text-blue-400 border-blue-500/30">New</span>
                                  )}
                                </div>
                              </td>
                            );
                          case "chain":
                            return <td key={c.id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{chainName(market.chainId)}</td>;
                          case "asset":
                            return <td key={c.id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{market.asset}</td>;
                          case "impliedApy":
                            return <td key={c.id} className="px-4 py-3 text-right font-mono tabular-nums text-xs text-secondary whitespace-nowrap">{pct(market.impliedApy)}</td>;
                          case "underlyingApy":
                            return <td key={c.id} className="px-4 py-3 text-right font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">{pct(market.underlyingApy)}</td>;
                          case "spread":
                            return (
                              <td key={c.id} className={`px-4 py-3 text-right font-mono tabular-nums text-xs whitespace-nowrap ${spread >= 0 ? "text-secondary" : "text-destructive"}`}>
                                {spread >= 0 ? "+" : ""}{pct(spread)}
                              </td>
                            );
                          case "tvl":
                            return <td key={c.id} className="px-4 py-3 text-right font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatUSD(market.totalTvl)}</td>;
                          case "liquidity":
                            return <td key={c.id} className="px-4 py-3 text-right font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatUSD(market.liquidity)}</td>;
                          case "daysToMaturity":
                            return (
                              <td key={c.id} className={`px-4 py-3 text-right font-mono tabular-nums text-xs whitespace-nowrap ${days <= 7 ? "text-destructive" : days <= 30 ? "text-yellow-400" : "text-muted-foreground"}`}>
                                {days}d
                              </td>
                            );
                          case "trend": {
                            const key = sparklineKey(market.chainId, market.address);
                            const points = sparklines?.[key];
                            return (
                              <td key={c.id} className="px-4 py-3">
                                <Link href="/history">
                                  <span className="cursor-pointer inline-block"><Sparkline data={points ?? []} /></span>
                                </Link>
                              </td>
                            );
                          }
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-0 py-0">
                  <EmptyState
                    icon={<Search className="w-5 h-5" />}
                    title="No markets match your filters"
                    description="Try lowering the minimum TVL or selecting a different chain."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <StickyCTA text="Find the best yields on Pendle" />
    </PageContainer>
  );
}
