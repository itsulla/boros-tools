# Pendle Tools Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new Pendle tools to boros.lekker.design: Fixed Yield Calculator, Maturity Calendar, Yield History Charts, and Rewards Explorer.

**Architecture:** The backend gets 3 new endpoints — `/api/pendle/markets-raw` (returns raw market data with chainId/address), `/api/pendle/history` (proxies APY history), and `/api/pendle/market-detail` (proxies single market detail). On-demand endpoints use an in-memory cache with request deduplication to stay within the Pendle API free tier. The frontend gets 4 new pages and a "Pendle Tools" dropdown in the navbar.

**Tech Stack:** Node.js/TypeScript, Express 5, better-sqlite3, React 18, wouter (hash routing), TanStack React Query 5, Recharts 2, Tailwind CSS, shadcn/ui

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-03-27-pendle-tools-expansion-design.md`
- **Existing routes:** `server/routes.ts` — has `/api/pendle/markets` and `/api/pendle/status`
- **Existing sync:** `server/pendle-sync.ts` — syncs 116 markets across 10 chains every 5 min
- **Existing DB:** `server/pendle-db.ts` — SQLite with `markets` and `sync_meta` tables
- **Routing:** wouter with `useHashLocation` — routes like `/calculator` become `/#/calculator` in browser
- **Pendle API:** `https://api-v2.pendle.finance/core/v1`
- **CU budget:** 200k/week free tier, currently using ~22k

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/pendle-db.ts` | MODIFY | Add `categoryIds` column migration |
| `server/pendle-sync.ts` | MODIFY | Store `categoryIds` during upsert |
| `server/pendle-cache.ts` | CREATE | In-memory cache with request deduplication |
| `server/routes.ts` | MODIFY | Add 3 new endpoints: markets-raw, history, market-detail |
| `client/src/lib/constants.ts` | MODIFY | Add `PENDLE_TOOLS_LINKS` |
| `client/src/lib/api.ts` | MODIFY | Add hooks: `usePendleMarketList`, `usePendleHistory`, `usePendleMarketDetail` |
| `client/src/components/Layout.tsx` | MODIFY | Add "Pendle Tools" dropdown to navbar + footer |
| `client/src/App.tsx` | MODIFY | Add 4 new routes |
| `client/src/pages/Calculator.tsx` | CREATE | Fixed Yield Calculator page |
| `client/src/pages/Calendar.tsx` | CREATE | Maturity Calendar page |
| `client/src/pages/History.tsx` | CREATE | Yield History Charts page |
| `client/src/pages/Rewards.tsx` | CREATE | Rewards Explorer page |

---

## Task 1: Schema + sync update (categoryIds)

**Files:**
- Modify: `server/pendle-db.ts`
- Modify: `server/pendle-sync.ts`

- [ ] **Step 1: Add categoryIds column migration to pendle-db.ts**

In `server/pendle-db.ts`, in the `initPendleDb` function, after `db.exec(CREATE_SYNC_META)`, add:

```typescript
  // Migration: add categoryIds column (idempotent)
  try {
    db.exec("ALTER TABLE markets ADD COLUMN categoryIds TEXT");
  } catch {
    // Column already exists — ignore
  }
```

- [ ] **Step 2: Update pendle-sync.ts upsert to store categoryIds**

In `server/pendle-sync.ts`, find the upsert SQL statement. Add `categoryIds` to both the column list and VALUES list:

In the column list (after `externalProtocols`):
```
      points, externalProtocols, categoryIds
```

In the VALUES (after `@externalProtocols`):
```
      @points, @externalProtocols, @categoryIds
```

In the `upsert.run({...})` block, after the `externalProtocols` line, add:
```typescript
        categoryIds: m.categoryIds ? JSON.stringify(m.categoryIds) : null,
```

- [ ] **Step 3: Verify and commit**

```bash
cd /home/muffinman/boros-tools
npm run check
rm -f pendle-cache.db
npx tsx -e "
import { initPendleDb } from './server/pendle-db.ts';
import { initPendleSync } from './server/pendle-sync.ts';
const db = initPendleDb();
initPendleSync(db);
setTimeout(() => {
  const r = db.prepare(\"SELECT name, categoryIds FROM markets WHERE categoryIds IS NOT NULL LIMIT 3\").all();
  console.log('Markets with categoryIds:', r.length > 0 ? 'YES' : 'NONE');
  for (const m of r) console.log(m.name, '|', m.categoryIds);
  db.close(); process.exit(0);
}, 20000);
"
rm -f pendle-cache.db
git add server/pendle-db.ts server/pendle-sync.ts
git commit -m "feat: sync categoryIds from Pendle active markets"
```

---

## Task 2: In-memory cache + new server endpoints

**Files:**
- Create: `server/pendle-cache.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Create server/pendle-cache.ts**

```typescript
const cache = new Map<string, { data: any; expiresAt: number; pending?: Promise<any> }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 200;

export async function cachedFetch(key: string, fetchFn: () => Promise<any>): Promise<any> {
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && entry.expiresAt > now && entry.data) return entry.data;
  if (entry?.pending) return entry.pending;

  const promise = fetchFn()
    .then((data) => {
      cache.set(key, { data, expiresAt: now + CACHE_TTL });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { data: null, expiresAt: 0, pending: promise });

  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  return promise;
}
```

- [ ] **Step 2: Add 3 new endpoints to server/routes.ts**

Add `import { cachedFetch } from "./pendle-cache";` at the top.

Then add these 3 endpoints inside `registerRoutes`, before `return httpServer`:

```typescript
  // GET /api/pendle/markets-raw — raw market data with chainId, address, expiry
  app.get("/api/pendle/markets-raw", (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10), 200);
      const activeOnly = req.query.activeOnly !== "false";
      const minTvl = parseFloat(String(req.query.minTvl ?? "0"));
      const hasPoints = req.query.hasPoints === "true";

      const now = new Date().toISOString();
      let query = "SELECT * FROM markets WHERE 1=1";
      const params: any[] = [];

      if (activeOnly) { query += " AND expiry > ?"; params.push(now); }
      if (!isNaN(minTvl) && minTvl > 0) { query += " AND details_totalTvl >= ?"; params.push(minTvl); }
      if (hasPoints) { query += " AND categoryIds LIKE '%points%'"; }
      query += " ORDER BY details_totalTvl DESC LIMIT ?";
      params.push(limit);

      const rows = db.prepare(query).all(...params) as any[];
      const result = rows.map((m) => ({
        address: m.address,
        chainId: m.chainId,
        name: m.name,
        expiry: m.expiry,
        asset: deriveAsset(m.name ?? ""),
        impliedApy: m.details_impliedApy ?? 0,
        underlyingApy: m.details_underlyingApy ?? 0,
        aggregatedApy: m.details_aggregatedApy ?? 0,
        totalTvl: m.details_totalTvl ?? 0,
        liquidity: m.details_liquidity ?? 0,
        categoryIds: m.categoryIds ? JSON.parse(m.categoryIds) : [],
        isNew: !!m.isNew,
        isPrime: !!m.isPrime,
      }));
      res.json(result);
    } catch (err) {
      console.error("[pendle-routes] /api/pendle/markets-raw error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/pendle/history — proxied APY history for a single market
  app.get("/api/pendle/history", async (req, res) => {
    const { chainId, address } = req.query;
    if (!chainId || !address) {
      return res.status(400).json({ error: "chainId and address are required" });
    }
    try {
      const key = `history:${chainId}:${address}`;
      const data = await cachedFetch(key, async () => {
        const url = `https://api-v2.pendle.finance/core/v1/${chainId}/markets/${address}/apy-history?timeFrame=week`;
        const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
        if (!r.ok) throw new Error(`Pendle API returned ${r.status}`);
        return r.json();
      });
      res.json(data);
    } catch (err) {
      console.error("[pendle-routes] /api/pendle/history error:", err);
      res.status(502).json({ error: "Unable to fetch history" });
    }
  });

  // GET /api/pendle/market-detail — proxied single market detail
  app.get("/api/pendle/market-detail", async (req, res) => {
    const { chainId, address } = req.query;
    if (!chainId || !address) {
      return res.status(400).json({ error: "chainId and address are required" });
    }
    try {
      const key = `detail:${chainId}:${address}`;
      const data = await cachedFetch(key, async () => {
        const url = `https://api-v2.pendle.finance/core/v1/${chainId}/markets/${address}`;
        const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
        if (!r.ok) throw new Error(`Pendle API returned ${r.status}`);
        return r.json();
      });
      res.json(data);
    } catch (err) {
      console.error("[pendle-routes] /api/pendle/market-detail error:", err);
      res.status(502).json({ error: "Unable to fetch market detail" });
    }
  });
```

- [ ] **Step 3: Verify and commit**

```bash
npm run check
git add server/pendle-cache.ts server/routes.ts
git commit -m "feat: add markets-raw, history, and market-detail endpoints with dedup cache"
```

---

## Task 3: Frontend hooks + navigation

**Files:**
- Modify: `client/src/lib/constants.ts`
- Modify: `client/src/lib/api.ts`
- Modify: `client/src/components/Layout.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add PENDLE_TOOLS_LINKS to constants.ts**

After the existing `NAV_LINKS`, add:

```typescript
export const PENDLE_TOOLS_LINKS = [
  { label: "Calculator", href: "/calculator" },
  { label: "Calendar", href: "/calendar" },
  { label: "History", href: "/history" },
  { label: "Rewards", href: "/rewards" },
] as const;
```

- [ ] **Step 2: Add new hooks to api.ts**

Add these interfaces and hooks to `client/src/lib/api.ts`:

After the `PendleStatus` interface, add:

```typescript
export interface PendleMarketRaw {
  address: string;
  chainId: number;
  name: string;
  expiry: string;
  asset: string;
  impliedApy: number;
  underlyingApy: number;
  aggregatedApy: number;
  totalTvl: number;
  liquidity: number;
  categoryIds: string[];
  isNew: boolean;
  isPrime: boolean;
}
```

Before the `formatPercent` helpers, add:

```typescript
// Raw Pendle market list (with chainId, address, expiry)
export function usePendleMarketList(params?: { hasPoints?: boolean; minTvl?: number }) {
  const qs = new URLSearchParams();
  if (params?.hasPoints) qs.set("hasPoints", "true");
  if (params?.minTvl) qs.set("minTvl", String(params.minTvl));
  return useQuery<PendleMarketRaw[]>({
    queryKey: ["pendle-markets-raw", params?.hasPoints, params?.minTvl],
    queryFn: () => safeFetch<PendleMarketRaw[] | null>(`/api/pendle/markets-raw?${qs}`, null).then((d) => d ?? []),
    staleTime: 300_000,
  });
}

// APY history for a single market
export function usePendleHistory(chainId: number | null, address: string | null) {
  return useQuery({
    queryKey: ["pendle-history", chainId, address],
    queryFn: () => safeFetch<any>(`/api/pendle/history?chainId=${chainId}&address=${address}`, null),
    enabled: chainId !== null && address !== null,
    staleTime: 300_000,
  });
}

// Single market detail (for reward breakdown)
export function usePendleMarketDetail(chainId: number | null, address: string | null) {
  return useQuery({
    queryKey: ["pendle-market-detail", chainId, address],
    queryFn: () => safeFetch<any>(`/api/pendle/market-detail?chainId=${chainId}&address=${address}`, null),
    enabled: chainId !== null && address !== null,
    staleTime: 300_000,
  });
}
```

- [ ] **Step 3: Update Layout.tsx — add Pendle Tools dropdown to navbar**

Add to the imports at the top of `Layout.tsx`:
```typescript
import { NAV_LINKS, PENDLE_TOOLS_LINKS, BOROS_REFERRAL_URL, EXTERNAL_LINKS } from "@/lib/constants";
import { ChevronDown } from "lucide-react";
```
(Replace the existing import line and add `ChevronDown` to the lucide imports.)

In the desktop nav section (after the `NAV_LINKS.map(...)` block, but still inside `<div className="hidden md:flex items-center gap-1">`), add the Pendle Tools dropdown:

```tsx
            {/* Pendle Tools dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-0.5 px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pendle Tools
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute top-full right-0 mt-1 w-40 bg-card border border-card-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="py-1">
                  {PENDLE_TOOLS_LINKS.map((link) => {
                    const isActive = location === link.href;
                    return (
                      <Link key={link.href} href={link.href}>
                        <span className={`block px-4 py-2 text-[13px] cursor-pointer transition-colors ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"}`}>
                          {link.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
```

In the mobile menu, after the existing `NAV_LINKS.map(...)` block, add:

```tsx
            <div className="border-t border-border/30 mt-2 pt-2">
              <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Pendle Tools</p>
              {PENDLE_TOOLS_LINKS.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <span
                      onClick={() => setMobileOpen(false)}
                      className={`block px-3 py-2 text-sm cursor-pointer ${isActive ? "text-primary border-l-2 border-primary pl-2.5" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>
```

In the Footer, add the Pendle Tools section. Find the "Tools" column that maps `NAV_LINKS`. After it, add a new column or merge the Pendle tools into the existing Tools column. The simplest: in the existing Tools footer section, after the `NAV_LINKS.map(...)` block, add:

```tsx
              {PENDLE_TOOLS_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    {link.label}
                  </span>
                </Link>
              ))}
```

- [ ] **Step 4: Add routes to App.tsx**

Add imports at the top:
```typescript
import Calculator from "@/pages/Calculator";
import Calendar from "@/pages/Calendar";
import History from "@/pages/History";
import Rewards from "@/pages/Rewards";
```

Add routes inside the `<Switch>`, before the `<Route component={NotFound} />` catch-all:
```tsx
      <Route path="/calculator" component={Calculator} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/history" component={History} />
      <Route path="/rewards" component={Rewards} />
```

- [ ] **Step 5: Create placeholder pages**

Create 4 placeholder files so the app compiles. Each is identical except for the title:

`client/src/pages/Calculator.tsx`:
```tsx
import { PageContainer } from "@/components/Layout";
export default function Calculator() {
  return <PageContainer><h1 className="font-display text-xl font-bold">Calculator</h1></PageContainer>;
}
```

`client/src/pages/Calendar.tsx`:
```tsx
import { PageContainer } from "@/components/Layout";
export default function Calendar() {
  return <PageContainer><h1 className="font-display text-xl font-bold">Calendar</h1></PageContainer>;
}
```

`client/src/pages/History.tsx`:
```tsx
import { PageContainer } from "@/components/Layout";
export default function History() {
  return <PageContainer><h1 className="font-display text-xl font-bold">History</h1></PageContainer>;
}
```

`client/src/pages/Rewards.tsx`:
```tsx
import { PageContainer } from "@/components/Layout";
export default function Rewards() {
  return <PageContainer><h1 className="font-display text-xl font-bold">Rewards</h1></PageContainer>;
}
```

- [ ] **Step 6: Verify and commit**

```bash
npm run check
git add client/src/lib/constants.ts client/src/lib/api.ts client/src/components/Layout.tsx client/src/App.tsx client/src/pages/Calculator.tsx client/src/pages/Calendar.tsx client/src/pages/History.tsx client/src/pages/Rewards.tsx
git commit -m "feat: add navigation, routes, hooks, and placeholder pages for Pendle tools"
```

---

## Task 4: Fixed Yield Calculator page

**Files:**
- Modify: `client/src/pages/Calculator.tsx` (replace placeholder)

- [ ] **Step 1: Implement the Calculator page**

Replace `client/src/pages/Calculator.tsx` with the full implementation. The page should:

- Use `usePendleMarketList()` to populate a market selector dropdown
- Have a capital input field (default $10,000)
- Calculate and display:
  - Days to maturity: `Math.ceil((new Date(market.expiry).getTime() - Date.now()) / 86400000)`
  - Fixed return: `capital * market.impliedApy * (daysToMaturity / 365)`
  - Variable return: `capital * market.underlyingApy * (daysToMaturity / 365)`
  - Daily return: `fixedReturn / daysToMaturity`
- Show a comparison card: fixed vs variable, with the difference highlighted
- "Trade on Pendle" CTA button
- Use existing UI patterns: `PageContainer`, `StickyCTA`, `glass-card` or `bg-card border border-card-border rounded-xl`
- Market selector should show: `market.name (chain ${market.chainId}) — ${(market.impliedApy * 100).toFixed(2)}%`
- Results should use `font-mono tabular-nums` for numbers, `text-primary` for positive values

- [ ] **Step 2: Verify and commit**

```bash
npm run check
git add client/src/pages/Calculator.tsx
git commit -m "feat: add Fixed Yield Calculator page"
```

---

## Task 5: Maturity Calendar page

**Files:**
- Modify: `client/src/pages/Calendar.tsx` (replace placeholder)

- [ ] **Step 1: Implement the Calendar page**

Replace `client/src/pages/Calendar.tsx` with the full implementation. The page should:

- Use `usePendleMarketList()` to get all active markets
- Group markets by time bucket:
  - "Expiring This Week" (< 7 days) — red color `text-destructive`
  - "Next 2 Weeks" (7-14 days) — amber `text-chart-4`
  - "This Month" (14-30 days) — amber `text-chart-4`
  - "Next 3 Months" (30-90 days) — green `text-primary`
  - "6+ Months" (90+ days) — muted `text-muted-foreground`
- Each market card shows: name, chain ID, implied APY (as percentage), TVL (formatted with `formatUSD`), days until expiry
- Sort toggle: "By Expiry" (default), "By APY", "By TVL"
- Each group is a section with a header showing count
- Empty groups are hidden
- Use Skeleton loading state
- Use `PageContainer`, `StickyCTA`

- [ ] **Step 2: Verify and commit**

```bash
npm run check
git add client/src/pages/Calendar.tsx
git commit -m "feat: add Maturity Calendar page"
```

---

## Task 6: Yield History Charts page

**Files:**
- Modify: `client/src/pages/History.tsx` (replace placeholder)

- [ ] **Step 1: Implement the History page**

Replace `client/src/pages/History.tsx` with the full implementation. The page should:

- Use `usePendleMarketList()` for market selector
- Use `usePendleHistory(selectedChainId, selectedAddress)` when a market is selected
- Market selector: dropdown with `market.name (chain ${market.chainId})`
- Timeframe buttons: 7d, 30d, 60d — these filter the `results` array client-side by timestamp
- Recharts `LineChart` with `ResponsiveContainer` (height 400px):
  - Line 1: `impliedApy * 100` — color `#1BE3C2` (primary/teal), label "Implied APY"
  - Line 2: `underlyingApy * 100` — color `#374B6D` (muted), label "Underlying APY"
  - X axis: date formatted as "MMM DD"
  - Y axis: percentage with `%` suffix
  - Tooltip: shows date + both APY values
  - CartesianGrid with `strokeDasharray="3 3"` and muted color
- Current rate card below the chart showing latest implied vs underlying
- Loading state: Skeleton while history is loading
- Error state: "Unable to load history" message
- No market selected state: "Select a market to view APY history"
- Use `PageContainer`, `StickyCTA`

- [ ] **Step 2: Verify and commit**

```bash
npm run check
git add client/src/pages/History.tsx
git commit -m "feat: add Yield History Charts page"
```

---

## Task 7: Rewards Explorer page

**Files:**
- Modify: `client/src/pages/Rewards.tsx` (replace placeholder)

- [ ] **Step 1: Implement the Rewards page**

Replace `client/src/pages/Rewards.tsx` with the full implementation. The page should:

- Use `usePendleMarketList({ hasPoints: true })` to get only markets with points
- Table with columns: Market Name, Chain, Implied APY, TVL, Category Tags
- Each row is expandable (click to expand). When expanded:
  - Fetch detail via `usePendleMarketDetail(chainId, address)` (use a state variable for which market is expanded)
  - Show `underlyingRewardApyBreakdown` as a sub-table inside the expanded row:
    - Columns: Reward Token (symbol), Source Type, APY Contribution
    - If the breakdown is empty/null: show "No reward breakdown available"
  - Show `rewardTokens` list if available
  - Skeleton inside expanded row while loading
- "Earning Points" badge for each row: `<span className="bg-secondary/10 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">Points</span>`
- Sort options: by APY (default), by TVL
- Loading state: Skeleton rows
- Empty state: "No markets with reward programs found"
- Use `PageContainer`, `StickyCTA`

- [ ] **Step 2: Verify and commit**

```bash
npm run check
git add client/src/pages/Rewards.tsx
git commit -m "feat: add Rewards Explorer page"
```

---

## Task 8: Build, deploy, and verify

- [ ] **Step 1: Build and deploy**

```bash
cd /home/muffinman/boros-tools
npm run build
pm2 restart boros-tools
sleep 15
pm2 logs boros-tools --lines 5 --nostream
```

- [ ] **Step 2: Test new endpoints**

```bash
curl -s https://boros.lekker.design/api/pendle/markets-raw?limit=3 | python3 -m json.tool | head -20
curl -s "https://boros.lekker.design/api/pendle/markets-raw?hasPoints=true&limit=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} markets with points')"
```

- [ ] **Step 3: Verify pages in browser**

Open each page and verify:
- `https://boros.lekker.design/#/calculator` — market selector populates, calculation works
- `https://boros.lekker.design/#/calendar` — markets grouped by time bucket with correct colors
- `https://boros.lekker.design/#/history` — select a market, chart loads with two lines
- `https://boros.lekker.design/#/rewards` — points markets shown, expand a row to see reward breakdown
- Navbar "Pendle Tools" dropdown works on desktop, mobile hamburger shows all items

- [ ] **Step 4: Commit and save**

```bash
git add -A
git commit -m "chore: build and deploy Pendle tools expansion"
pm2 save
```

---

## Rollback

The 4 new pages are additive — they don't modify any existing page functionality. If anything breaks:
```bash
# Revert to previous build
git revert HEAD
npm run build
pm2 restart boros-tools
```
