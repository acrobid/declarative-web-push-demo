# Declarative Web Push Demo

A live reproduction of Apple's [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) — a new iOS push mechanism that the push service accepts (HTTP 201) but iOS does not appear to deliver to the device.

**Live demo:** https://declarative-push.iamjoshcarter.com

---

## What is Declarative Web Push?

Apple introduced Declarative Web Push in Safari 18.4/iOS 18.4 as a replacement for the service-worker-based push model. The key difference: no service worker is required. Instead, the server sends a JSON payload with `"web_push": 8030` and a `notification` object; the OS is supposed to parse the payload and display the notification natively.

This is a meaningful improvement in theory — fewer moving parts, better battery life, more privacy. The [WebKit blog post](https://webkit.org/blog/16535/meet-declarative-web-push/) describes it as a complete, working feature.

## What this demo shows

This PWA lets you subscribe to push notifications and trigger sends in several ways:

- **Send now** — immediate push
- **Send in 15s / 60s** — delayed send (lock your phone, then check)
- **Trigger URL** — hit a URL from any other device to push to your phone

The Diagnostics panel records every send with its HTTP status from Apple's push service. In testing: the push service returns **HTTP 201** (accepted) for every send, but **no notification appears on the device** — no banner, no badge, locked or unlocked, foreground or background.

The same payload sent to Firefox or Chrome on desktop works correctly.

## Stack

- **Frontend:** Vue 3 SPA, no service worker (Declarative Web Push subscribes via `window.pushManager`)
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

Point Safari at the tunnel URL, install to Home Screen, then test.

## Build and run

```bash
pnpm build   # compiles SPA → dist/ and server → dist-server/
pnpm start   # serves both from a single Node process on port 8787
```

## Deploy

Single Dockerfile, deployed via Coolify on Hetzner. See `IMPLEMENTATION.md §12` for the step-by-step.

## Contributing / reproducing

If you can reproduce or disprove this behavior on your own iOS device, open an issue with:

- iOS version and Safari version
- Whether the PWA was installed to Home Screen
- The HTTP status shown in the Diagnostics panel
- Whether any notification appeared
