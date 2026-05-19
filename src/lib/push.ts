import { api } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface SubscribeResult {
  subscriber_id: string;
  trigger_token: string;
  subscription: PushSubscriptionJSON;
}

export async function subscribePush(): Promise<SubscribeResult> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(`Permission ${perm}`);

  // @ts-expect-error window.pushManager is the Declarative Web Push entry point on Safari
  const pm: PushManager = window.pushManager;
  if (!pm)
    throw new Error(
      "window.pushManager not available — declarative push not supported by this browser",
    );

  const { key } = await api.vapidPublicKey();
  const subscription = await pm.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  const subJson = subscription.toJSON();
  const res = await api.subscribe(subJson, navigator.userAgent);
  return { ...res, subscription: subJson };
}
