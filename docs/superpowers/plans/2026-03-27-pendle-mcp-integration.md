# Pendle V2 MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded demo data on the Yields and Strategies pages with live Pendle V2 market data fetched server-side on a 5-minute sync cycle.

**Architecture:** A `better-sqlite3` database (`pendle-cache.db`) is populated by a background sync loop that calls the Pendle API once every 5 minutes. Two Express endpoints (`/api/pendle/markets`, `/api/pendle/status`) serve the cached data to the frontend. The frontend's `useYieldPools` hook is updated to fetch from `/api/pendle/markets` instead of returning hardcoded demo data.

**Tech Stack:** Node.js/TypeScript, Express 5, better-sqlite3, React 18, TanStack React Query 5, Vite 7, esbuild (server bundle), PM2

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-03-27-pendle-mcp-integration-design.md`
- **Pendle API base:** `https://api-v2.pendle.finance/core`
- **Markets endpoint:** `GET /v1/markets?isExpired=false&limit=100&sortField=details_totalTvl&sortOrder=desc`
- **Free tier limits:** 100 CU/min, 200,000 CU/week. Each sync = ~10 CU. 5-min interval = ~20,160 CU/week.
- **`better-sqlite3` is a native addon** — must NOT be added to the esbuild bundle allowlist in `script/build.ts`. It stays external and is loaded from `node_modules/` at runtime.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/pendle-db.ts` | CREATE | SQLite init, schema creation, exports `initPendleDb()` |
| `server/pendle-sync.ts` | CREATE | 5-min sync loop, rate-limit tracking, circuit breaker |
| `server/routes.ts` | MODIFY | Add `db` param + `/api/pendle/markets` + `/api/pendle/status` |
| `server/index.ts` | MODIFY | Init db + sync on startup, pass `db` to `registerRoutes` |
| `client/src/lib/api.ts` | MODIFY | `useYieldPools` fetches live data; add `usePendleStatus` |
| `client/src/pages/Yields.tsx` | MODIFY | Add "Updated X min ago" status badge |
| `client/src/pages/Strategies.tsx` | MODIFY | Add "Best Pendle V2 PT" stat cell |
| `package.json` | MODIFY | Add `better-sqlite3` (dep) + `@types/better-sqlite3` (devDep) |
| `.gitignore` | MODIFY | Add `pendle-cache.db` |

---

## Task 1: Install dependencies and update .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install better-sqlite3**

```bash
cd /home/muffinman/boros-tools
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

Expected: `node_modules/better-sqlite3/` appears, `package.json` updated with `better-sqlite3` in `dependencies` and `@types/better-sqlite3` in `devDependencies`.

- [ ] **Step 2: Verify better-sqlite3 is NOT in the esbuild allowlist**

Open `script/build.ts`. Confirm `better-sqlite3` does not appear in the `allowlist` array. If it does, remove it. It must stay external so the `.node` native binary is loaded from `node_modules/` at runtime.

- [ ] **Step 3: Add pendle-cache.db to .gitignore**

Open `.gitignore` and add this line at the bottom:

```
pendle-cache.db
```

- [ ] **Step 4: Verify TypeScript is happy**

```bash
npm run check
```

Expected: no errors (type-only change so far).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add better-sqlite3 for Pendle data cache"
```

---

## Task 2: Create server/pendle-db.ts

**Files:**
- Create: `server/pendle-db.ts`

This module initialises the SQLite database on disk, creates the schema, and exports the `initPendleDb` function. It is imported once at server startup.

- [ ] **Step 1: Create the file**

Create `server/pendle-db.ts` with this exact content:

```typescript
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve relative to this source file, not process.cwd()
const DB_PATH = join(__dirname, "..", "pendle-cache.db");

const CREATE_MARKETS = `
CREATE TABLE IF NOT EXISTS markets (
  address                   TEXT    NOT NULL,
  chainId                   INTEGER NOT NULL,
  name                      TEXT,
  expiry                    TEXT,
  pt                        TEXT,
  yt                        TEXT,
  sy                        TEXT,
  underlyingAsset           TEXT,
  isNew                     INTEGER,
  isPrime                   INTEGER,
  isVolatile                INTEGER,
  details_liquidity         REAL,
  details_totalTvl          REAL,
  details_tradingVolume     REAL,
  details_underlyingApy     REAL,
  details_impliedApy        REAL,
  details_aggregatedApy     REAL,
  details_maxBoostedApy     REAL,
  details_totalPt           REAL,
  details_totalSy           REAL,
  details_totalSupply       REAL,
  points                    TEXT,
  externalProtocols         TEXT,
  PRIMARY KEY (chainId, address)
);
`;

const CREATE_SYNC_META = `
CREATE TABLE IF NOT EXISTS sync_meta (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  lastSyncAt       TEXT,
  weeklyRemaining  INTEGER,
  marketCount      INTEGER
);
INSERT OR IGNORE INTO sync_meta (id) VALUES (1);
`;

export function initPendleDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_MARKETS);
  db.exec(CREATE_SYNC_META);
  return db;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Smoke-test the DB initialises**

```bash
cd /home/muffinman/boros-tools
npx tsx -e "
import { initPendleDb } from './server/pendle-db.ts';
const db = initPendleDb();
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
console.log('Tables:', tables.map(t => t.name));
db.close();
"
```

Expected output:
```
Tables: [ 'markets', 'sync_meta' ]
```

- [ ] **Step 4: Commit**

```bash
git add server/pendle-db.ts
git commit -m "feat: add Pendle SQLite database schema"
```

---

## Task 3: Create server/pendle-sync.ts

**Files:**
- Create: `server/pendle-sync.ts`

This module runs the background sync loop. It fetches Pendle markets once on startup and then every 5 minutes. It tracks rate limits and implements a circuit breaker.

- [ ] **Step 1: Create the file**

Create `server/pendle-sync.ts`:

```typescript
import type Database from "better-sqlite3";

const PENDLE_API =
  "https://api-v2.pendle.finance/core/v1/markets?isExpired=false&limit=100&sortField=details_totalTvl&sortOrder=desc";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — never reduce this
const BACKOFF_MS = 65 * 1000;            // 65s on 429
const LOW_CU_THRESHOLD = 5_000;

function log(msg: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour12: true });
  console.log(`${t} [pendle-sync] ${msg}`);
}

async function syncMarkets(db: Database.Database): Promise<void> {
  // Circuit breaker: check weekly CU remaining
  const meta = db
    .prepare("SELECT weeklyRemaining FROM sync_meta WHERE id = 1")
    .get() as { weeklyRemaining: number | null } | undefined;

  const weeklyRemaining = meta?.weeklyRemaining ?? null;
  if (weeklyRemaining !== null && weeklyRemaining < LOW_CU_THRESHOLD) {
    log(`circuit breaker: weeklyRemaining=${weeklyRemaining} < ${LOW_CU_THRESHOLD}, skipping sync`);
    return;
  }

  let res: Response;
  try {
    res = await fetch(PENDLE_API, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    log(`fetch error: ${err}. Will retry next interval.`);
    return;
  }

  // Read rate-limit headers from every response
  const weeklyRemainingHeader = res.headers.get("x-ratelimit-weekly-remaining");
  const newWeeklyRemaining = weeklyRemainingHeader ? parseInt(weeklyRemainingHeader, 10) : null;

  if (res.status === 429) {
    log(`rate limited (429). Backing off ${BACKOFF_MS / 1000}s.`);
    setTimeout(() => syncMarkets(db), BACKOFF_MS);
    return;
  }

  if (!res.ok) {
    log(`unexpected status ${res.status}. Will retry next interval.`);
    return;
  }

  let body: any;
  try {
    body = await res.json();
  } catch (err) {
    log(`JSON parse error: ${err}. Will retry next interval.`);
    return;
  }

  const markets: any[] = Array.isArray(body?.results)
    ? body.results
    : Array.isArray(body)
    ? body
    : [];

  if (markets.length === 0) {
    log("response contained 0 markets — keeping stale data.");
    return;
  }

  // Upsert all markets
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO markets (
      address, chainId, name, expiry, pt, yt, sy, underlyingAsset,
      isNew, isPrime, isVolatile,
      details_liquidity, details_totalTvl, details_tradingVolume,
      details_underlyingApy, details_impliedApy, details_aggregatedApy,
      details_maxBoostedApy, details_totalPt, details_totalSy, details_totalSupply,
      points, externalProtocols
    ) VALUES (
      @address, @chainId, @name, @expiry, @pt, @yt, @sy, @underlyingAsset,
      @isNew, @isPrime, @isVolatile,
      @details_liquidity, @details_totalTvl, @details_tradingVolume,
      @details_underlyingApy, @details_impliedApy, @details_aggregatedApy,
      @details_maxBoostedApy, @details_totalPt, @details_totalSy, @details_totalSupply,
      @points, @externalProtocols
    )
  `);

  const upsertMany = db.transaction((rows: any[]) => {
    for (const m of rows) {
      upsert.run({
        address: m.address ?? "",
        chainId: m.chainId ?? 0,
        name: m.name ?? null,
        expiry: m.expiry ?? null,
        pt: m.pt?.address ?? m.pt ?? null,
        yt: m.yt?.address ?? m.yt ?? null,
        sy: m.sy?.address ?? m.sy ?? null,
        underlyingAsset: m.underlyingAsset?.address ?? m.underlyingAsset ?? null,
        isNew: m.isNew ? 1 : 0,
        isPrime: m.isPrime ? 1 : 0,
        isVolatile: m.isVolatile ? 1 : 0,
        details_liquidity: m.details?.liquidity ?? null,
        details_totalTvl: m.details?.totalTvl ?? null,
        details_tradingVolume: m.details?.tradingVolume ?? null,
        details_underlyingApy: m.details?.underlyingApy ?? null,
        details_impliedApy: m.details?.impliedApy ?? null,
        details_aggregatedApy: m.details?.aggregatedApy ?? null,
        details_maxBoostedApy: m.details?.maxBoostedApy ?? null,
        details_totalPt: m.details?.totalPt ?? null,
        details_totalSy: m.details?.totalSy ?? null,
        details_totalSupply: m.details?.totalSupply ?? null,
        points: m.points ? JSON.stringify(m.points) : null,
        externalProtocols: m.externalProtocols ? JSON.stringify(m.externalProtocols) : null,
      });
    }
  });

  upsertMany(markets);

  // Update sync_meta
  db.prepare(`
    INSERT OR REPLACE INTO sync_meta (id, lastSyncAt, weeklyRemaining, marketCount)
    VALUES (1, ?, ?, ?)
  `).run(new Date().toISOString(), newWeeklyRemaining, markets.length);

  log(`synced ${markets.length} markets. Weekly CU remaining: ${newWeeklyRemaining ?? "unknown"}`);
}

export function initPendleSync(db: Database.Database): void {
  // Initial sync — non-blocking, server starts regardless
  syncMarkets(db).catch((err) => log(`initial sync error: ${err}`));

  // Recurring sync — hard minimum 5 minutes
  setInterval(() => {
    syncMarkets(db).catch((err) => log(`scheduled sync error: ${err}`));
  }, SYNC_INTERVAL_MS);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Smoke-test the sync against the live API**

```bash
npx tsx -e "
import { initPendleDb } from './server/pendle-db.ts';
import { initPendleSync } from './server/pendle-sync.ts';
const db = initPendleDb();
initPendleSync(db);
// Wait 20 seconds for initial sync, then check
setTimeout(() => {
  const count = db.prepare('SELECT COUNT(*) as n FROM markets').get();
  const meta = db.prepare('SELECT * FROM sync_meta WHERE id=1').get();
  console.log('Market count:', count.n);
  console.log('Sync meta:', meta);
  db.close();
  process.exit(0);
}, 20000);
"
```

Expected output (values will vary):
```
[pendle-sync] synced 87 markets. Weekly CU remaining: 199980
Market count: 87
Sync meta: { id: 1, lastSyncAt: '2026-...', weeklyRemaining: 199980, marketCount: 87 }
```

If the API is unreachable, you will see a fetch error log and `Market count: 0` — this is fine (circuit breaker / fallback behaviour is tested later).

- [ ] **Step 4: Clean up test DB**

```bash
rm -f pendle-cache.db
```

- [ ] **Step 5: Commit**

```bash
git add server/pendle-sync.ts
git commit -m "feat: add Pendle background sync loop with rate-limit protection"
```

---

## Task 4: Update server/routes.ts and server/index.ts

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/index.ts`

This wires the db instance into the routes and adds the two new API endpoints.

- [ ] **Step 1: Update server/routes.ts**

Replace the entire content of `server/routes.ts`:

```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import type Database from "better-sqlite3";

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveAsset(name: string): string {
  if (!name) return "OTHER";
  const n = name.toUpperCase();
  if (/\b(WSTETH|STETH|WEETH|RSETH|EETH)\b/.test(n) || /\bETH\b/.test(n)) return "ETH";
  if (/\bCBBTC\b|\bWBTC\b|\bBTC\b/.test(n)) return "BTC";
  if (/\bSOL\b/.test(n)) return "SOL";
  if (/\bUSDC\b/.test(n)) return "USDC";
  if (/\bUSDT\b/.test(n)) return "USDT";
  if (/\bDAI\b/.test(n)) return "DAI";
  if (/\bGHO\b/.test(n)) return "GHO";
  if (/\bCRVUSD\b/.test(n)) return "crvUSD";
  if (/\bFRAX\b/.test(n)) return "FRAX";
  if (/\bPYUSD\b/.test(n)) return "pyUSD";
  // Fallback: first uppercase token (2+ chars) found after "PT-"
  const m = name.match(/PT-([A-Z]{2,})/);
  return m ? m[1] : "OTHER";
}

function deriveRisk(market: any): "Low" | "Medium" | "High" {
  if (market.isVolatile) return "High";
  const asset = deriveAsset(market.name ?? "");
  if (["ETH", "USDC", "USDT", "DAI", "GHO", "crvUSD", "FRAX", "pyUSD"].includes(asset)) return "Low";
  return "Medium";
}

function formatExpiry(expiry: string | null): string | undefined {
  if (!expiry) return undefined;
  try {
    return new Date(expiry).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return undefined;
  }
}

function marketToYieldPool(m: any) {
  // details_impliedApy is stored as a decimal fraction (e.g. 0.054 = 5.4%).
  // Multiply by 100 to get a display percentage.
  const apy = typeof m.details_impliedApy === "number" ? m.details_impliedApy * 100 : 0;
  return {
    protocol: "Pendle V2" as const,
    product: m.name ?? "Unknown Market",
    asset: deriveAsset(m.name ?? ""),
    apy,
    type: "Fixed" as const,
    maturity: formatExpiry(m.expiry),
    riskLevel: deriveRisk(m),
    sourceUrl: "https://app.pendle.finance/trade/markets",
    tvl: m.details_totalTvl ?? 0,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  db: Database.Database,
): Promise<Server> {

  // GET /api/pendle/markets
  app.get("/api/pendle/markets", (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
      const activeOnly = req.query.activeOnly !== "false";
      const minTvl = parseFloat(String(req.query.minTvl ?? "1000000"));

      const now = new Date().toISOString();
      let query = "SELECT * FROM markets WHERE 1=1";
      const params: any[] = [];

      if (activeOnly) {
        query += " AND expiry > ?";
        params.push(now);
      }
      if (!isNaN(minTvl)) {
        query += " AND details_totalTvl >= ?";
        params.push(minTvl);
      }
      query += " ORDER BY details_totalTvl DESC LIMIT ?";
      params.push(limit);

      const rows = db.prepare(query).all(...params);
      const pools = rows.map(marketToYieldPool);
      res.json(pools);
    } catch (err) {
      console.error("[pendle-routes] /api/pendle/markets error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/pendle/status
  app.get("/api/pendle/status", (req, res) => {
    try {
      const meta = db
        .prepare("SELECT lastSyncAt, weeklyRemaining, marketCount FROM sync_meta WHERE id = 1")
        .get() as { lastSyncAt: string | null; weeklyRemaining: number | null; marketCount: number | null } | undefined;

      const lastSyncAt = meta?.lastSyncAt ?? null;
      const STALE_MS = 15 * 60 * 1000;
      const isStale =
        lastSyncAt === null ||
        Date.now() - new Date(lastSyncAt).getTime() > STALE_MS;

      const nextSyncAt = lastSyncAt
        ? new Date(new Date(lastSyncAt).getTime() + 5 * 60 * 1000).toISOString()
        : new Date(Date.now() + 60_000).toISOString();

      res.json({
        lastSyncAt,
        nextSyncAt,
        marketCount: meta?.marketCount ?? 0,
        weeklyRemaining: meta?.weeklyRemaining ?? null,
        isStale,
      });
    } catch (err) {
      console.error("[pendle-routes] /api/pendle/status error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
```

- [ ] **Step 2: Update server/index.ts**

Add two static imports at the top of `server/index.ts`, alongside the existing imports:

```typescript
import { initPendleDb } from "./pendle-db";
import { initPendleSync } from "./pendle-sync";
```

Then inside the async IIFE, find:
```typescript
  await registerRoutes(httpServer, app);
```

Replace with:
```typescript
  const pendleDb = initPendleDb();
  initPendleSync(pendleDb);

  await registerRoutes(httpServer, app, pendleDb);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Start the dev server and test endpoints**

```bash
PORT=3457 npm run dev &
sleep 15  # wait for initial sync
```

Test the markets endpoint:
```bash
curl -s http://localhost:3457/api/pendle/markets | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Count: {len(data)}')
if data:
    print('First item:', json.dumps(data[0], indent=2))
"
```

Expected: `Count: N` (N > 0), first item has `protocol: "Pendle V2"`, `apy > 0`, future `maturity`.

Test the status endpoint:
```bash
curl -s http://localhost:3457/api/pendle/status | python3 -m json.tool
```

Expected: `lastSyncAt` is a recent timestamp, `isStale: false`, `marketCount > 0`.

- [ ] **Step 5: Stop dev server**

```bash
kill %1 2>/dev/null; rm -f pendle-cache.db
```

- [ ] **Step 6: Commit**

```bash
git add server/routes.ts server/index.ts
git commit -m "feat: add /api/pendle/markets and /api/pendle/status endpoints"
```

---

## Task 5: Update client/src/lib/api.ts

**Files:**
- Modify: `client/src/lib/api.ts`

Add `PendleStatus` type, update `useYieldPools` to fetch live data, add `usePendleStatus` hook.

- [ ] **Step 1: Add PendleStatus type and usePendleStatus hook**

At the top of `client/src/lib/api.ts`, after the existing imports, add this interface:

```typescript
export interface PendleStatus {
  lastSyncAt: string | null;
  nextSyncAt: string;
  marketCount: number;
  weeklyRemaining: number | null;
  isStale: boolean;
}
```

At the end of the file (before the `formatPercent` helpers), add:

```typescript
// Pendle sync status
export function usePendleStatus() {
  return useQuery<PendleStatus | null>({
    queryKey: ["pendle-status"],
    queryFn: () => safeFetch<PendleStatus>("/api/pendle/status", null),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Update useYieldPools to fetch live data**

The current `useYieldPools` function (lines 272–281) returns only `DEMO_YIELD_POOLS`. Replace it entirely:

```typescript
// Yield pools — Pendle V2 live data + Boros demo rows
export function useYieldPools() {
  return useQuery<YieldPool[]>({
    queryKey: ["yield-pools"],
    queryFn: async () => {
      try {
        const pendlePools = await safeFetch<YieldPool[]>("/api/pendle/markets", null);
        if (pendlePools && pendlePools.length > 0) {
          // Merge live Pendle data with Boros rows from demo (Boros has its own live API)
          const borosRows = DEMO_YIELD_POOLS.filter((p) => p.protocol === "Boros");
          return [...borosRows, ...pendlePools];
        }
      } catch {
        // fall through to demo data
      }
      return DEMO_YIELD_POOLS;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "feat: useYieldPools fetches live Pendle V2 markets, add usePendleStatus"
```

---

## Task 6: Update client/src/pages/Yields.tsx

**Files:**
- Modify: `client/src/pages/Yields.tsx`

Add the "Updated X min ago" status badge below the page title.

- [ ] **Step 1: Import usePendleStatus**

At the top of `Yields.tsx`, find the existing import:
```typescript
import { useYieldPools, formatPercent, formatUSD } from "@/lib/api";
```

Replace with:
```typescript
import { useYieldPools, formatPercent, formatUSD, usePendleStatus } from "@/lib/api";
```

- [ ] **Step 2: Add status hook and helper**

Inside the `Yields` component function, after the existing hooks, add:

```typescript
  const { data: pendleStatus } = usePendleStatus();

  function syncAgeLabel(): string | null {
    if (!pendleStatus?.lastSyncAt) return null;
    const ageMs = Date.now() - new Date(pendleStatus.lastSyncAt).getTime();
    const mins = Math.floor(ageMs / 60_000);
    return mins < 1 ? "just now" : `${mins} min ago`;
  }
  const ageLabel = syncAgeLabel();
```

- [ ] **Step 3: Add status badge to JSX**

Find the existing title block in the JSX:
```tsx
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Yield Comparison</h1>
        <p className="text-sm text-muted-foreground">Compare Boros vs DeFi vs CeFi yields</p>
      </div>
```

Replace with:
```tsx
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-xl font-bold">Yield Comparison</h1>
          {pendleStatus && (
            pendleStatus.isStale ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-chart-4/10 text-chart-4 border border-chart-4/30">
                Data may be outdated
              </span>
            ) : ageLabel ? (
              <span className="text-[11px] text-muted-foreground">
                Updated {ageLabel}
              </span>
            ) : null
          )}
        </div>
        <p className="text-sm text-muted-foreground">Compare Boros vs DeFi vs CeFi yields</p>
      </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Yields.tsx
git commit -m "feat: add live sync status badge to Yields page"
```

---

## Task 7: Update client/src/pages/Strategies.tsx

**Files:**
- Modify: `client/src/pages/Strategies.tsx`

Add a "Best Pendle V2 PT" stat cell to the "Current Opportunity" panel in each strategy card.

- [ ] **Step 1: Import useYieldPools**

At the top of `Strategies.tsx`, find:
```typescript
import { useBorosMarkets, formatPercent } from "@/lib/api";
```

Replace with:
```typescript
import { useBorosMarkets, useYieldPools, formatPercent } from "@/lib/api";
```

- [ ] **Step 2: Add Pendle best rate logic to StrategyCard**

Inside `StrategyCard`, after the existing `ethMarket` line, add:

```typescript
  const { data: pools } = useYieldPools();
  const bestPendleApy = pools
    ?.filter((p) => p.protocol === "Pendle V2" && p.apy > 0)
    .sort((a, b) => b.apy - a.apy)[0]?.apy ?? null;
```

- [ ] **Step 3: Update the opportunity grid**

Find the grid in the "Current opportunity" section:
```tsx
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
```

Change it to:
```tsx
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
```

Then find the closing `</div>` of the last stat cell (the "Best For" cell). After it, add a new cell:

The last existing cell looks like:
```tsx
              <div>
                <p className="text-[11px] text-muted-foreground">Best For</p>
                <p className="text-sm text-muted-foreground">{strategy.who}</p>
              </div>
```

Add this new cell immediately after it:
```tsx
              <div>
                <p className="text-[11px] text-muted-foreground">Best Pendle V2 PT</p>
                <p className="text-sm font-bold tabular-nums text-secondary">
                  {bestPendleApy !== null ? `+${bestPendleApy.toFixed(2)}%` : "—"}
                </p>
              </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Strategies.tsx
git commit -m "feat: add live Best Pendle V2 PT stat to Strategies page"
```

---

## Task 8: Build, deploy, and verify

**Files:**
- No new files — production build + PM2 restart

- [ ] **Step 1: Run the production build**

```bash
cd /home/muffinman/boros-tools
npm run build 2>&1
```

Expected:
```
building client...
✓ built in X.XXs
building server...
  dist/index.cjs  XXXkb
⚡ Done in XXms
```

No errors. `better-sqlite3` should appear in the esbuild output as "external" (not bundled), which is correct.

- [ ] **Step 2: Verify better-sqlite3 is external in the bundle**

```bash
grep -c "better-sqlite3" dist/index.cjs || echo "0 matches - correctly external"
```

Expected: `0 matches - correctly external` (it's required via `node_modules`, not inlined).

- [ ] **Step 3: Ensure node_modules are present for native addon**

`better-sqlite3` is a native addon that cannot be bundled. It must be in `node_modules/` at runtime:

```bash
npm install --omit=dev
```

Expected: `better-sqlite3` and its `.node` binary are present in `node_modules/`.

- [ ] **Step 4: Restart PM2**

```bash
pm2 restart boros-tools
pm2 logs boros-tools --lines 30 --nostream
```

Expected log output includes:
```
[pendle-sync] synced N markets. Weekly CU remaining: XXXXX
```

If you see `fetch error` instead, the Pendle API may be temporarily unavailable — this is safe. The endpoint will return demo data until the sync succeeds.

- [ ] **Step 5: Test endpoints on production**

```bash
curl -s https://boros.lekker.design/api/pendle/markets | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Count: {len(data)}')
if data: print('First:', data[0]['product'], data[0]['apy'])
"

curl -s https://boros.lekker.design/api/pendle/status | python3 -m json.tool
```

Expected:
- Markets: count > 0, products are real Pendle market names, APYs are realistic (2–20%)
- Status: `isStale: false`, `lastSyncAt` is recent

- [ ] **Step 6: Verify Yields page in browser**

Open https://boros.lekker.design/yields in a browser.

Check:
- "Updated X min ago" badge appears next to the title
- Pendle V2 rows in the table have **future** maturity dates (not "Mar 27, 2026")
- APYs are plausible live values (not fixed 4.18% / 5.92% from demo data)
- Boros rows are still present at the top

- [ ] **Step 7: Verify Strategies page in browser**

Open https://boros.lekker.design/strategies and expand any strategy card.

Check:
- "Best Pendle V2 PT" stat cell appears in the 5th column
- Value shows a percentage (e.g. `+8.45%`) in blue, not `"—"`
- Mobile layout (narrow viewport): 5-column grid collapses to 2 columns without broken layout

- [ ] **Step 8: Final commit**

```bash
git add dist/ package-lock.json
git commit -m "chore: production build with Pendle V2 live data integration"
```

---

## Rollback

If anything goes wrong after deployment:

```bash
# Revert to demo data immediately by restarting with old build
pm2 restart boros-tools

# If the DB is corrupted:
rm -f pendle-cache.db
pm2 restart boros-tools
# The server will start with an empty DB and fall back to demo data
# until the next successful sync
```

The frontend always falls back to `DEMO_YIELD_POOLS` if `/api/pendle/markets` returns an error or empty array — users will never see a broken page.
