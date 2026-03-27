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
