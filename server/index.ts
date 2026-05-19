import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db, type SubscriptionRow } from "./db.js";
import { sendPush, vapidPublicKey } from "./push.js";

const app = new Hono();
const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = process.env.STATIC_DIR ?? "dist";

const SUBSCRIPTION_CAP = 50;
const SENDS_PER_SUBSCRIBER = 50;

// ---- Rate limiting ------------------------------------------------------

const ipWindows = new Map<string, number[]>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getIP(c: any): string {
  return (
    (c.req.header("x-forwarded-for") as string | undefined)?.split(",")[0]?.trim() ??
    (c.req.header("x-real-ip") as string | undefined) ??
    "unknown"
  );
}

function checkRate(ip: string, key: string, maxPerMinute: number): boolean {
  const k = `${ip}:${key}`;
  const now = Date.now();
  const hits = (ipWindows.get(k) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= maxPerMinute) return false;
  hits.push(now);
  ipWindows.set(k, hits);
  return true;
}

// ---- API ----------------------------------------------------------------

app.get("/healthz", (c) => c.text("ok"));

app.get("/api/vapid-public-key", (c) => c.json({ key: vapidPublicKey }));

app.post("/api/subscribe", async (c) => {
  if (!checkRate(getIP(c), "subscribe", 5)) return c.json({ error: "rate limited" }, 429);

  const body = await c.req.json<{
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    user_agent?: string;
  }>();
  const { endpoint, keys } = body.subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ error: "bad subscription" }, 400);
  }
  const existing = db.prepare("SELECT * FROM subscriptions WHERE endpoint = ?").get(endpoint) as
    | SubscriptionRow
    | undefined;
  if (existing) {
    return c.json({ subscriber_id: existing.id, trigger_token: existing.trigger_token });
  }

  // Evict oldest subscriptions (and their sends) if over cap.
  const count = (db.prepare("SELECT COUNT(*) as n FROM subscriptions").get() as { n: number }).n;
  if (count >= SUBSCRIPTION_CAP) {
    const oldest = db
      .prepare(`SELECT id FROM subscriptions ORDER BY created_at ASC LIMIT ?`)
      .all(count - SUBSCRIPTION_CAP + 1) as Array<{ id: string }>;
    const ids = oldest.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM sends WHERE subscription_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM subscriptions WHERE id IN (${placeholders})`).run(...ids);
  }

  const id = randomUUID();
  const trigger_token = randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO subscriptions (id, endpoint, p256dh, auth, trigger_token, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, endpoint, keys.p256dh, keys.auth, trigger_token, body.user_agent ?? null, Date.now());
  return c.json({ subscriber_id: id, trigger_token });
});

app.post("/api/send", async (c) => {
  if (!checkRate(getIP(c), "send", 20)) return c.json({ error: "rate limited" }, 429);

  const { subscriber_id, delay_seconds } = await c.req.json<{
    subscriber_id: string;
    delay_seconds?: number;
  }>();
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriber_id) as
    | SubscriptionRow
    | undefined;
  if (!sub) return c.json({ error: "unknown subscriber" }, 404);

  const requested_at = Date.now();
  const delay = Math.max(0, Math.min(600, delay_seconds ?? 0));

  if (delay === 0) {
    const send_id = recordRequest(sub.id, requested_at);
    void dispatch(sub, send_id);
    return c.json({ ok: true, send_id });
  }
  const due_at = requested_at + delay * 1000;
  const info = db
    .prepare("INSERT INTO pending (subscription_id, due_at, requested_at) VALUES (?, ?, ?)")
    .run(sub.id, due_at, requested_at);
  return c.json({ ok: true, pending_id: info.lastInsertRowid as number });
});

app.get("/api/debug", (c) => {
  const subscriptions = (
    db
      .prepare(
        `SELECT id, endpoint, user_agent, created_at FROM subscriptions ORDER BY created_at DESC`,
      )
      .all() as Array<{
      id: string;
      endpoint: string;
      user_agent: string | null;
      created_at: number;
    }>
  ).map((r) => ({
    id: r.id,
    endpoint_host: (() => {
      try {
        return new URL(r.endpoint).host;
      } catch {
        return r.endpoint;
      }
    })(),
    user_agent: r.user_agent,
    created_at: r.created_at,
  }));

  const recent_sends = db
    .prepare(
      `SELECT s.id, s.subscription_id, sub.endpoint, s.requested_at, s.sent_at, s.status, s.response_body, s.error
       FROM sends s LEFT JOIN subscriptions sub ON sub.id = s.subscription_id
       ORDER BY s.requested_at DESC LIMIT 30`,
    )
    .all() as Array<{
    id: number;
    subscription_id: string;
    endpoint: string | null;
    requested_at: number;
    sent_at: number | null;
    status: number | null;
    response_body: string | null;
    error: string | null;
  }>;

  return c.json({
    config: {
      site_url: process.env.SITE_URL ?? "(not set)",
      vapid_public_key_prefix: vapidPublicKey.slice(0, 12) + "…",
      port: PORT,
      node_version: process.version,
      uptime_seconds: Math.floor(process.uptime()),
    },
    subscriptions,
    recent_sends: recent_sends.map((r) => ({
      ...r,
      endpoint_host: (() => {
        try {
          return r.endpoint ? new URL(r.endpoint).host : null;
        } catch {
          return r.endpoint;
        }
      })(),
      endpoint: undefined,
    })),
  });
});

app.get("/api/sends", (c) => {
  const subscriber_id = c.req.query("subscriber_id");
  if (!subscriber_id) return c.json({ sends: [] });
  const rows = db
    .prepare(
      `SELECT id, requested_at, sent_at, status, response_body, error
       FROM sends WHERE subscription_id = ? ORDER BY requested_at DESC LIMIT 10`,
    )
    .all(subscriber_id);
  return c.json({ sends: rows });
});

app.get("/t/:token", async (c) => {
  const token = c.req.param("token");
  const sub = db.prepare("SELECT * FROM subscriptions WHERE trigger_token = ?").get(token) as
    | SubscriptionRow
    | undefined;
  if (!sub) return c.text("unknown trigger token", 404);
  const send_id = recordRequest(sub.id, Date.now());
  const result = await dispatch(sub, send_id);
  return c.html(`<!doctype html><meta charset="utf-8"><title>Push dispatched</title>
<body style="font:14px system-ui;padding:24px;background:#0e0e10;color:#ececec">
<h1>Push dispatched</h1>
<p>Status from push service: <strong>${result.status}</strong></p>
<p>${result.error ? `<span style="color:#f87171">${result.error}</span>` : "No error."}</p>
<p><a style="color:#ff9f4a" href="/">Back to demo</a></p>
</body>`);
});

// ---- Dispatch helpers ---------------------------------------------------

function recordRequest(subscription_id: string, requested_at: number): number {
  const info = db
    .prepare("INSERT INTO sends (subscription_id, requested_at) VALUES (?, ?)")
    .run(subscription_id, requested_at);
  return info.lastInsertRowid as number;
}

async function dispatch(sub: SubscriptionRow, send_id: number) {
  const result = await sendPush({
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
  });
  db.prepare(
    `UPDATE sends SET sent_at = ?, status = ?, response_body = ?, error = ? WHERE id = ?`,
  ).run(Date.now(), result.status, result.body, result.error, send_id);
  // Prune old sends for this subscriber, keeping only the most recent.
  db.prepare(
    `DELETE FROM sends WHERE subscription_id = ? AND id NOT IN (
       SELECT id FROM sends WHERE subscription_id = ? ORDER BY requested_at DESC LIMIT ?
     )`,
  ).run(sub.id, sub.id, SENDS_PER_SUBSCRIBER);
  // 410 / 404 → subscription is gone; clean up.
  if (result.status === 404 || result.status === 410) {
    db.prepare("DELETE FROM subscriptions WHERE id = ?").run(sub.id);
  }
  return result;
}

// ---- Pending poller -----------------------------------------------------

setInterval(() => {
  const now = Date.now();
  const due = db.prepare("SELECT * FROM pending WHERE due_at <= ? LIMIT 20").all(now) as Array<{
    id: number;
    subscription_id: string;
    requested_at: number;
  }>;
  for (const p of due) {
    const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(p.subscription_id) as
      | SubscriptionRow
      | undefined;
    db.prepare("DELETE FROM pending WHERE id = ?").run(p.id);
    if (!sub) continue;
    const send_id = recordRequest(sub.id, p.requested_at);
    void dispatch(sub, send_id);
  }
}, 2000);

// ---- Static SPA serve ---------------------------------------------------

app.use("/*", serveStatic({ root: STATIC_DIR }));

// SPA fallback for client-side routes
app.notFound(async (c) => {
  try {
    const html = await readFile(resolve(STATIC_DIR, "index.html"), "utf8");
    return c.html(html);
  } catch {
    return c.text("not found", 404);
  }
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`listening on :${info.port}`);
});
