import Database from "better-sqlite3";
import { join } from "path";

// In production (CJS bundle), __dirname is available natively.
// In dev (tsx/ESM), we use import.meta.url.
// The DB file lives in the project root, one level above server/.
const DB_PATH = typeof __dirname !== "undefined"
  ? join(__dirname, "..", "pendle-cache.db")
  : join(new URL(".", import.meta.url).pathname, "..", "pendle-cache.db");

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

const CREATE_WHALE_EVENTS = `
CREATE TABLE IF NOT EXISTS whale_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  chainId INTEGER NOT NULL,
  marketAddress TEXT NOT NULL,
  marketName TEXT NOT NULL,
  asset TEXT NOT NULL,
  eventType TEXT NOT NULL,
  tvlBefore REAL,
  tvlAfter REAL,
  tvlChange REAL,
  tvlChangePercent REAL
);
`;

export function initPendleDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_MARKETS);
  db.exec(CREATE_SYNC_META);
  db.exec(CREATE_WHALE_EVENTS);
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chainId         INTEGER NOT NULL,
      address         TEXT    NOT NULL,
      snapshotDate    TEXT    NOT NULL,
      impliedApy      REAL,
      underlyingApy   REAL,
      totalTvl        REAL
    );
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_market_date
      ON market_snapshots (chainId, address, snapshotDate);
  `);
  // Migration: add categoryIds column (idempotent)
  try {
    db.exec("ALTER TABLE markets ADD COLUMN categoryIds TEXT");
  } catch {
    // Column already exists — ignore
  }
  return db;
}
