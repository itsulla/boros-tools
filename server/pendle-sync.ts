import type Database from "better-sqlite3";

const PENDLE_API_BASE = "https://api-v2.pendle.finance/core/v1";
// Fallback chain IDs if the /chains endpoint fails
const FALLBACK_CHAIN_IDS = [1, 42161, 56, 8453];
// Cached chain list — refreshed on each sync cycle
let cachedChainIds: number[] = FALLBACK_CHAIN_IDS;

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — never reduce this
const BACKOFF_MS = 65 * 1000;            // 65s on 429
const LOW_CU_THRESHOLD = 5_000;

function log(msg: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour12: true });
  console.log(`${t} [pendle-sync] ${msg}`);
}

async function fetchChainMarkets(
  chainId: number,
): Promise<{ markets: any[]; weeklyRemaining: number | null; rateLimited: boolean }> {
  const url = `${PENDLE_API_BASE}/${chainId}/markets/active`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  const weeklyRemainingHeader = res.headers.get("x-ratelimit-weekly-remaining");
  const weeklyRemaining = weeklyRemainingHeader ? parseInt(weeklyRemainingHeader, 10) : null;

  if (res.status === 429) {
    return { markets: [], weeklyRemaining, rateLimited: true };
  }
  if (!res.ok) {
    log(`chain ${chainId}: unexpected status ${res.status}`);
    return { markets: [], weeklyRemaining, rateLimited: false };
  }

  const body = await res.json();
  // /active endpoint returns { markets: [...] }
  const raw: any[] = Array.isArray(body?.markets)
    ? body.markets
    : Array.isArray(body)
    ? body
    : [];

  // Inject chainId into each market (the /active endpoint doesn't always include it)
  const markets = raw.map((m: any) => ({ ...m, chainId }));
  return { markets, weeklyRemaining, rateLimited: false };
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

  // Refresh supported chain list (1 CU, non-critical)
  try {
    const chainsRes = await fetch(`${PENDLE_API_BASE}/chains`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (chainsRes.ok) {
      const chainsBody = await chainsRes.json();
      if (Array.isArray(chainsBody?.chainIds) && chainsBody.chainIds.length > 0) {
        cachedChainIds = chainsBody.chainIds;
      }
    }
  } catch {
    // Non-critical — use cached/fallback chain list
  }

  const allMarkets: any[] = [];
  let latestWeeklyRemaining: number | null = null;

  // Fetch each chain sequentially to stay well within rate limits
  for (const chainId of cachedChainIds) {
    try {
      const result = await fetchChainMarkets(chainId);
      latestWeeklyRemaining = result.weeklyRemaining ?? latestWeeklyRemaining;

      if (result.rateLimited) {
        log(`rate limited on chain ${chainId}. Backing off ${BACKOFF_MS / 1000}s.`);
        setTimeout(() => syncMarkets(db), BACKOFF_MS);
        return;
      }

      allMarkets.push(...result.markets);
    } catch (err) {
      log(`chain ${chainId} fetch error: ${err}`);
      // Continue to next chain — partial data is better than no data
    }
  }

  if (allMarkets.length === 0) {
    log("0 markets from all chains — keeping stale data.");
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
      const det = m.details ?? {};
      upsert.run({
        address: m.address ?? "",
        chainId: m.chainId ?? 0,
        name: m.name ?? null,
        expiry: m.expiry ?? null,
        // /active endpoint returns pt/yt/sy as string IDs ("chainId-address")
        pt: typeof m.pt === "string" ? m.pt : m.pt?.address ?? null,
        yt: typeof m.yt === "string" ? m.yt : m.yt?.address ?? null,
        sy: typeof m.sy === "string" ? m.sy : m.sy?.address ?? null,
        underlyingAsset: typeof m.underlyingAsset === "string" ? m.underlyingAsset : m.underlyingAsset?.address ?? null,
        isNew: m.isNew ? 1 : 0,
        isPrime: m.isPrime ? 1 : 0,
        isVolatile: m.isVolatile ? 1 : 0,
        details_liquidity: det.liquidity ?? null,
        // /active endpoint uses "liquidity" not "totalTvl" — store as both
        details_totalTvl: det.totalTvl ?? det.liquidity ?? null,
        details_tradingVolume: det.tradingVolume ?? null,
        details_underlyingApy: det.underlyingApy ?? null,
        details_impliedApy: det.impliedApy ?? null,
        details_aggregatedApy: det.aggregatedApy ?? null,
        details_maxBoostedApy: det.maxBoostedApy ?? null,
        details_totalPt: det.totalPt ?? null,
        details_totalSy: det.totalSy ?? null,
        details_totalSupply: det.totalSupply ?? null,
        points: m.points ? JSON.stringify(m.points) : null,
        externalProtocols: m.externalProtocols ? JSON.stringify(m.externalProtocols) : null,
      });
    }
  });

  upsertMany(allMarkets);

  // Update sync_meta
  db.prepare(`
    INSERT OR REPLACE INTO sync_meta (id, lastSyncAt, weeklyRemaining, marketCount)
    VALUES (1, ?, ?, ?)
  `).run(new Date().toISOString(), latestWeeklyRemaining, allMarkets.length);

  log(`synced ${allMarkets.length} markets across ${cachedChainIds.length} chains. Weekly CU remaining: ${latestWeeklyRemaining ?? "unknown"}`);
}

export function initPendleSync(db: Database.Database): void {
  // Initial sync — non-blocking, server starts regardless
  syncMarkets(db).catch((err) => log(`initial sync error: ${err}`));

  // Recurring sync — hard minimum 5 minutes
  setInterval(() => {
    syncMarkets(db).catch((err) => log(`scheduled sync error: ${err}`));
  }, SYNC_INTERVAL_MS);
}
