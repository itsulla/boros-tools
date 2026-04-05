import type { Express } from "express";
import type { Server } from "http";
import type Database from "better-sqlite3";
import { cachedFetch } from "./pendle-cache";

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
    const chainIdNum = parseInt(String(chainId), 10);
    if (isNaN(chainIdNum)) return res.status(400).json({ error: "Invalid chainId" });
    if (!/^0x[a-fA-F0-9]{40}$/.test(String(address))) return res.status(400).json({ error: "Invalid address" });
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
    const chainIdNum = parseInt(String(chainId), 10);
    if (isNaN(chainIdNum)) return res.status(400).json({ error: "Invalid chainId" });
    if (!/^0x[a-fA-F0-9]{40}$/.test(String(address))) return res.status(400).json({ error: "Invalid address" });
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

  // GET /api/pendle/whales — recent large TVL movements
  app.get("/api/pendle/whales", (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
      const events = db.prepare(`
        SELECT * FROM whale_events ORDER BY timestamp DESC LIMIT ?
      `).all(limit);
      res.json(events);
    } catch (err) {
      console.error("[pendle-routes] /api/pendle/whales error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
