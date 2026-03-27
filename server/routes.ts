import type { Express } from "express";
import type { Server } from "http";
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

  return httpServer;
}
