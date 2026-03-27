# Pendle Tools Expansion — Design Spec

**Date:** 2026-03-27
**Project:** boros-tools (boros.lekker.design)
**Status:** Approved

---

## Background

The Boros Tools site now has live Pendle V2 market data synced every 5 minutes (116 markets across 10 chains). This spec adds 4 new tools that leverage the synced data plus on-demand Pendle API calls.

**CU Budget constraint:** The free tier (200k CU/week) is currently using ~22k CU/week for the background sync. New features MUST use on-demand fetching (per user request), NOT bulk sync. Each on-demand call costs 1 CU.

---

## Feature 1: Fixed Yield Calculator

**What it does:** User selects a Pendle V2 market, enters a capital amount, and sees:
- Effective fixed APY and dollar return at maturity
- Days to maturity
- Comparison: "If you hold $10,000 in PT-weETH at 2.96% for 90 days, you earn $73.15"
- Vs underlying variable rate: what you'd earn if the variable rate stays flat

**Yield formula (simple interest):**
```
return = capital × impliedApy × (daysToMaturity / 365)
variableReturn = capital × underlyingApy × (daysToMaturity / 365)
```
Use simple interest — this matches how Pendle's own UI displays projected returns for PT holders.

**Data source:** Existing synced markets table (for market list + implied APY + underlying APY + expiry). No new API calls needed.

**Page route:** `/calculator` (browser URL: `/#/calculator` — the app uses wouter with hash-based routing)

**UI:**
- Market selector dropdown (populated from the new `/api/pendle/markets-raw` endpoint, sorted by TVL)
- Capital input field (USD amount, default $10,000)
- Results card showing: fixed APY, days to maturity, total return ($), daily return ($), vs underlying variable rate comparison
- "Trade on Pendle" CTA button linking to `https://app.pendle.finance/trade/markets`

---

## Feature 2: Maturity Calendar

**What it does:** Visual timeline of all active Pendle markets approaching expiry. Traders need to know when to roll positions.

**Data source:** Existing synced markets table (`expiry` field). No new API calls.

**Page route:** `/calendar` (browser URL: `/#/calendar`)

**UI:**
- Timeline view grouped by time buckets: "This Week" (<7d), "Next 2 Weeks" (7-14d), "This Month" (14-30d), "Next 3 Months" (30-90d), "6+ Months" (90d+)
- Each market card shows: name, chain ID, implied APY, TVL, days until expiry
- Color coding: red for <7 days, amber for <30 days, green for 30+ days
- Sort options: by expiry date (default), by APY, by TVL

---

## Feature 3: Yield History Charts

**What it does:** Interactive chart showing how implied APY and underlying APY have changed over time for a selected market.

**Data source:** On-demand API call per market: `GET /core/v1/{chainId}/markets/{address}/apy-history?timeFrame=week`
- Returns up to 1440 hourly data points (~60 days of data regardless of `timeFrame` param — verified by research, all timeFrame values return 1440 points)
- Each point: `{ timestamp, impliedApy, underlyingApy }`
- Cost: 1 CU per request

**Architecture:**
- New server endpoint: `GET /api/pendle/history?chainId={}&address={}`
- Server proxies to Pendle API (avoids CORS), uses in-memory cache with request deduplication (see Server Changes below)
- Frontend: dedicated page with market selector + Recharts line chart

**Page route:** `/history` (browser URL: `/#/history`)

**UI:**
- Market selector dropdown (from `/api/pendle/markets-raw`)
- Recharts line chart with two lines: implied APY (teal/primary) and underlying APY (muted)
- Timeframe filter buttons: 7d, 30d, 60d — these filter the 1440 returned data points client-side
- Current rate highlighted with a dot at the rightmost point
- Tooltip showing exact values + date on hover
- Loading skeleton while fetching
- Error state: "Unable to load history" with retry button

---

## Feature 4: Rewards Explorer

**What it does:** Shows which Pendle markets earn external rewards (point programs, extra token incentives) and their reward APY breakdown.

**Data source:**
- Market list: existing synced data, filtered by those with `categoryIds` containing `"points"`. The `/active` endpoint returns a `categoryIds` array (e.g., `["points", "eth"]`). This is NOT the same as the `points` column in the DB schema — `categoryIds` is a metadata tag, while `points` was intended for structured reward multiplier data (which the API does not provide). We store `categoryIds` in a new column.
- Reward detail: on-demand `GET /core/v1/{chainId}/markets/{address}` for `underlyingRewardApyBreakdown` and `rewardTokens`
- Cost: 1 CU per detail fetch

**Schema change:** Add `categoryIds TEXT` column to the `markets` table. Store the JSON array from the `/active` response. The existing `points` and `externalProtocols` columns are always NULL (the API does not expose these fields) — leave them as-is (removing columns is not worth a migration).

**Page route:** `/rewards` (browser URL: `/#/rewards`)

**UI:**
- Table of markets filtered to those with `categoryIds` containing `"points"`
- Columns: market name, chain, implied APY, TVL, "Points" badge
- Expandable rows: clicking a market fetches detail via `/api/pendle/market-detail` and shows `underlyingRewardApyBreakdown` as a sub-table (reward token symbol, source type, APY contribution)
- Loading state: Skeleton inside expanded row while fetching
- Empty state: "No reward breakdown available" if `underlyingRewardApyBreakdown` is empty
- Error state: "Unable to load details" with retry

---

## Server Changes

### New endpoint: `GET /api/pendle/markets-raw`

Returns the raw market data from SQLite (not transformed to `YieldPool` shape). This is needed because the Calculator, Calendar, History, and Rewards pages all need `chainId`, `address`, and raw `expiry` (ISO string) — fields that the existing `marketToYieldPool()` mapping strips out.

Query params: `limit` (default 100), `activeOnly` (default `"true"`), `minTvl` (default `0`), `hasPoints` (default `"false"` — if `"true"`, filter to markets where `categoryIds` contains `"points"`)

Response shape per market:
```typescript
{
  address: string;
  chainId: number;
  name: string;
  expiry: string;          // ISO 8601
  impliedApy: number;      // decimal (0.054 = 5.4%)
  underlyingApy: number;   // decimal
  aggregatedApy: number;   // decimal (LP APY)
  totalTvl: number;        // USD
  liquidity: number;       // USD
  categoryIds: string[];   // parsed from JSON
  isNew: boolean;
  isPrime: boolean;
}
```

### New endpoint: `GET /api/pendle/history`
Query params: `chainId` (required), `address` (required)
Proxies to Pendle API `GET /core/v1/{chainId}/markets/{address}/apy-history?timeFrame=week`.
Uses deduplicating cache (see below).
Returns: `{ results: [{ timestamp, impliedApy, underlyingApy }] }`

### New endpoint: `GET /api/pendle/market-detail`
Query params: `chainId` (required), `address` (required)
Proxies to `GET /core/v1/{chainId}/markets/{address}`.
Uses deduplicating cache (see below).
Returns: full market detail JSON from Pendle API.

### In-memory cache with request deduplication

```typescript
const cache = new Map<string, { data: any; expiresAt: number; pending?: Promise<any> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200;

async function cachedFetch(key: string, fetchFn: () => Promise<any>): Promise<any> {
  const now = Date.now();
  const entry = cache.get(key);

  // Return cached data if fresh
  if (entry && entry.expiresAt > now && entry.data) return entry.data;

  // Deduplication: if a fetch is already in-flight for this key, wait for it
  if (entry?.pending) return entry.pending;

  // Start fetch, store the Promise so concurrent requests coalesce
  const promise = fetchFn().then((data) => {
    cache.set(key, { data, expiresAt: now + CACHE_TTL });
    return data;
  }).catch((err) => {
    cache.delete(key); // Don't cache errors
    throw err;
  });

  cache.set(key, { data: null, expiresAt: 0, pending: promise });

  // LRU eviction
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  return promise;
}
```

### Schema migration: add `categoryIds` column

In `pendle-db.ts`, after creating the markets table, run:
```sql
-- SQLite allows ADD COLUMN on existing tables
ALTER TABLE markets ADD COLUMN categoryIds TEXT;
```
Wrap in try/catch — the column may already exist on subsequent runs.

### Sync update: store categoryIds

In `pendle-sync.ts`, the upsert statement adds `categoryIds` as a new column. The `/active` endpoint returns `categoryIds` as an array — store as `JSON.stringify(m.categoryIds)`.

---

## Navigation

The navbar currently has 6 items. Adding 4 more (10 total) will overflow at the `md` breakpoint. Solution: group the new Pendle tools under a "Tools" dropdown.

Updated `NAV_LINKS` in `constants.ts`:
```typescript
export const NAV_LINKS = [
  { label: "Terminal", href: "/terminal" },
  { label: "Arbitrage", href: "/arbitrage" },
  { label: "Simulator", href: "/simulator" },
  { label: "Heatmap", href: "/heatmap" },
  { label: "Yields", href: "/yields" },
  { label: "Strategies", href: "/strategies" },
] as const;

export const PENDLE_TOOLS_LINKS = [
  { label: "Calculator", href: "/calculator" },
  { label: "Calendar", href: "/calendar" },
  { label: "History", href: "/history" },
  { label: "Rewards", href: "/rewards" },
] as const;
```

The navbar renders `PENDLE_TOOLS_LINKS` under a "Pendle Tools" dropdown button. Mobile nav shows all items flat in the hamburger menu.

---

## Rate Limit Impact

| Action | CU/call | Frequency | Weekly CU |
|---|---|---|---|
| Existing sync (chains + active) | ~11 | Every 5 min | ~22,176 |
| History (on-demand, cached 5min) | 1 | Per unique market view | ~50-500 |
| Market detail (on-demand, cached 5min) | 1 | Per unique expand | ~50-500 |
| **Total** | | | **~23,000 + user traffic** |

Even with 1000 unique market views per week, total is ~24k CU — 12% of the free tier.

---

## Files Changed Summary

| File | Change |
|---|---|
| `server/pendle-db.ts` | ADD `categoryIds` column migration |
| `server/pendle-sync.ts` | Store `categoryIds` during sync upsert |
| `server/routes.ts` | Add 3 endpoints + in-memory cache + `markets-raw` response shape |
| `client/src/lib/constants.ts` | Add `PENDLE_TOOLS_LINKS` |
| `client/src/lib/api.ts` | Add hooks: `usePendleHistory`, `usePendleMarketDetail`, `usePendleMarketList` |
| `client/src/App.tsx` | Add 4 new routes |
| `client/src/components/Layout.tsx` | Add "Pendle Tools" dropdown to navbar |
| `client/src/pages/Calculator.tsx` | NEW |
| `client/src/pages/Calendar.tsx` | NEW |
| `client/src/pages/History.tsx` | NEW |
| `client/src/pages/Rewards.tsx` | NEW |

---

## Implementation Order

1. **Schema + sync update** (categoryIds column + upsert) — prerequisite for Feature 4
2. **Server: new endpoints** (markets-raw, history, market-detail + cache) — prerequisite for all features
3. **Navigation** (Pendle Tools dropdown) — needed before adding pages
4. **Feature 1: Calculator** — pure frontend, no new API calls
5. **Feature 2: Calendar** — pure frontend, no new API calls
6. **Feature 3: History** — new page + new hook
7. **Feature 4: Rewards** — new page + new hook + expandable rows
