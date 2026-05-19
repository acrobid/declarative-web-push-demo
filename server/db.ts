import Database from "better-sqlite3";

const DB_PATH = process.env.DB_PATH ?? "./demo.sqlite";

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    trigger_token TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'declarative'
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

// Migrate existing databases that lack the type column.
try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN type TEXT NOT NULL DEFAULT 'declarative'`);
} catch {
  // Column already exists — ignore.
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
