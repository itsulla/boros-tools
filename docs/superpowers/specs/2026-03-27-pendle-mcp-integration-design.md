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
  ├── server/pendle-db.ts      NEW — SQLite init + schema (markets, sync_meta tables)
  ├── server/pendle-sync.ts    NEW — 5-min sync loop, rate-limit tracking, circuit breaker
  ├── server/routes.ts         UPDATED — /api/pendle/markets, /api/pendle/status
  └── server/index.ts          UPDATED — init db + sync on startup, pass db to registerRoutes

Frontend
  ├── client/src/lib/api.ts    UPDATED — useYieldPools, usePendleStatus
  ├── client/src/pages/Yields.tsx      UPDATED — live rows + last-updated badge
  └── client/src/pages/Strategies.tsx  UPDATED — best Pendle V2 rate in opportunity panel

New npm dependencies:
  dependencies:     better-sqlite3
  devDependencies:  @types/better-sqlite3
```

### Deployment note: `better-sqlite3` is a native addon

`better-sqlite3` ships a prebuilt `.node` binary. It **cannot** be bundled by esbuild and must not be added to the bundle allowlist in `script/build.ts`. It must remain an external module. This means `node_modules/` must be present in the PM2 working directory at runtime. After deploying `dist/`, run `npm install --omit=dev` in the project root so `better-sqlite3` (and its `.node` file) are available to `dist/index.cjs`.

The SQLite database file `pendle-cache.db` must be added to `.gitignore`.

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
2. **Weekly CU circuit breaker** — every response includes `X-RateLimit-Weekly-Remaining`. Store the value in `sync_meta.weeklyRemaining` after each sync. At the start of each sync, read this value. If it is a non-null number less than 5,000, skip the sync and log a warning. If it is `NULL` (first boot, no prior sync), treat as "no data yet — proceed with sync".
3. **429 backoff** — on a 429 response, back off 65 seconds (1 min + 5s buffer) before the next attempt. Never retries immediately.
4. **Zero on-demand Pendle API calls** — all `/api/pendle/*` endpoints read from SQLite only. Pendle's API is never called in response to user HTTP traffic. Even 10,000 concurrent visitors generate exactly 1 Pendle API request every 5 minutes.
5. **Stale data tolerance** — if a sync fails, the previous cached data remains available. The `/api/pendle/status` endpoint reports `isStale: true` when `lastSyncAt === null || Date.now() - Date.parse(lastSyncAt) > 15 * 60 * 1000`. There is no separate special-casing for the circuit breaker — once 15 minutes elapse without a successful sync, `isStale` becomes true naturally.

---

## Backend: New Files

### `server/pendle-db.ts`

Initialises a `better-sqlite3` database. The file path must be resolved relative to the source file, **not** `process.cwd()`, to work correctly when PM2 starts the process from a different working directory:

```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'pendle-cache.db');
```

Creates two tables:

**`markets` table** — flat schema mirroring the MCP server's storage:
- Primary key: `(chainId, address)`
- Columns: `address`, `chainId`, `name`, `expiry`, `pt`, `yt`, `sy`, `underlyingAsset`, `isNew`, `isPrime`, `isVolatile`, `details_liquidity`, `details_totalTvl`, `details_tradingVolume`, `details_underlyingApy`, `details_impliedApy`, `details_aggregatedApy`, `details_maxBoostedApy`, `details_totalPt`, `details_totalSy`, `details_totalSupply`, `points`, `externalProtocols`

**`sync_meta` table** — single-row table tracking sync state:
```sql
CREATE TABLE IF NOT EXISTS sync_meta (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  lastSyncAt       TEXT,
  weeklyRemaining  INTEGER,
  marketCount      INTEGER
);
INSERT OR IGNORE INTO sync_meta (id) VALUES (1);
```
Updated with `INSERT OR REPLACE INTO sync_meta (id, lastSyncAt, weeklyRemaining, marketCount) VALUES (1, ?, ?, ?)`.

Exports: `initPendleDb(): Database`

### `server/pendle-sync.ts`

Exports: `initPendleSync(db: Database): void`

Responsibilities:
- On call: runs an initial sync immediately (async, non-blocking — server starts regardless)
- Schedules a recurring sync every 5 minutes via `setInterval`
- Sync function:
  1. Read `weeklyRemaining` from `sync_meta`. If it is a non-null number < 5,000, log a warning and skip this cycle.
  2. Call `GET https://api-v2.pendle.finance/core/v1/markets?isExpired=false&limit=100&sortField=details_totalTvl&sortOrder=desc`. This returns markets across all supported chains (Ethereum, Arbitrum, BSC, etc.) — multi-chain is intentional and desirable for the Yields page.
  3. Read `X-RateLimit-Weekly-Remaining` header from the response. Store in `sync_meta.weeklyRemaining`.
  4. On 429: log warning, schedule one retry via `setTimeout(sync, 65_000)`. Do not proceed with the current attempt.
  5. On success: upsert all market rows via `INSERT OR REPLACE INTO markets (...)`. Update `sync_meta` with current timestamp and market count.
  6. On any other error: log error, leave stale data intact, let next regular interval handle retry.

The sync function must record API field units correctly: the Pendle API returns `impliedApy` (and all APY fields) as a **decimal fraction** (e.g., `0.0542` = 5.42%). This value is stored as-is in `details_impliedApy`. The `* 100` conversion to display percentage happens only in the route handler when mapping to `YieldPool`.

---

## Backend: Updated Files

### `server/routes.ts`

The `registerRoutes` signature is updated to accept the db instance:

```typescript
export async function registerRoutes(
  httpServer: Server,
  app: Express,
  db: Database,
): Promise<Server>
```

**`GET /api/pendle/markets`**

Query params (all optional):
- `limit` — integer, default 50, max 100
- `activeOnly` — boolean string, default `"true"` — filters `expiry > now()`
- `minTvl` — number, default `1000000` — filters `details_totalTvl >= minTvl`

Queries SQLite. Maps each row to the `YieldPool` shape:

```typescript
{
  protocol: "Pendle V2",
  product: market.name,               // e.g. "PT-weETH-27JUN2026"
  asset: deriveAsset(market.name),    // see mapping below
  apy: market.details_impliedApy * 100,  // stored as 0.054 → display as 5.4%
  type: "Fixed",
  maturity: formatExpiry(market.expiry),  // "Jun 27, 2026"
  riskLevel: deriveRisk(market),          // Low for ETH/stable, Medium otherwise
  sourceUrl: "https://app.pendle.finance/trade/markets",
  tvl: market.details_totalTvl,
}
```

`deriveAsset(name: string)` — pattern-matches market name against known substrings:
- Contains `ETH`, `stETH`, `weETH`, `eETH`, `wstETH`, `rsETH` → `"ETH"`
- Contains `USDC` → `"USDC"`; `USDT` → `"USDT"`; `DAI` → `"DAI"`; `GHO` → `"GHO"`; `crvUSD` → `"crvUSD"`; `FRAX` → `"FRAX"`
- Contains `BTC`, `wBTC`, `cbBTC` → `"BTC"`
- Contains `SOL` → `"SOL"`
- Fallback: first all-caps token (≥2 chars) found in name, else `"OTHER"`

`deriveRisk(market)` — `"Low"` for ETH and stablecoins; `"High"` if `market.isVolatile === 1`; else `"Medium"`.

**`GET /api/pendle/status`**

Reads `sync_meta` row. Returns:
```typescript
{
  lastSyncAt: string | null,
  nextSyncAt: string,           // lastSyncAt + 5min, or "imminent" if null
  marketCount: number,
  weeklyRemaining: number | null,
  isStale: boolean,             // lastSyncAt === null || age > 15 min
}
```

### `server/index.ts`

```typescript
import { initPendleDb } from './pendle-db.js';
import { initPendleSync } from './pendle-sync.js';

// after createServer(app):
const pendleDb = initPendleDb();
initPendleSync(pendleDb);

// pass db into registerRoutes:
await registerRoutes(server, app, pendleDb);
```

---

## Frontend: Updated Files

### `client/src/lib/api.ts`

**`useYieldPools`** — updated:
1. Fetches `GET /api/pendle/markets`
2. On success: merges with Boros-protocol rows from `DEMO_YIELD_POOLS` (keeps Boros rows since those come from the Boros API separately)
3. On error / empty response: falls back to full `DEMO_YIELD_POOLS`
4. Returned type remains `YieldPool[]` — no changes needed in `Yields.tsx` table rendering

**`usePendleStatus`** — new hook:
```typescript
export function usePendleStatus() {
  return useQuery({
    queryKey: ["pendle-status"],
    queryFn: () => safeFetch<PendleStatus>('/api/pendle/status', null),
    staleTime: 60000,
  });
}
```
Returns `PendleStatus | null`. All consumers must null-guard before accessing fields.

### `client/src/pages/Yields.tsx`

- Import `usePendleStatus`
- Null-guard: `const status = usePendleStatus().data ?? null`
- Add status indicator below page title (only when `status !== null`):
  - `status.isStale` → amber "Data may be outdated"
  - otherwise → muted "Updated X min ago" using `status.lastSyncAt`

### `client/src/pages/Strategies.tsx`

In `StrategyCard`'s "Current Opportunity" panel, add a 5th stat. The panel currently uses `grid grid-cols-2 sm:grid-cols-4`. Change to `grid grid-cols-2 sm:grid-cols-5` to accommodate the new cell cleanly. The new cell:
- Label: "Best Pendle V2 PT"
- Value: highest `apy` from `useYieldPools().data?.filter(p => p.protocol === "Pendle V2")[0]?.apy`
- Displayed in `text-secondary` (blue) to distinguish from Boros teal
- Displays `"—"` if data is unavailable

---

## Data Flow

```
Pendle API (external)
    │  once per 5 min, server-side only
    ▼
pendle-sync.ts  ──upsert──►  pendle-cache.db (SQLite, on disk)
                                    │
                         read on every request (no API call)
                                    │
                                    ▼
              Express: GET /api/pendle/markets
              Express: GET /api/pendle/status
                                    │
                         React Query (staleTime: 5min)
                                    │
                                    ▼
                          Yields.tsx table rows + status badge
                          Strategies.tsx "Best Pendle V2 PT" cell
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Pendle API down at startup | Initial sync fails silently; DB has no rows; frontend falls back to `DEMO_YIELD_POOLS` |
| Sync fails mid-operation | Stale data remains in DB; error logged; next sync in 5 min |
| 429 rate limit hit | 65s single retry; no retry storm; frontend unaffected (served from SQLite) |
| Weekly CU < 5,000 | Sync skips; `isStale: true` surfaces after 15 min; logged as warning |
| `weeklyRemaining` is NULL (first boot) | Treat as "proceed" — no historical data to block on |
| `/api/pendle/markets` with empty DB | Returns `[]`; frontend falls back to demo data |
| PM2 restart | `pendle-cache.db` persists on disk; first sync within 5 min of restart |
| `usePendleStatus` returns null | Components must null-guard before accessing `.isStale` or `.lastSyncAt` |

---

## Testing Checklist

- [ ] `pendle-cache.db` is created on server startup (in correct directory, not `process.cwd()`)
- [ ] `pendle-cache.db` is in `.gitignore`
- [ ] Initial sync populates `markets` table within 30 seconds of server start
- [ ] `/api/pendle/markets` returns well-formed `YieldPool` array with `apy > 0`
- [ ] `/api/pendle/status` returns correct `lastSyncAt`, `marketCount`, and `isStale: false`
- [ ] Yields page shows live Pendle V2 rows with real APYs and future maturity dates
- [ ] Yields page shows "Updated X min ago" status badge
- [ ] Strategies page shows "Best Pendle V2 PT" stat in opportunity panel
- [ ] `sm:grid-cols-5` layout on Strategies page does not break mobile (2-col) layout
- [ ] Setting `PENDLE_API_URL` to a bad URL causes frontend to fall back to demo data gracefully
- [ ] Sync does not fire more than once per 5 minutes under any condition
- [ ] 429 response triggers exactly one 65s-delayed retry, not an immediate one
- [ ] Simulating `weeklyRemaining < 5000` in DB causes sync to skip with logged warning
- [ ] First boot with empty `sync_meta` (NULL `weeklyRemaining`) proceeds with sync correctly
- [ ] `better-sqlite3` loads correctly in production (`dist/index.cjs` + `node_modules/`)

---

## Files Changed Summary

| File | Change |
|---|---|
| `server/pendle-db.ts` | NEW |
| `server/pendle-sync.ts` | NEW |
| `server/routes.ts` | UPDATED — add `db` param + 2 endpoints |
| `server/index.ts` | UPDATED — init db + sync, pass db to registerRoutes |
| `client/src/lib/api.ts` | UPDATED — useYieldPools, usePendleStatus |
| `client/src/pages/Yields.tsx` | UPDATED — status badge + null guard |
| `client/src/pages/Strategies.tsx` | UPDATED — 5th stat cell, grid-cols-5 |
| `package.json` | UPDATED — `better-sqlite3` in deps, `@types/better-sqlite3` in devDeps |
| `.gitignore` | UPDATED — add `pendle-cache.db` |
