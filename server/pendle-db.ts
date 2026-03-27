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
