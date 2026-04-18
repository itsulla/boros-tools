# Page Polish — Phase 3 Design

**Date:** 2026-04-18
**Project:** boros-tools (boros.lekker.design)
**Status:** Approved — Phase 3 of a 3-phase redesign
**Depends on:** Phase 1 (Simple/Advanced mode), Phase 2 (Home Command Center + `market_snapshots` table)

---

## Background

Phases 1 and 2 rebuilt navigation and the home page around the Simple/Advanced toggle. The 13 other pages still render identically in both modes — Simple mode doesn't actually simplify anything outside the home and nav. Tables are functional but flat (no inline trend visualization). Empty states are plain text. The site works, but it doesn't *feel* like a polished product.

Phase 3 addresses this with four focused improvements: sparklines in tables, mode-aware column visibility, reusable empty state component, and subtle hover animations. Scope is deliberately tight — we target only the high-traffic pages where polish matters most.

---

## Goals

1. Add inline sparkline charts to data tables so users can scan APY trends without clicking
2. Honor the Simple/Advanced toggle in data tables by hiding/showing columns based on mode
3. Replace plain-text empty states with a consistent `<EmptyState>` component
4. Add subtle hover polish to tool cards, table rows, and primary buttons

## Non-Goals

- Full page transitions / route animations (deferred — risk of making the app feel slower)
- Scale transforms, bouncy animations, pulsing effects (we're a data tool, not a storefront)
- Polish on Terminal, Arbitrage, Simulator, Heatmap, Compare, sPENDLE, Portfolio, History — their layouts are already tuned for their specific purpose; changing them risks regression
- Any new data sources — everything uses existing sync infrastructure
- Cross-chain sparkline comparisons or multi-market overlays

---

## Architecture

### Sparkline data source

Reuses the `market_snapshots` table added in Phase 2. No new data collection, no new sync logic. After running for ~30 days, each market will have up to 30 daily APY data points — ideal for a sparkline.

A single bulk endpoint returns all sparklines for all markets in one response, keyed by a composite `"{chainId}:{address}"` string. This avoids the N+1 query pattern where each row triggers its own fetch.

### Component composition

Three new low-level primitives added under `components/`:

- `Sparkline.tsx` — a tiny SVG polyline component, no chart library. Renders in 60×20px.
- `ui/empty-state.tsx` — a reusable card component for "no data" situations.
- (The hover polish is pure CSS — no new components.)

These are consumed by existing page components without structural rewrites. Each table page gets a small refactor to filter its column list by `useMode()` and slot the sparkline into a new "Trend" column.

---

## Backend Changes

### New endpoint: `GET /api/pendle/sparklines`

**Query params:**
- `lookbackDays` — integer, default 30, max 30

**Response shape:**

```typescript
type SparklineMap = Record<string, { date: string; apy: number }[]>;
// key format: `${chainId}:${address}`
```

**Implementation (add to `server/routes.ts`):**

```typescript
app.get("/api/pendle/sparklines", (req, res) => {
  try {
    const lookbackDays = Math.min(parseInt(String(req.query.lookbackDays ?? "30"), 10), 30);
    const rows = db.prepare(`
      SELECT chainId, address, snapshotDate, impliedApy
      FROM market_snapshots
      WHERE snapshotDate >= date('now', ?)
      ORDER BY chainId, address, snapshotDate
    `).all(`-${lookbackDays} days`) as { chainId: number; address: string; snapshotDate: string; impliedApy: number | null }[];

    const map: Record<string, { date: string; apy: number }[]> = {};
    for (const r of rows) {
      const key = `${r.chainId}:${r.address}`;
      if (!map[key]) map[key] = [];
      map[key].push({ date: r.snapshotDate, apy: r.impliedApy ?? 0 });
    }
    res.json(map);
  } catch (err) {
    console.error("[pendle-routes] /api/pendle/sparklines error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

No new DB schema. No new sync logic. No new npm dependencies.

---

## Frontend: New Components

### `client/src/components/Sparkline.tsx`

A pure-SVG sparkline — no Recharts dependency (too heavy for 60px).

```tsx
interface SparklineProps {
  data: { date: string; apy: number }[];
  width?: number;   // default 60
  height?: number;  // default 20
  className?: string;
}
```

**Rendering logic:**
- If `data.length < 2`, render a thin horizontal dash (we don't have enough points yet)
- Compute min/max APY across the data
- Normalize points to fit `(padding, padding)` to `(width - padding, height - padding)`
- Render as `<polyline>` with `fill="none"` and `stroke` determined by trend:
  - Last APY > first APY → `stroke="#51A69A"` (Success / secondary)
  - Last APY < first APY → `stroke="#DD5453"` (Error / destructive)
  - Equal → `stroke="#828282"` (Mono 200 / muted)
- `stroke-width="1.5"` with `stroke-linecap="round"` and `stroke-linejoin="round"`

Component is intentionally dumb — no hover tooltips, no click handlers. Parent components wrap it in a `<Link>` to the History page if navigation is desired:

```tsx
<Link href="/history"><span className="cursor-pointer inline-block"><Sparkline data={points} /></span></Link>
```

### `client/src/components/ui/empty-state.tsx`

A consistent shell for "no data" UI:

```tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  className?: string;
}
```

**Rendering:**
- Centered column layout, `py-12 px-6 text-center`
- Icon wrapped in a circle: `w-12 h-12 rounded-full bg-card border border-card-border flex items-center justify-center text-muted-foreground mb-3`
- Title: `text-sm font-medium text-foreground`
- Description: `text-xs text-muted-foreground mt-1 max-w-sm mx-auto`
- CTA (optional): rendered as a `<Link>` with standard primary-border button styling

---

## Frontend: Hook

Add to `client/src/lib/api.ts`:

```typescript
export interface SparklinePoint { date: string; apy: number; }
export type SparklineMap = Record<string, SparklinePoint[]>;

export function useSparklines() {
  return useQuery<SparklineMap>({
    queryKey: ["sparklines"],
    queryFn: () => safeFetch<SparklineMap | null>("/api/pendle/sparklines", null).then((d) => d ?? {}),
    staleTime: 300_000,
    refetchInterval: 600_000,
  });
}

// Helper for consumers
export function sparklineKey(chainId: number, address: string): string {
  return `${chainId}:${address}`;
}
```

---

## Mode-Aware Column Visibility

### Pattern

Each affected page defines column visibility as an object keyed by column id, with a `mode` property:

```typescript
const COLUMNS = [
  { id: "market",    label: "Market",    mode: "both" },
  { id: "chain",     label: "Chain",     mode: "advanced" },
  { id: "apy",       label: "APY",       mode: "both" },
  { id: "underlyingApy", label: "Underlying APY", mode: "advanced" },
  { id: "spread",    label: "Spread",    mode: "advanced" },
  { id: "tvl",       label: "TVL",       mode: "both" },
  { id: "liquidity", label: "Liquidity", mode: "advanced" },
  { id: "days",      label: "Days",      mode: "advanced" },
  { id: "trend",     label: "Trend",     mode: "both" },
] as const;

const { mode } = useMode();
const visibleColumns = COLUMNS.filter(c => c.mode === "both" || c.mode === mode);
```

Table header and body use `visibleColumns.map(...)` instead of hardcoded `<th>` / `<td>` lists. This keeps the mode logic in one place per page.

### Columns per page

**`Yields.tsx`:**

The existing Yields table has 9 columns: Protocol, Product, Asset, APY/APR, Type, Maturity, Risk, TVL, Source (external link icon). The Source column (external link to the protocol) is always shown in both modes — it is the primary action for each row. Mode-aware filtering applies to the other columns. The new "Trend" column is inserted before the "Source" action column.

| Column | Simple | Advanced |
|---|---|---|
| Protocol | — | ✓ |
| Product | ✓ | ✓ |
| Asset | ✓ | ✓ |
| APY | ✓ | ✓ |
| Type | — | ✓ |
| Maturity | — | ✓ |
| TVL | ✓ | ✓ |
| Risk | — | ✓ |
| Trend | ✓ | ✓ |
| Source | ✓ | ✓ |

**`Screener.tsx`:**

Existing Screener has 9 columns (name, chain, asset, impliedApy, underlyingApy, spread, tvl, liquidity, daysToMaturity). Adding Trend brings it to 10. Skeleton loading rows currently hardcode `{ length: 9 }` — update to use `visibleColumns.length` or match the new column count.

| Column | Simple | Advanced |
|---|---|---|
| Market | ✓ | ✓ |
| Chain | ✓ | ✓ |
| Asset | ✓ | ✓ |
| Implied APY | ✓ | ✓ |
| Underlying APY | — | ✓ |
| Spread | — | ✓ |
| TVL | ✓ | ✓ |
| Liquidity | — | ✓ |
| Days | — | ✓ |
| Trend | ✓ | ✓ |

**`Rewards.tsx`:**

The existing Rewards table has 5 columns: Market Name (with Points badge), Chain, Asset, Implied APY, TVL. The expand chevron is rendered inline inside the TVL cell — it is NOT a separate column and does not need changing. Click anywhere on the row still expands the reward breakdown.

| Column | Simple | Advanced |
|---|---|---|
| Market | ✓ | ✓ |
| Chain | — | ✓ |
| Asset | ✓ | ✓ |
| Implied APY | ✓ | ✓ |
| TVL (with inline chevron) | ✓ | ✓ |

**`Calendar.tsx` (cards, not table):**
| Field | Simple | Advanced |
|---|---|---|
| Market name | ✓ | ✓ |
| Days | ✓ | ✓ |
| APY | ✓ | ✓ |
| Chain badge | — | ✓ |
| Asset badge | — | ✓ |
| TVL | — | ✓ |
| Sparkline | ✓ | ✓ |

### Yields page note

The existing Yields page has a chart section that groups pools by protocol. That chart stays visible in both modes (removing it in Simple would leave the page feeling empty). Only table columns change.

---

## Sparkline Integration Points

| Page | Where sparkline renders | Click behavior |
|---|---|---|
| Yields | New "Trend" column at right | For Pendle V2 rows only; links to `/history` with market preselected via query param (or just `/history` if preselect is too complex) |
| Screener | New "Trend" column at right | Links to `/history` |
| Rewards | Not added — Rewards rows expand inline for richer data | N/A |
| Calendar cards | Inline below market name | Links to `/history` |
| Home AdvancedHome · TopMarketsTable | New "Trend" column | Links to `/history` |

**Data flow:**
- Page calls `useSparklines()` once
- For each row, look up `sparklineKey(chainId, address)` to get the data array
- If data missing (market not in response) → render nothing or a thin dash
- If data has < 2 points → render thin dash
- Otherwise render `<Sparkline data={points} />`

**Edge case:** Yields page has rows from both Pendle V2 (live data with chainId/address) and Boros demo rows (no chainId). Only render sparklines for rows where `chainId` and `address` are present. Other rows render an empty cell.

---

## Empty State Refactoring

Replace plain-text empty blocks across these pages/components:

| File | Current state | New EmptyState content |
|---|---|---|
| `pages/Whales.tsx` | "No whale events detected yet..." text | Icon: `Waves` · Title: "No whale events yet" · Description: "Large TVL movements are detected every 5 minutes. Check back soon." |
| `components/home/MarketMoversCard.tsx` | "Collecting data..." text | Icon: `TrendingUp` · Title: "Collecting data" · Description: "Market movers appear after a few days of snapshots." |
| `pages/Screener.tsx` | "No markets match" text | Icon: `Search` · Title: "No markets match your filters" · Description: "Try lowering the minimum TVL or selecting a different chain." |
| `pages/Rewards.tsx` | "No markets with reward programs found" text | Icon: `Gift` · Title: "No markets with rewards" · Description: "Markets earning external rewards or points will appear here." |
| `pages/Portfolio.tsx` (empty allocation) | Portfolio page branches on `mode === "auto"` vs "advanced" (not Simple/Advanced). The EmptyState replaces the existing text shown when `activeResult.length === 0`. It should read: Icon `PieChart` · Title varies by mode — for auto mode: "No markets match your filters" with description "Try lowering the minimum TVL or selecting a different asset class"; for advanced mode: "Build your portfolio" with description "Select markets above to see your blended APY and allocation." |
| `components/home/ExpiringSoonList.tsx` (compact) | "No markets maturing..." text | Keep inline — too small for the full EmptyState component. Leave as-is. |

EmptyState is NOT used in opportunity cards (too cramped) or in loading skeletons (those stay as is).

---

## Hover Animations

### Opportunity cards on Home

`SimpleHome` does not currently render a tool-cards grid (that was removed in Phase 2 in favor of the 2×2 "What's happening right now" cards). The hover-lift rule therefore applies to the four **OpportunityCard** instances (BestYield, WhaleActivity, MarketMovers, FeaturedStrategy) and to the **QuickToolsStrip chips** on AdvancedHome.

Add `hover:-translate-y-0.5 transition-transform duration-150` to:
- The root div of `OpportunityCard` (`components/home/OpportunityCard.tsx`)
- Each chip in `QuickToolsStrip` (`components/home/QuickToolsStrip.tsx`)

### Table row hover

Current class `hover:bg-white/[0.02]` bumps to `hover:bg-white/[0.04]`. Add `transition-colors duration-150`. Apply across tables in `Yields`, `Screener`, `Rewards`, `Whales`, `Portfolio`.

### Primary button glow

In `client/src/index.css`, find the existing `.teal-cta` rule and add:

```css
.teal-cta {
  /* existing rules */
  transition: filter 150ms ease;
}
.teal-cta:hover {
  filter: brightness(1.1);
}
```

If `:hover` already defined for `teal-cta`, merge rather than duplicate.

No animations on:
- Form inputs (distracting while typing)
- Nav dropdown items (already fine)
- ModeToggle buttons (already fine)
- Stats tiles (not interactive)

---

## Error Handling

- `useSparklines` returns `{}` on error — Sparkline rendering degrades to empty cells gracefully
- If `market_snapshots` table is empty (fresh deploy, no data yet), endpoint returns `{}` — same graceful degradation
- EmptyState rendering is independent of data — it replaces the "no data" branch in existing components

---

## Performance Considerations

- Sparklines endpoint returns at most `30 × (number of markets)` rows. With ~120 markets and 30 days, that's ~3,600 rows × ~40 bytes/row ≈ 150KB uncompressed, under 30KB gzipped. Served from SQLite, no Pendle API calls.
- React Query caches sparkline data for 5 minutes. Background refresh every 10 minutes. Pages that use `useSparklines()` share the cache.
- `<Sparkline>` component is deterministic — given the same props, same SVG. Cheap to re-render.
- No new polling, no websockets. Zero impact on weekly CU budget.

---

## Testing Checklist

### Sparklines
- [ ] `/api/pendle/sparklines` returns valid JSON with key format `"1:0x..."` etc.
- [ ] Fresh deploy with no snapshots returns `{}` — no error
- [ ] Sparkline component renders a polyline with at least 2 points
- [ ] Sparkline component renders dash when < 2 points
- [ ] Stroke color reflects up/down/flat trend
- [ ] Yields table Trend column renders without breaking existing layout
- [ ] Screener Trend column ditto
- [ ] Home AdvancedHome Top Markets Trend column ditto
- [ ] Clicking a sparkline navigates to `/history`

### Mode-aware columns
- [ ] Simple mode on `/yields` shows 4 columns (Asset, Product, APY, TVL, Trend)
- [ ] Advanced mode on `/yields` shows all 9 columns
- [ ] Toggle switches columns instantly, no reload
- [ ] Column counts match for Screener, Rewards, Calendar
- [ ] Sort handlers still work on visible columns only

### Empty states
- [ ] `/whales` with no events renders EmptyState (not plain text)
- [ ] MarketMoversCard with no data renders EmptyState (not plain text)
- [ ] Screener with zero results renders EmptyState
- [ ] Rewards with zero results renders EmptyState
- [ ] Portfolio Advanced mode with no positions renders EmptyState

### Hover polish
- [ ] Opportunity cards on home (BestYield, WhaleActivity, Movers, Strategy) and QuickTools chips lift slightly on hover (no jank)
- [ ] Table rows in updated pages have slightly stronger hover bg
- [ ] Primary CTA buttons subtly brighten on hover
- [ ] No layout shift on any hover

### General
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds
- [ ] No console errors on page load
- [ ] Existing tests (if any) still pass

---

## File Change Summary

| File | Action |
|------|--------|
| `server/routes.ts` | UPDATE — add `/api/pendle/sparklines` endpoint |
| `client/src/lib/api.ts` | UPDATE — add `useSparklines`, `SparklinePoint`, `SparklineMap`, `sparklineKey` |
| `client/src/components/Sparkline.tsx` | CREATE |
| `client/src/components/ui/empty-state.tsx` | CREATE |
| `client/src/index.css` | UPDATE — `.teal-cta` hover brightness |
| `client/src/pages/Yields.tsx` | UPDATE — mode-aware columns, trend column, row hover |
| `client/src/pages/Screener.tsx` | UPDATE — mode-aware columns, trend column, empty state, row hover |
| `client/src/pages/Rewards.tsx` | UPDATE — mode-aware columns, empty state |
| `client/src/pages/Calendar.tsx` | UPDATE — mode-aware card fields, inline sparkline |
| `client/src/pages/Whales.tsx` | UPDATE — empty state, row hover |
| `client/src/pages/Portfolio.tsx` | UPDATE — empty state for Advanced mode no-positions |
| `client/src/components/home/OpportunityCard.tsx` | UPDATE — hover lift |
| `client/src/components/home/QuickToolsStrip.tsx` | UPDATE — hover lift on chips |
| `client/src/components/home/TopMarketsTable.tsx` | UPDATE — trend column, row hover |
| `client/src/components/home/MarketMoversCard.tsx` | UPDATE — empty state |

**Note:** `Home.tsx` SimpleHome doesn't currently have a tool-cards grid (removed in Phase 2). The hover-lift rule applies only if we add tool cards there later. For Phase 3, skip that item — no tool cards, no hover rule needed.

---

## Rollback

All changes are additive except the table column refactors. If a page breaks:

```bash
git revert <commit-hash-for-that-page>
npm run build && pm2 restart boros-tools
```

The sparklines endpoint is safe to leave in place. The `market_snapshots` table is unchanged.

---

## Deployment Sequence

1. Ship backend first (sparklines endpoint) — safe no-op if nothing consumes it yet
2. Ship Sparkline + EmptyState components
3. Ship page-by-page refactors, one file at a time, so regressions are isolated
4. Final commit: CSS polish

This sequencing means each intermediate deploy is stable.
