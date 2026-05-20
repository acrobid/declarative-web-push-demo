export interface SubscribeResponse {
  subscriber_id: string;
  trigger_token: string;
}

export interface SendRecord {
  id: number;
  requested_at: number;
  sent_at: number | null;
  status: number | null;
  response_body: string | null;
  error: string | null;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  vapidPublicKey: () => jsonFetch<{ key: string }>("/api/vapid-public-key"),
  subscribe: (subscription: PushSubscriptionJSON, userAgent: string) =>
    jsonFetch<SubscribeResponse>("/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription, user_agent: userAgent }),
    }),
  send: (subscriber_id: string, delay_seconds = 0) =>
    jsonFetch<{ ok: true; pending_id?: number; send_id?: number }>("/api/send", {
      method: "POST",
      body: JSON.stringify({ subscriber_id, delay_seconds }),
    }),
  sends: (subscriber_id: string) =>
    jsonFetch<{ sends: SendRecord[] }>(
      `/api/sends?subscriber_id=${encodeURIComponent(subscriber_id)}`,
    ),
};
