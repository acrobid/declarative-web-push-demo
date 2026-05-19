# Declarative Web Push Demo

**Declarative Web Push works on Safari today. Firebase Cloud Messaging blocks it.**

Apple shipped Declarative Web Push in Safari 18.5 — push notifications without a service worker, with better battery life and privacy. It works directly in Safari. But [Firebase Cloud Messaging strips the `web_push` field](https://github.com/firebase/firebase-admin-node/issues/2892) from push payloads, making declarative push impossible for Firebase users even on Safari where it's fully supported.

The fix is a single optional field passthrough. Google acknowledged the issue in 2025 but has taken no action.

**Live demo:** https://declarative-push.iamjoshcarter.com

---

## What is Declarative Web Push?

Apple introduced Declarative Web Push as a replacement for the service-worker-based push model. The key difference: no service worker is required. Instead, the server sends a JSON payload with `"web_push": 8030` and a `notification` object. The OS parses the payload and displays the notification natively.

This is a meaningful improvement — fewer moving parts, better battery life, more privacy. The [WebKit blog post](https://webkit.org/blog/16535/meet-declarative-web-push/) describes it as a complete, working feature. And it is — on Safari.

## What this demo shows

This PWA lets you subscribe to declarative push notifications on Safari and trigger sends in several ways:

- **Send now** — immediate push
- **Send in 15s / 60s** — delayed send (lock your phone, then check)
- **Trigger URL** — hit a URL from any other device to push to your browser

The Diagnostics panel records every send with its HTTP status from Apple's push service. Sends return **HTTP 201** (accepted) and the notification appears on the device.

If you're on Chrome or Firefox, `window.pushManager` doesn't exist — those browsers still require the old service-worker model. And if you use Firebase to send push, the `web_push` field is stripped regardless of browser.

## Stack

- **Frontend:** Vue 3 SPA, no service worker (subscribes via `window.pushManager`)
- **Backend:** Hono on Node.js, serving the SPA and a JSON API
- **Storage:** SQLite (better-sqlite3) — subscriptions, send log, pending queue
- **Push:** web-push npm package, VAPID-signed, aes128gcm

## Local development

```bash
pnpm install
cp .env.example .env
npx web-push generate-vapid-keys   # paste the output into .env
pnpm dev                            # Vite SPA + Hono API, concurrently
```

Push requires HTTPS. To test on a real device locally, use a tunnel:

```bash
ngrok http 5173   # or: tailscale funnel 5173
```

## Build and run

```bash
pnpm build   # compiles SPA → dist/ and server → dist-server/
pnpm start   # serves both from a single Node process on port 8787
```

## Deploy

Single Dockerfile, deployed via Coolify on Hetzner. See `IMPLEMENTATION.md §12` for the step-by-step.

## The Firebase gap

Firebase Cloud Messaging's admin SDK currently strips the `web_push` field from push payloads. This means even if you're targeting Safari, where declarative push works, Firebase prevents you from using it.

The fix is a single-field passthrough. It's been [reported since 2025](https://github.com/firebase/firebase-admin-node/issues/2892) with no action from Google.

Star and comment on the issue to signal demand.
