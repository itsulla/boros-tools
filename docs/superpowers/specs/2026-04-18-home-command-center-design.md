# Home Command Center — Phase 2 Design

**Date:** 2026-04-18
**Project:** boros-tools (boros.lekker.design)
**Status:** Approved — Phase 2 of a 3-phase redesign
**Depends on:** Phase 1 (Simple/Advanced mode foundation, shipped 2026-04-18)

---

## Background

The current home page (`client/src/pages/Home.tsx`, ~175 lines) is a passive brochure: hero, static KPI cards, tool grid, and two explainer sections. It tells users what tools *exist* but never shows what's *happening right now*. A returning user gets nothing new on each visit.

Phase 1 added mode-aware navigation. Phase 2 rewrites the home page to be mode-aware too — two distinct layouts sharing the same data hooks and card components. No referral link exists yet, so we de-emphasize outbound CTAs and lean into engagement and education.

---

## Goals

1. Turn the home page into a live command center showing current opportunities, not a static brochure
2. Ship two layouts (Simple, Advanced) that render at the same URL `/` based on `useMode()`
3. Add a first-visit welcome banner in Simple mode (dismissible, localStorage-persisted)
4. Surface four live opportunity cards: Best Yield, Whale Activity, Market Movers, Featured Strategy
5. Keep the existing "What is Pendle?" and "What is Boros?" explainer content accessible — shown in Simple mode, removed from Advanced mode
6. Decompose the home page into reusable sub-components under `client/src/components/home/` so the page file stays under ~200 lines

## Non-Goals

- Onboarding wizard / interstitial modals (skipped per user feedback)
- Page-level polish for other pages (that's Phase 3)
- Adding streaming/websocket data (polling at existing intervals is sufficient)
- Changing the navigation — Phase 1 handles that
- Adding a "Trade on Boros" hard CTA (no referral link yet; revisit later)

---

## Architecture

### Mode-aware rendering

`Home.tsx` reads `useMode()` and branches:

```tsx
const { mode } = useMode();
return mode === "advanced" ? <AdvancedHome /> : <SimpleHome />;
```

`SimpleHome` and `AdvancedHome` are two components in `components/home/` that compose the same card primitives with different densities and ordering.

### Data hooks

All data flows through React Query. Hooks used:

| Hook | Source | New? |
|---|---|---|
| `usePendleMarketList` | existing | no |
| `useWhales` | new thin wrapper around `/api/pendle/whales` | YES |
| `useMarketMovers` | new | YES — backed by new `/api/pendle/movers` endpoint |
| `useSpendleStats` | existing (re-export if not already a hook) | may need extraction |
| `usePendleStatus` | existing | no |

Where a hook doesn't yet exist as a reusable export, add it to `client/src/lib/api.ts` following the existing pattern (React Query with 60-300s staleTime and matching refetchInterval).

### New component hierarchy

```
client/src/components/home/
  ├── WelcomeBanner.tsx        — dismissible, first-visit only (Simple)
  ├── LiveStatsStrip.tsx       — accepts `variant: "compact" | "dense"`
  ├── OpportunityCard.tsx      — base shell for the 4 live cards
  ├── BestYieldCard.tsx        — uses OpportunityCard
  ├── WhaleActivityCard.tsx    — uses OpportunityCard
  ├── MarketMoversCard.tsx     — uses OpportunityCard
  ├── FeaturedStrategyCard.tsx — uses OpportunityCard
  ├── ExpiringSoonList.tsx     — used by both modes, different densities
  ├── TopMarketsTable.tsx      — Advanced only
  ├── WhaleTicker.tsx          — Advanced only, compact list
  ├── QuickToolsStrip.tsx      — Advanced only, chip row of tool links
  ├── SimpleHome.tsx           — composes Simple mode layout
  └── AdvancedHome.tsx         — composes Advanced mode layout
```

---

## Backend Changes

The only backend work is market snapshot storage for the Market Movers feature.

### New table: `market_snapshots`

```sql
CREATE TABLE IF NOT EXISTS market_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  chainId         INTEGER NOT NULL,
  address         TEXT    NOT NULL,
  snapshotDate    TEXT    NOT NULL,  -- YYYY-MM-DD (UTC)
  impliedApy      REAL,
  underlyingApy   REAL,
  totalTvl        REAL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_market_date
  ON market_snapshots (chainId, address, snapshotDate);
```

Added to `server/pendle-db.ts` in the `initPendleDb()` function.

### Sync loop change

In `server/pendle-sync.ts`, after the main `upsertMany(markets)` transaction:

1. Compute today's UTC date as `YYYY-MM-DD`
2. For each synced market, `INSERT OR IGNORE INTO market_snapshots ...` — the unique index ensures only one row per market per day. Subsequent syncs on the same day are no-ops.
3. Prune snapshots older than 30 days: `DELETE FROM market_snapshots WHERE snapshotDate < date('now', '-30 days')`

This runs inside the existing sync cycle — no new schedule, no extra API calls.

### New endpoint: `GET /api/pendle/movers`

Query params:
- `lookbackDays` — integer, default 7, max 30
- `limit` — integer, default 10, max 50
- `minTvl` — number, default 1_000_000

Response shape: array of objects:
```typescript
{
  chainId: number;
  address: string;
  name: string;
  asset: string;
  currentApy: number;
  previousApy: number;
  apyChangeBps: number;   // (current - previous) * 10000
  totalTvl: number;
  daysToMaturity: number;
}
```

SQL strategy: LEFT JOIN current `markets` against the closest `market_snapshots` row with `snapshotDate <= date('now', '-N days')`. Filter to markets with a non-null previous snapshot, absolute change ≥ 10 bps, TVL ≥ `minTvl`. Order by `ABS(currentApy - previousApy)` DESC. Active markets only (expiry > now).

Implementation:

```typescript
const rows = db.prepare(`
  WITH latest_snapshot AS (
    SELECT chainId, address, impliedApy AS prevApy,
           MAX(snapshotDate) AS snapshotDate
    FROM market_snapshots
    WHERE snapshotDate <= date('now', ?)
    GROUP BY chainId, address
  )
  SELECT m.chainId, m.address, m.name,
         m.details_impliedApy AS currentApy,
         ls.prevApy AS previousApy,
         m.details_totalTvl AS totalTvl,
         m.expiry
  FROM markets m
  INNER JOIN latest_snapshot ls
    ON m.chainId = ls.chainId AND m.address = ls.address
  WHERE m.expiry > ?
    AND m.details_totalTvl >= ?
    AND ls.prevApy IS NOT NULL
    AND ABS(m.details_impliedApy - ls.prevApy) >= 0.001
  ORDER BY ABS(m.details_impliedApy - ls.prevApy) DESC
  LIMIT ?
`).all(`-${lookbackDays} days`, new Date().toISOString(), minTvl, limit);
```

Map rows to response shape, computing `asset` via existing `deriveAsset()` helper, `apyChangeBps`, and `daysToMaturity`.

---

## Simple Mode Layout

Top-to-bottom composition order:

1. **WelcomeBanner** (conditional, first-visit only)
   - localStorage key `useboros-welcome-dismissed`
   - Copy: "New to Pendle? Here's a 60-second explainer."
   - Actions: "Learn" (scrolls to "What is Pendle?" section) and "✕" (sets localStorage flag)
2. **Hero**
   - "UseBoros" wordmark using existing logo
   - Tagline: "Yield tools for Pendle & Boros"
   - Two buttons: "Portfolio Builder →" (`/portfolio`) and "Explore Yields →" (`/yields`)
   - No "Trade on Boros" button (no referral link)
3. **LiveStatsStrip (compact)** — 3 tiles
   - Best Yield (from `markets-raw`, top impliedApy with TVL ≥ $1M)
   - Total TVL (sum across all active markets)
   - sPENDLE APY (from `/api/pendle/spendle`)
4. **"What's happening right now"** — 2×2 grid
   - BestYieldCard
   - WhaleActivityCard (shows most recent 1 whale event with timestamp)
   - MarketMoversCard (shows top mover by absolute bps change)
   - FeaturedStrategyCard (rotating strategy based on day-of-year)
5. **ExpiringSoonList (compact)** — 3-row action list for markets maturing in < 14 days
6. **Existing explainers** — "What is Pendle?" and "What is Boros?" rendered as-is from current Home.tsx (anchored by id for welcome banner link)

---

## Advanced Mode Layout

Top-to-bottom composition order:

1. **Header strip** (no hero, no welcome banner)
   - "UseBoros · Command Center" title
   - Top-right: "Live · synced Xm ago" using `usePendleStatus`
2. **LiveStatsStrip (dense)** — 6 tiles
   - Best APY, Total TVL, sPENDLE APY, Active Markets count, Avg APY, 24h Volume (sum of tradingVolume)
3. **Live Opportunities row** — 4 cards in a single row on desktop, 2×2 on tablet, stacked on mobile
   - Same 4 cards as Simple mode, but `variant="dense"` — each shows 3 data rows instead of 1
4. **Top Markets table**
   - Sortable table with 15 rows
   - Columns: Market, Chain, TVL, Impl APY, Under APY, Spread, Days
   - Filter chips: All / Stables / ETH / BTC (client-side filter on `asset` field)
   - "Screener →" link in top-right to `/screener`
   - Uses `usePendleMarketList` filtered by TVL ≥ $1M, sorted by a score: `impliedApy × Math.sqrt(tvl) × Math.min(daysToMaturity, 180)`
5. **WhaleTicker** — 10 most recent whale events as single-line rows
6. **Expiring Soon summary** — one line: "12 markets maturing in next 30 days · $146M TVL" with calendar link
7. **QuickToolsStrip** — chip-row of all tool links: Terminal, Arbitrage, Simulator, Screener, Heatmap, Whales, sPENDLE

No explainer sections in Advanced mode. Power users don't need them taking up space.

---

## Shared Component Contracts

### `OpportunityCard` base

Props:
```typescript
{
  icon: ReactNode;            // e.g. 🌟 or <TrendingUp />
  title: string;
  variant: "compact" | "dense";
  isLoading?: boolean;
  children: ReactNode;        // the card body content
  cta?: { label: string; href: string };
}
```

Renders a card with `bg-card border border-card-border rounded-xl`, header row (icon + title), body, and optional footer CTA link.

### `LiveStatsStrip`

Props: `variant: "compact" | "dense"` — compact shows 3 tiles, dense shows 6. Each tile: `label`, `value`, `sub` (optional). Uses the existing `formatUSD` and `formatPercent` helpers.

### Featured Strategy rotation

Pure function, no backend:
```typescript
function featuredStrategyForToday(): { id: string; title: string; estApy: number; href: string } {
  const STRATEGIES = [ /* 4 hardcoded entries matching /strategies page */ ];
  const day = Math.floor(Date.now() / 86400000);
  return STRATEGIES[day % STRATEGIES.length];
}
```

### Welcome Banner dismiss flow

```typescript
const [dismissed, setDismissed] = useState(
  () => localStorage.getItem("useboros-welcome-dismissed") === "1"
);
// render nothing if dismissed
// on ✕ click: localStorage.setItem("useboros-welcome-dismissed", "1"); setDismissed(true);
```

---

## Data Flow Summary

```
/ (Home)
  │
  ├── useMode()  → simple | advanced
  │
  ├── Simple → <SimpleHome>
  │             ├── <WelcomeBanner/>
  │             ├── <LiveStatsStrip variant="compact">
  │             ├── <BestYieldCard variant="compact">
  │             ├── <WhaleActivityCard variant="compact">
  │             ├── <MarketMoversCard variant="compact">
  │             ├── <FeaturedStrategyCard variant="compact">
  │             ├── <ExpiringSoonList variant="compact">
  │             └── existing explainers
  │
  └── Advanced → <AdvancedHome>
                  ├── <LiveStatsStrip variant="dense">
                  ├── <BestYieldCard variant="dense">
                  ├── <WhaleActivityCard variant="dense">
                  ├── <MarketMoversCard variant="dense">
                  ├── <FeaturedStrategyCard variant="dense">
                  ├── <TopMarketsTable>
                  ├── <WhaleTicker>
                  ├── one-line expiring summary
                  └── <QuickToolsStrip>
```

---

## Error Handling

- All live data hooks must gracefully render empty/skeleton states while loading
- If an endpoint returns empty or errors, the card renders a friendly "No data" state (not a broken card) — pattern already established across existing pages
- `/api/pendle/movers` returning `[]` during the first 7 days post-deploy (before snapshots accumulate) is expected; MarketMoversCard shows "Collecting data — check back in a few days"

---

## Rate Limits & Performance

No change to Pendle API call frequency. The new endpoint reads from SQLite only. Snapshot inserts add ~1ms per sync cycle. No additional frontend fetches beyond what the new hooks already do.

---

## File Change Summary

| File | Action |
|------|--------|
| `server/pendle-db.ts` | UPDATE — add `market_snapshots` table |
| `server/pendle-sync.ts` | UPDATE — daily snapshot insert + prune |
| `server/routes.ts` | UPDATE — add `/api/pendle/movers` endpoint |
| `client/src/lib/api.ts` | UPDATE — add `useWhales`, `useMarketMovers`, `useSpendleStats` hooks (if not already present) |
| `client/src/components/home/OpportunityCard.tsx` | CREATE |
| `client/src/components/home/LiveStatsStrip.tsx` | CREATE |
| `client/src/components/home/BestYieldCard.tsx` | CREATE |
| `client/src/components/home/WhaleActivityCard.tsx` | CREATE |
| `client/src/components/home/MarketMoversCard.tsx` | CREATE |
| `client/src/components/home/FeaturedStrategyCard.tsx` | CREATE |
| `client/src/components/home/ExpiringSoonList.tsx` | CREATE |
| `client/src/components/home/TopMarketsTable.tsx` | CREATE |
| `client/src/components/home/WhaleTicker.tsx` | CREATE |
| `client/src/components/home/QuickToolsStrip.tsx` | CREATE |
| `client/src/components/home/WelcomeBanner.tsx` | CREATE |
| `client/src/components/home/SimpleHome.tsx` | CREATE |
| `client/src/components/home/AdvancedHome.tsx` | CREATE |
| `client/src/pages/Home.tsx` | REWRITE — thin dispatcher based on `useMode()` |

No new npm dependencies. No data model migrations on the existing `markets` table.

---

## Testing Checklist

### Manual verification

**Simple mode:**
- [ ] Welcome banner appears on first visit (after clearing localStorage)
- [ ] Clicking ✕ dismisses banner; reload keeps it dismissed
- [ ] Clicking "Learn" scrolls to "What is Pendle?" section
- [ ] Hero shows two buttons only, no "Trade on Boros"
- [ ] 3-tile stats strip renders with real numbers
- [ ] 4 opportunity cards render (or show loading/empty states cleanly)
- [ ] Expiring Soon list shows 3 markets or fewer if none qualify
- [ ] Explainer sections still render at bottom

**Advanced mode:**
- [ ] Switching via ModeToggle replaces layout instantly — no page reload
- [ ] Header shows "Live · synced Xm ago"
- [ ] 6-tile stats strip renders
- [ ] 4 opportunity cards render in denser format
- [ ] Top Markets table renders with 15 rows
- [ ] Asset filter chips work (All / Stables / ETH / BTC)
- [ ] Column sort works on all sortable columns
- [ ] Whale Ticker shows 10 most recent events (or empty-state if zero)
- [ ] Quick Tools strip shows 7 chip links, all routing correctly

**Shared:**
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds
- [ ] `/api/pendle/movers` returns well-formed JSON
- [ ] On a fresh DB, `/api/pendle/movers` returns `[]` and MarketMoversCard shows "Collecting data" empty state

---

## Rollback

All changes are additive:

```bash
git revert <first-commit-of-phase-2>..HEAD
npm run build && pm2 restart boros-tools
```

The `market_snapshots` table can be left in place (harmless if unused) or dropped:
```sql
DROP TABLE market_snapshots;
```

---

## What Comes Next (Context)

**Phase 3** will add page-level polish: sparklines in tables, mode-aware column visibility across existing pages, smooth transitions, empty state illustrations, and hover micro-animations. Phase 2 provides the patterns (mode-aware rendering, home subcomponents) that Phase 3 will generalize.
