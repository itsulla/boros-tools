# Pendle V2 MCP Integration — Design Spec

**Date:** 2026-03-27
**Project:** boros-tools (boros.lekker.design)
**Status:** Approved

---

## Background

The Boros Tools dashboard is a promotional site for Pendle's Boros product (on-chain perpetual funding rate trading). It has 6 pages; the Yields page currently returns 100% hardcoded demo data — `useYieldPools()` never makes a real API call. The Pendle V2 rows in that demo data have stale APYs and expired maturity dates.

Pendle recently released `pendle-finance/pendle-ai`, an MCP server that syncs live Pendle V2 market data into a local SQLite database. We will port its sync/storage core directly into the Express backend, expose REST endpoints, and use those to power live data on the Yields and Strategies pages.

---

## Goals

1. Replace static demo data on the Yields page with live Pendle V2 market data (PT implied APYs, TVLs, maturities)
2. Show a "last updated" timestamp on the Yields page
3. Enrich the Strategies page "Current Opportunity" panel with a live "Best Pendle V2 PT rate" stat
4. Stay safely within the Pendle API free tier (100 CU/min, 200k CU/week) with zero risk of being rate-limited or IP-banned

## Non-Goals

- Heatmap page — Pendle V2 PT yields are a different instrument type from perpetual funding rates; mixing them would be misleading
- Terminal / Arbitrage pages — those compare Boros vs CEX funding rates; Pendle V2 is out of scope
- Running the full MCP server as a sidecar process
- Any write operations (swaps, LP, limit orders)

---

## Approach: Option B — Sync Core Ported Into Express

Port the sync logic, SQLite storage, and Pendle API client from `pendle-finance/pendle-ai` directly into the Express server. Run the same 5-minute scheduled sync inside the existing Express process. The frontend hits local `/api/pendle/*` endpoints instead of calling Pendle's API directly (which is blocked by CORS anyway).

**Why not Option A (full MCP sidecar):** Unnecessary overhead — we only need data query access, not the full 25-tool MCP protocol.
**Why not Option C (in-memory TTL cache):** Cache is lost on PM2 restart; first visitor after a restart triggers a live API call under user-facing latency.

---

## Architecture

```
Express Server (existing PM2 process)
  ├── server/pendle-db.ts      NEW — SQLite init + schema (markets, assets tables)
  ├── server/pendle-sync.ts    NEW — 5-min sync loop, rate-limit tracking, circuit breaker
  ├── server/routes.ts         UPDATED — /api/pendle/markets, /api/pendle/status
  └── server/index.ts          UPDATED — call initPendleSync() on startup

Frontend
  ├── client/src/lib/api.ts    UPDATED — useYieldPools, usePendleStatus
  ├── client/src/pages/Yields.tsx      UPDATED — live rows + last-updated badge
  └── client/src/pages/Strategies.tsx  UPDATED — best Pendle V2 rate in opportunity panel

New npm dependency: better-sqlite3 + @types/better-sqlite3
```

---

## Rate Limit & Sync Strategy

### Budget calculation

| Parameter | Value |
|---|---|
| Free tier | 100 CU/min, 200,000 CU/week |
| Calls per sync cycle | 1 (`GET /v1/markets`) |
| CU per call | ~10 CU |
| Sync interval | 5 minutes |
| Syncs per week | 2,016 |
| **CU per week** | **~20,160 (~10% of budget)** |

### Protections (all enforced in code, not just config)

1. **Hard minimum interval** — 5 minutes between sync attempts, enforced in `pendle-sync.ts`. No configuration can reduce this.
2. **Weekly CU circuit breaker** — every response includes `X-RateLimit-Weekly-Remaining`. If remaining < 5,000 CU, the sync loop pauses and logs `[pendle-sync] circuit breaker: weekly CU low, pausing syncs`.
3. **429 backoff** — on a 429 response, back off 65 seconds (1 min + 5s buffer) before the next attempt. Never retries immediately.
4. **Zero on-demand Pendle API calls** — all `/api/pendle/*` endpoints read from SQLite only. Pendle's API is never called in response to user HTTP traffic. Even 10,000 concurrent visitors generate exactly 1 Pendle API request every 5 minutes.
5. **Stale data tolerance** — if a sync fails, the previous cached data remains available. The `/api/pendle/status` endpoint reports `lastSyncAt` so the frontend can warn users if data is stale > 15 minutes.

---

## Backend: New Files

### `server/pendle-db.ts`

Initialises a `better-sqlite3` database at `pendle-cache.db` in the project root. Creates two tables:

**`markets` table** — flat schema mirroring the MCP server's storage:
- Primary key: `(chainId, address)`
- Columns: `address`, `chainId`, `name`, `expiry`, `pt`, `yt`, `sy`, `underlyingAsset`, `isNew`, `isPrime`, `isVolatile`, `details_liquidity`, `details_totalTvl`, `details_tradingVolume`, `details_underlyingApy`, `details_impliedApy`, `details_aggregatedApy`, `details_maxBoostedApy`, `details_totalPt`, `details_totalSy`, `details_totalSupply`, `points`, `externalProtocols`

**`sync_meta` table** — tracks sync state:
- `lastSyncAt` (ISO timestamp), `weeklyRemaining` (integer), `marketCount` (integer)

Exports: `initPendleDb(): Database`

### `server/pendle-sync.ts`

Exports: `initPendleSync(db: Database): void`

Responsibilities:
- On call: runs an initial sync immediately (async, non-blocking — server starts regardless)
- Schedules a recurring sync every 5 minutes via `setInterval`
- Sync function:
  1. Checks weekly CU remaining from DB — skip if < 5,000
  2. Calls `GET https://api-v2.pendle.finance/core/v1/markets?isExpired=false&limit=100&sortField=details_totalTvl&sortOrder=desc`
  3. Reads `X-RateLimit-Weekly-Remaining` header from response, stores in `sync_meta`
  4. On 429: logs warning, schedules retry in 65 seconds (does not increment the regular interval)
  5. On success: upserts market rows via `INSERT OR REPLACE INTO markets`; updates `sync_meta`
  6. On any other error: logs error, leaves stale data intact, retries on next regular interval

---

## Backend: Updated Files

### `server/routes.ts`

**`GET /api/pendle/markets`**

Query params (all optional):
- `limit` — integer, default 50, max 100
- `activeOnly` — boolean string, default `"true"` — filters `expiry > now()`
- `minTvl` — number, default `1000000` — filters `details_totalTvl >= minTvl`

Returns JSON array. Each element is mapped to the `YieldPool` shape:

```typescript
{
  protocol: "Pendle V2",
  product: market.name,           // e.g. "PT-weETH-27JUN2026"
  asset: deriveAsset(market),     // ETH, USDC, BTC, etc. — see mapping below
  apy: market.details_impliedApy * 100,
  type: "Fixed",
  maturity: formatExpiry(market.expiry),  // "Jun 27, 2026"
  riskLevel: deriveRisk(market),          // Low for ETH/stable, Medium otherwise
  sourceUrl: `https://app.pendle.finance/trade/markets`,
  tvl: market.details_totalTvl,
}
```

Asset derivation (`deriveAsset`): pattern-matches `market.name` against known substrings:
- `ETH`, `stETH`, `weETH`, `eETH`, `wstETH` → "ETH"
- `USDC`, `USDT`, `DAI`, `crvUSD`, `GHO`, `FRAX`, `pyUSD` → respective stable symbol
- `BTC`, `wBTC`, `cbBTC` → "BTC"
- `SOL` → "SOL"
- fallback → first uppercase token name found in market name

Risk derivation (`deriveRisk`): ETH and stablecoins → "Low"; others → "Medium"; markets with `isVolatile=1` → "High"

**`GET /api/pendle/status`**

Returns:
```typescript
{
  lastSyncAt: string | null,    // ISO timestamp
  nextSyncAt: string,           // ISO timestamp
  marketCount: number,
  weeklyRemaining: number | null,
  isStale: boolean,             // true if lastSyncAt > 15 min ago
}
```

### `server/index.ts`

After `registerRoutes(...)`, add:
```typescript
import { initPendleDb } from './pendle-db.js';
import { initPendleSync } from './pendle-sync.js';
const pendleDb = initPendleDb();
initPendleSync(pendleDb);
```

---

## Frontend: Updated Files

### `client/src/lib/api.ts`

**`useYieldPools`** — updated:
1. Fetches `GET /api/pendle/markets`
2. On success: merges with Boros rows from `DEMO_YIELD_POOLS` (only Boros-protocol rows from the demo, since live Boros market data comes from `useBorosMarkets`)
3. On error / empty response: falls back to full `DEMO_YIELD_POOLS`
4. The returned type remains `YieldPool[]` — no changes needed in `Yields.tsx` table rendering

**`usePendleStatus`** — new hook:
```typescript
export function usePendleStatus() {
  return useQuery({ queryKey: ["pendle-status"], queryFn: () => safeFetch('/api/pendle/status', null), staleTime: 60000 });
}
```

### `client/src/pages/Yields.tsx`

- Import `usePendleStatus`
- Add a small status indicator below the page title:
  - If `status.isStale`: amber warning "Data may be outdated"
  - Otherwise: muted "Updated X min ago"
- No structural changes to the table or chart

### `client/src/pages/Strategies.tsx`

In `StrategyCard`'s "Current Opportunity" panel, add a 5th stat cell:
- Label: "Best Pendle V2 PT"
- Value: best `details_impliedApy` across all active markets from `/api/pendle/markets?limit=5`
- Shown in secondary (blue) colour to distinguish from Boros teal rates
- Falls back to `"—"` if unavailable

---

## Data Flow

```
Pendle API (external)
    │  once per 5 min, server-side
    ▼
pendle-sync.ts  ──upsert──►  pendle-cache.db (SQLite)
                                    │
                         read on every request
                                    │
                                    ▼
              Express: GET /api/pendle/markets
                                    │
                         React Query (staleTime: 5min)
                                    │
                                    ▼
                          Yields.tsx table rows
                          Strategies.tsx stat cell
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Pendle API down at startup | Sync fails silently; DB is empty; frontend falls back to `DEMO_YIELD_POOLS` |
| Sync fails mid-operation | Stale data remains; error logged; next sync in 5 min |
| 429 rate limit hit | 65s backoff; no retry storm; frontend unaffected (served from cache) |
| Weekly CU < 5,000 | Sync pauses; `isStale: true` surfaced to frontend |
| `/api/pendle/markets` called with empty DB | Returns `[]`; frontend falls back to demo data |
| PM2 restart | DB persists on disk; next sync runs within 5 min of restart |

---

## Testing Checklist

- [ ] `pendle-cache.db` is created on server startup
- [ ] Initial sync populates `markets` table within 30 seconds
- [ ] `/api/pendle/markets` returns well-formed `YieldPool` array
- [ ] `/api/pendle/status` returns correct `lastSyncAt` and `marketCount`
- [ ] Yields page shows live Pendle V2 rows with real APYs and future maturity dates
- [ ] Yields page shows "Updated X min ago" indicator
- [ ] Strategies page shows "Best Pendle V2 PT" stat
- [ ] Killing the Pendle API (mock with wrong URL) causes frontend to fall back to demo data gracefully
- [ ] Sync does not fire more than once per 5 minutes under any condition
- [ ] 429 response triggers 65s backoff, not an immediate retry

---

## Files Changed Summary

| File | Change |
|---|---|
| `server/pendle-db.ts` | NEW |
| `server/pendle-sync.ts` | NEW |
| `server/routes.ts` | UPDATED — add 2 endpoints |
| `server/index.ts` | UPDATED — init sync on startup |
| `client/src/lib/api.ts` | UPDATED — useYieldPools, usePendleStatus |
| `client/src/pages/Yields.tsx` | UPDATED — status badge |
| `client/src/pages/Strategies.tsx` | UPDATED — Pendle V2 stat in opportunity panel |
| `package.json` | UPDATED — add better-sqlite3 |
