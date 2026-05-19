import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:thick.jet4332@fastmail.com";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set");
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export const vapidPublicKey = VAPID_PUBLIC_KEY;

export interface StoredSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  status: number;
  body: string | null;
  error: string | null;
}

const SITE_URL = process.env.SITE_URL ?? "https://declarative-push.iamjoshcarter.com";

export async function sendDeclarative(sub: StoredSub): Promise<SendResult> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const payload = {
    web_push: 8030,
    notification: {
      title: "Declarative Web Push test",
      body: `Fired at ${now} UTC`,
      navigate: SITE_URL,
      lang: "en-US",
      dir: "ltr",
    },
  };
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60, urgency: "high", contentEncoding: "aes128gcm" },
    );
    return { status: res.statusCode, body: res.body || null, error: null };
  } catch (err) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return {
      status: e.statusCode ?? 0,
      body: e.body ?? null,
      error: e.message ?? "unknown error",
    };
  }
}
