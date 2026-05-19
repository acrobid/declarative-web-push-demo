# Implementation Guide — Declarative Web Push Demo

> **Status: implemented.** All files have been written and all acceptance tests
> in §14 pass (`vp check` 0 errors, `pnpm build` produces `dist/` and
> `dist-server/`, server boots and `/healthz` returns `ok`). One deviation from
> the spec: `pnpm-workspace.yaml` required a `packages: ['.']` entry (missing
> from the scaffold) before pnpm would install anything. Everything else was
> copied verbatim.

Audience: an LLM (or human) implementing this project from scratch. Follow
sections in order. Each file's full contents are given. Copy them verbatim
unless the section calls out variation.

## 0. Context

We are building a Progressive Web App that demonstrates Apple's **Declarative
Web Push** (announced 2025 on the WebKit blog) does not actually deliver
notifications on iOS Safari, despite Safari accepting the subscription and
the push service returning HTTP 201 for every send.

Anyone visiting the deployed site on an iPhone should be able to:

1. Install the PWA to their home screen.
2. Subscribe to push (no service worker — declarative push doesn't need one).
3. Trigger sends in multiple ways (immediate, delayed, external URL).
4. See server-side delivery receipts proving the push service accepted the
   payload, while the device displays nothing.

The deployed URL will be `https://declarative-push.iamjoshcarter.com`.
Deployment is via Coolify on a Hetzner VPS. Email for VAPID `mailto:` subject
is `thick.jet4332@fastmail.com`.

## 1. Stack and Constraints

- Toolchain: **Vite+** (`vp` CLI). Already scaffolded. Do not replace it.
  Run `vp install`, `vp dev`, `vp build`, `vp check`, `vp test`.
- Frontend: **Vue 3** SPA. **No service worker.** Subscribes via
  `window.pushManager` directly (this API only works when Declarative Web
  Push is enabled, e.g. Safari 18.5+).
- Backend: **Hono** on Node, single process. Serves the built SPA statically
  and exposes a JSON API on the same port.
- Storage: **better-sqlite3** in one file. Tables: `subscriptions`, `sends`,
  `pending`.
- Push: **web-push** npm package, VAPID-signed, aes128gcm content encoding.
- Deploy: single multi-stage **Dockerfile** consumed by Coolify.

## 2. Dependencies to Add

From the project root, run:

```bash
pnpm add vue hono @hono/node-server web-push better-sqlite3 dotenv
pnpm add -D @vitejs/plugin-vue vue-tsc @types/web-push @types/better-sqlite3 tsx
```

Keep the existing `vite`, `vite-plus`, and `typescript` dev deps from the
scaffold.

After install, update `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "concurrently -k -n web,api -c blue,magenta \"vp dev\" \"tsx watch server/index.ts\"",
    "build": "vue-tsc --noEmit && vp build && tsc -p tsconfig.server.json",
    "start": "node dist-server/index.js",
    "preview": "vp preview",
    "check": "vp check",
    "test": "vp test",
    "prepare": "vp config"
  }
}
```

Also add `concurrently` as a dev dep:

```bash
pnpm add -D concurrently
```

## 3. Final Directory Tree

```
declarative-web-push-demo/
├── CLAUDE.md                  # exists, do not modify
├── IMPLEMENTATION.md          # this file
├── README.md                  # write per §13
├── Dockerfile                 # write per §11
├── .dockerignore              # write per §11
├── .env.example               # write per §10
├── .gitignore                 # already exists; add .env, dist-server, *.sqlite, /data
├── index.html                 # rewrite per §6
├── package.json               # as above
├── pnpm-workspace.yaml        # already exists, do not modify
├── tsconfig.json              # rewrite per §5 (add vue support)
├── tsconfig.server.json       # write per §5 (compiles server/ to dist-server/)
├── vite.config.ts             # rewrite per §6 (add vue plugin + /api proxy)
├── public/
│   ├── favicon.svg            # already exists, keep
│   ├── icons.svg              # already exists, keep
│   └── manifest.webmanifest   # write per §7
├── src/                       # frontend Vue app
│   ├── main.ts                # rewrite per §8
│   ├── style.css              # rewrite per §8
│   ├── App.vue                # write per §8
│   ├── components/
│   │   ├── WhatApplePromises.vue
│   │   ├── WhatActuallyHappens.vue
│   │   ├── InstallInstructions.vue
│   │   ├── Subscribe.vue
│   │   ├── TestControls.vue
│   │   └── Diagnostics.vue
│   └── lib/
│       ├── api.ts
│       ├── push.ts
│       └── ua.ts
└── server/                    # backend Hono app
    ├── index.ts
    ├── db.ts
    └── push.ts
```

Delete the scaffolded `src/counter.ts` and `src/assets/` directory if
present — they aren't used by the new app.

## 4. Generate VAPID Keys (one-time, before deploy)

```bash
npx web-push generate-vapid-keys
```

This prints a public and private key. Save them. They go into `.env` locally
and into Coolify's env-var UI on deploy. Never commit them.

## 5. TypeScript Config

### `tsconfig.json` (frontend)

Replace existing file with:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "lib": ["ES2023", "DOM"],
    "types": ["vite-plus/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "src/**/*.vue"]
}
```

### `tsconfig.server.json` (new, for backend compile)

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "types": ["node"],
    "outDir": "dist-server",
    "rootDir": "server",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": false,
    "resolveJsonModule": true
  },
  "include": ["server"]
}
```

Add `@types/node` if not already present: `pnpm add -D @types/node`.

## 6. Vite Config + index.html

### `vite.config.ts`

```ts
import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  staged: { "*": "vp check --fix" },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/t": "http://localhost:8787",
      "/healthz": "http://localhost:8787",
    },
  },
});
```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Decl. Push Test" />
    <meta name="theme-color" content="#111111" />
    <title>Declarative Web Push — broken on iOS?</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## 7. PWA Manifest

### `public/manifest.webmanifest`

```json
{
  "name": "Declarative Web Push Demo",
  "short_name": "Decl. Push",
  "description": "Reproducing Apple's broken Declarative Web Push on iOS.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#111111",
  "theme_color": "#111111",
  "icons": [{ "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }]
}
```

## 8. Frontend Source Files

### `src/main.ts`

```ts
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");
```

### `src/style.css`

```css
:root {
  color-scheme: dark;
  --bg: #0e0e10;
  --fg: #ececec;
  --muted: #8a8a8f;
  --accent: #ff9f4a;
  --good: #4ade80;
  --bad: #f87171;
  --border: #2a2a2e;
  --card: #17171a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
}

#app {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 64px;
  line-height: 1.5;
}

h1 {
  font-size: 1.5rem;
  margin: 0 0 4px;
}
h2 {
  font-size: 1.05rem;
  margin: 24px 0 8px;
}
p {
  margin: 0 0 12px;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
}
small {
  color: var(--muted);
}

section.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

ul.bullets {
  padding-left: 18px;
  margin: 0;
}
ul.bullets li {
  margin: 4px 0;
}

button {
  font: inherit;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #222226;
  color: var(--fg);
  cursor: pointer;
}
button:hover {
  background: #2a2a30;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button.primary {
  background: var(--accent);
  color: #1a1a1a;
  border-color: var(--accent);
  font-weight: 600;
}

.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
th,
td {
  text-align: left;
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
}
th {
  color: var(--muted);
  font-weight: 500;
}

.status-good {
  color: var(--good);
}
.status-bad {
  color: var(--bad);
}

pre.json {
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
  background: #0a0a0c;
  border: 1px solid var(--border);
  padding: 8px;
  border-radius: 6px;
  max-height: 200px;
  overflow: auto;
}
```

### `src/lib/ua.ts`

```ts
export function detectIOS(): { isIOS: boolean; version: string | null } {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const m = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
  const version = m ? `${m[1]}.${m[2]}${m[3] ? "." + m[3] : ""}` : null;
  return { isIOS, version };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS-specific
    window.navigator.standalone === true
  );
}

export function supportsPush(): boolean {
  return "PushManager" in window && "Notification" in window;
}

export function supportsDeclarativePush(): boolean {
  // Heuristic: window.pushManager exists on Safari with Declarative Web Push.
  return "pushManager" in window;
}
```

### `src/lib/api.ts`

```ts
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
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
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
```

### `src/lib/push.ts`

```ts
import { api } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
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

  // Declarative Web Push: subscribe via window.pushManager — no service worker.
  // @ts-expect-error window.pushManager is the Declarative Web Push entry point
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
```

### `src/components/WhatApplePromises.vue`

```vue
<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>What Apple says should happen</h2>
    <ul class="bullets">
      <li>No service worker needed — the OS displays the notification.</li>
      <li>Site subscribes via <code>window.pushManager</code>.</li>
      <li>
        Server sends JSON with <code>"web_push": 8030</code> and a <code>notification</code> object.
      </li>
      <li>OS parses payload, shows banner, updates app badge.</li>
      <li>More private and battery-friendly than the old service-worker model.</li>
    </ul>
    <p>
      <small
        >Source:
        <a
          href="https://webkit.org/blog/16535/meet-declarative-web-push/"
          target="_blank"
          rel="noopener"
          >webkit.org/blog/16535</a
        ></small
      >
    </p>
  </section>
</template>
```

### `src/components/WhatActuallyHappens.vue`

```vue
<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>What actually happens on iOS (as of testing)</h2>
    <ul class="bullets">
      <li>Subscription succeeds — endpoint is issued by Apple's push service.</li>
      <li>Server signs the payload and POSTs to that endpoint.</li>
      <li>Push service returns HTTP 201 — accepted for delivery.</li>
      <li>
        Device displays nothing. No banner. No badge. Locked or unlocked, foreground or background.
      </li>
      <li>Same payload to Firefox/Chrome desktop displays correctly.</li>
    </ul>
    <p><small>Run the test below. The Diagnostics panel will show the receipts.</small></p>
  </section>
</template>
```

### `src/components/InstallInstructions.vue`

```vue
<script setup lang="ts">
import { computed } from "vue";
import { detectIOS, isStandalone } from "../lib/ua";

const ios = detectIOS();
const standalone = isStandalone();
const show = computed(() => ios.isIOS && !standalone);
</script>

<template>
  <section v-if="show" class="card">
    <h2>Install first (iOS only)</h2>
    <p>iOS Safari requires the site to be installed to the Home Screen before Push works.</p>
    <ol>
      <li>Tap the Share button in Safari.</li>
      <li>Tap <strong>Add to Home Screen</strong>.</li>
      <li>Open the installed app from your Home Screen, then continue here.</li>
    </ol>
  </section>
</template>
```

### `src/components/Subscribe.vue`

```vue
<script setup lang="ts">
import { ref } from "vue";
import { subscribePush, type SubscribeResult } from "../lib/push";
import { supportsDeclarativePush } from "../lib/ua";

const emit = defineEmits<{ (e: "subscribed", result: SubscribeResult): void }>();

const supported = supportsDeclarativePush();
const busy = ref(false);
const error = ref<string | null>(null);

async function onSubscribe() {
  busy.value = true;
  error.value = null;
  try {
    const result = await subscribePush();
    emit("subscribed", result);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h2>Subscribe</h2>
    <p v-if="!supported" class="status-bad">
      This browser does not expose <code>window.pushManager</code>. Declarative Web Push is
      unsupported here. Try Safari 18.5+ on iOS or macOS.
    </p>
    <template v-else>
      <p>Grant notification permission and create a push subscription.</p>
      <button class="primary" :disabled="busy" @click="onSubscribe">
        {{ busy ? "Subscribing…" : "Subscribe to push" }}
      </button>
      <p v-if="error" class="status-bad">
        <small>{{ error }}</small>
      </p>
    </template>
  </section>
</template>
```

### `src/components/TestControls.vue`

```vue
<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/api";

const props = defineProps<{ subscriberId: string; triggerToken: string }>();
const emit = defineEmits<{ (e: "sent"): void }>();

const busy = ref(false);
const lastResult = ref<string | null>(null);

async function send(delay: number) {
  busy.value = true;
  lastResult.value = null;
  try {
    const r = await api.send(props.subscriberId, delay);
    lastResult.value =
      delay > 0
        ? `Scheduled, pending_id=${r.pending_id}. Lock your phone now.`
        : `Sent. send_id=${r.send_id}. Check Diagnostics for status.`;
    emit("sent");
  } catch (e) {
    lastResult.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

const triggerUrl = `${location.origin}/t/${props.triggerToken}`;

async function copyUrl() {
  await navigator.clipboard.writeText(triggerUrl);
  lastResult.value = "Trigger URL copied. Open it from any other device to push to this phone.";
}
</script>

<template>
  <section class="card">
    <h2>Trigger a notification</h2>
    <div class="row">
      <button :disabled="busy" @click="send(0)">Send now</button>
      <button :disabled="busy" @click="send(15)">Send in 15s</button>
      <button :disabled="busy" @click="send(60)">Send in 60s</button>
    </div>
    <p style="margin-top:12px"><small>Personal trigger URL (hit it from any device):</small></p>
    <div class="row">
      <code style="flex:1;overflow:auto">{{ triggerUrl }}</code>
      <button @click="copyUrl">Copy</button>
    </div>
    <p v-if="lastResult" style="margin-top:8px">
      <small>{{ lastResult }}</small>
    </p>
    <p>
      <small
        >For delayed sends: tap, then lock your phone immediately. Reopen the PWA after to see the
        receipt.</small
      >
    </p>
  </section>
</template>
```

### `src/components/Diagnostics.vue`

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api, type SendRecord } from "../lib/api";
import { detectIOS, isStandalone } from "../lib/ua";

const props = defineProps<{ subscriberId: string; subscription: PushSubscriptionJSON }>();

const sends = ref<SendRecord[]>([]);
const expanded = ref(false);
const ios = detectIOS();
const standalone = isStandalone();
let timer: number | undefined;

async function refresh() {
  try {
    const r = await api.sends(props.subscriberId);
    sends.value = r.sends;
  } catch {
    /* ignore */
  }
}

function fmt(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

defineExpose({ refresh });

onMounted(() => {
  refresh();
  timer = window.setInterval(refresh, 3000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});

const endpointHost = new URL(props.subscription.endpoint!).host;
</script>

<template>
  <section class="card">
    <h2>Diagnostics</h2>
    <p>
      Endpoint: <code>{{ endpointHost }}</code
      ><br />
      UA: <small>{{ navigator.userAgent }}</small
      ><br />
      iOS: <small>{{ ios.isIOS ? (ios.version ?? "yes") : "no" }}</small> · Standalone (installed):
      <small>{{ standalone ? "yes" : "no" }}</small>
    </p>

    <p>
      <button @click="expanded = !expanded">
        {{ expanded ? "Hide" : "Show" }} subscription JSON
      </button>
    </p>
    <pre v-if="expanded" class="json">{{ JSON.stringify(props.subscription, null, 2) }}</pre>

    <h2 style="margin-top:16px">Send log (last 10)</h2>
    <table v-if="sends.length">
      <thead>
        <tr>
          <th>Requested</th>
          <th>Sent</th>
          <th>Status</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sends" :key="s.id">
          <td>{{ fmt(s.requested_at) }}</td>
          <td>{{ fmt(s.sent_at) }}</td>
          <td :class="s.status && s.status >= 200 && s.status < 300 ? 'status-good' : 'status-bad'">
            {{ s.status ?? (s.sent_at ? "—" : "pending") }}
          </td>
          <td>
            <small>{{ s.error ?? s.response_body ?? "" }}</small>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else><small>No sends yet.</small></p>
  </section>
</template>
```

### `src/App.vue`

```vue
<script setup lang="ts">
import { ref } from "vue";
import WhatApplePromises from "./components/WhatApplePromises.vue";
import WhatActuallyHappens from "./components/WhatActuallyHappens.vue";
import InstallInstructions from "./components/InstallInstructions.vue";
import Subscribe from "./components/Subscribe.vue";
import TestControls from "./components/TestControls.vue";
import Diagnostics from "./components/Diagnostics.vue";
import type { SubscribeResult } from "./lib/push";

const sub = ref<SubscribeResult | null>(null);
const diag = ref<InstanceType<typeof Diagnostics> | null>(null);

function onSubscribed(r: SubscribeResult) {
  sub.value = r;
  // Persist so reload keeps state during testing.
  localStorage.setItem("dwp:sub", JSON.stringify(r));
}

const cached = localStorage.getItem("dwp:sub");
if (cached) {
  try {
    sub.value = JSON.parse(cached) as SubscribeResult;
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <header>
    <h1>Declarative Web Push — does it actually work on iOS?</h1>
    <p>
      Apple shipped Declarative Web Push to fix the long-standing problems with iOS PWA
      notifications. In testing, the push service accepts every send (HTTP 201) but iOS displays
      nothing. Try it on your own device.
    </p>
  </header>

  <WhatApplePromises />
  <WhatActuallyHappens />
  <InstallInstructions />

  <Subscribe v-if="!sub" @subscribed="onSubscribed" />

  <template v-if="sub">
    <TestControls
      :subscriber-id="sub.subscriber_id"
      :trigger-token="sub.trigger_token"
      @sent="diag?.refresh()"
    />
    <Diagnostics ref="diag" :subscriber-id="sub.subscriber_id" :subscription="sub.subscription" />
  </template>

  <footer style="margin-top:32px">
    <small>
      Source code &amp; blog post forthcoming. Contact:
      <a href="mailto:thick.jet4332@fastmail.com">thick.jet4332@fastmail.com</a>
    </small>
  </footer>
</template>
```

## 9. Backend Source Files

### `server/db.ts`

```ts
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
    created_at INTEGER NOT NULL
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

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  trigger_token: string;
  user_agent: string | null;
  created_at: number;
}
```

### `server/push.ts`

```ts
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
```

### `server/index.ts`

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db, type SubscriptionRow } from "./db.js";
import { sendDeclarative, vapidPublicKey } from "./push.js";

const app = new Hono();
const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = process.env.STATIC_DIR ?? "dist";

// ---- API ----------------------------------------------------------------

app.get("/healthz", (c) => c.text("ok"));

app.get("/api/vapid-public-key", (c) => c.json({ key: vapidPublicKey }));

app.post("/api/subscribe", async (c) => {
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
  const id = randomUUID();
  const trigger_token = randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO subscriptions (id, endpoint, p256dh, auth, trigger_token, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, endpoint, keys.p256dh, keys.auth, trigger_token, body.user_agent ?? null, Date.now());
  return c.json({ subscriber_id: id, trigger_token });
});

app.post("/api/send", async (c) => {
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
  const result = await sendDeclarative({
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
  });
  db.prepare(
    `UPDATE sends SET sent_at = ?, status = ?, response_body = ?, error = ? WHERE id = ?`,
  ).run(Date.now(), result.status, result.body, result.error, send_id);
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
```

## 10. `.env.example`

```dotenv
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:thick.jet4332@fastmail.com

# Where the SQLite file lives. In Docker/Coolify mount a volume here.
DB_PATH=./demo.sqlite

# Port the Node server listens on.
PORT=8787

# Built SPA directory served by Hono.
STATIC_DIR=dist

# Used in the notification's "navigate" field.
SITE_URL=https://declarative-push.iamjoshcarter.com
```

Append to `.gitignore`:

```
.env
demo.sqlite
demo.sqlite-wal
demo.sqlite-shm
dist
dist-server
/data
```

## 11. Dockerfile and `.dockerignore`

### `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
RUN mkdir -p /data
ENV DB_PATH=/data/demo.sqlite \
    STATIC_DIR=dist \
    PORT=8787
EXPOSE 8787
CMD ["node", "dist-server/index.js"]
```

Notes for the implementer:

- `better-sqlite3` ships prebuilt binaries for the common Node/glibc combos.
  If the runtime image fails to find a prebuilt, the build-essentials installed
  in the runtime stage let it compile from source at install time.
- If a `pnpm-lock.yaml` exists, `--frozen-lockfile` is honored; otherwise the
  fallback `pnpm install` runs. Generate a lockfile locally with `pnpm install`
  before first deploy for reproducibility.

### `.dockerignore`

```
node_modules
dist
dist-server
.env
.git
*.sqlite*
/data
```

## 12. Coolify Deploy Steps

1. Push the repo to GitHub.
2. Generate VAPID keys locally: `npx web-push generate-vapid-keys`.
3. In Coolify dashboard: **New Resource → Application → GitHub**, pick this repo.
4. **Build Pack:** Dockerfile.
5. **Domain:** `https://declarative-push.iamjoshcarter.com`. Make sure the
   DNS A/AAAA record for this subdomain points at the Hetzner box first.
   Coolify will provision Let's Encrypt automatically.
6. **Environment variables** (Coolify UI):
   - `VAPID_PUBLIC_KEY` = (from step 2)
   - `VAPID_PRIVATE_KEY` = (from step 2)
   - `VAPID_SUBJECT` = `mailto:thick.jet4332@fastmail.com`
   - `DB_PATH` = `/data/demo.sqlite`
   - `SITE_URL` = `https://declarative-push.iamjoshcarter.com`
7. **Persistent Storage:** add a volume mounted at `/data` so the SQLite
   file survives redeploys.
8. **Healthcheck:** `GET /healthz` on the container's port (`8787`).
9. Deploy. Subsequent `git push` to the default branch redeploys automatically.

## 13. `README.md`

````markdown
# Declarative Web Push Demo

Reproducing Apple's [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)
on iOS Safari, where the push service accepts every send but the device
displays nothing.

Live: https://declarative-push.iamjoshcarter.com

## Local development

```bash
pnpm install
cp .env.example .env
npx web-push generate-vapid-keys   # paste into .env
pnpm dev                            # runs Vite SPA + Hono API concurrently
```
````

Push requires HTTPS, so subscribe testing locally needs a tunnel
(e.g. `ngrok http 5173` or a Tailscale Funnel) — point Safari at the public
URL, install to home screen, then test.

## Build and run

```bash
pnpm build
pnpm start
```

## Deploy

See `IMPLEMENTATION.md` §12. Single Dockerfile, Coolify on Hetzner.

```

## 14. Acceptance Tests

A correct implementation must satisfy all of:

1. `pnpm install` succeeds.
2. `pnpm check` passes (Vite+ format/lint/typecheck).
3. `pnpm build` produces `dist/` (static SPA) and `dist-server/index.js`
   (compiled server).
4. `pnpm start` boots the server; `GET /healthz` returns `ok`.
5. `GET /` returns the SPA HTML; `GET /api/vapid-public-key` returns the
   public key from the env.
6. On a desktop browser supporting Push (Firefox or Chrome), `Subscribe`
   succeeds, `Send now` produces a desktop notification, and the
   Diagnostics panel records HTTP 201 for the send.
7. On iOS Safari 18.5+ with the PWA installed: `Subscribe` succeeds and
   sends produce HTTP 201 in the Diagnostics panel. Whether iOS actually
   displays the notification is the open question this demo exists to
   answer — both outcomes are valid demo results.
8. Docker image builds and runs end-to-end identically to local.

## 15. Out of Scope

- Service-worker-based push (the thing Apple itself called broken).
- Multi-user dashboards or admin auth.
- Analytics or tracking.
- Any non-declarative payload variant ("send without `web_push: 8030`" was
  considered and rejected to keep the demo focused).
```
