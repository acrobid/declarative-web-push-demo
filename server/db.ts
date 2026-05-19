import Database from "better-sqlite3";

const DB_PATH = process.env.DB_PATH ?? "./demo.sqlite";

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    trigger_token TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'declarative',
    UNIQUE(endpoint, type)
  );
  CREATE TABLE IF NOT EXISTS sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL,
    requested_at INTEGER NOT NULL,
    sent_at INTEGER,
    status INTEGER,
    response_body TEXT,
    error TEXT,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_sends_sub ON sends(subscription_id, requested_at DESC);
  CREATE TABLE IF NOT EXISTS pending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    requested_at INTEGER NOT NULL,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_pending_due ON pending(due_at);
`);

// Migrate: add type column if missing.
try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN type TEXT NOT NULL DEFAULT 'declarative'`);
} catch {
  // Column already exists — ignore.
}

// Migrate: replace the per-column UNIQUE on endpoint with a composite UNIQUE(endpoint, type).
// Detect by checking whether the old unique index still exists on endpoint alone.
const tableDef = db
  .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='subscriptions'`)
  .get() as { sql: string } | undefined;
const needsRebuild = tableDef !== undefined && !tableDef.sql.includes("UNIQUE(endpoint, type)");

if (needsRebuild) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    BEGIN;
    CREATE TABLE subscriptions_new (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      trigger_token TEXT UNIQUE NOT NULL,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'declarative',
      UNIQUE(endpoint, type)
    );
    INSERT OR IGNORE INTO subscriptions_new SELECT * FROM subscriptions;
    DROP TABLE subscriptions;
    ALTER TABLE subscriptions_new RENAME TO subscriptions;
    COMMIT;
  `);
  db.pragma("foreign_keys = ON");
}

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  trigger_token: string;
  user_agent: string | null;
  created_at: number;
  type: "declarative" | "sw";
}
