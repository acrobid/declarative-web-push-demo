<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api, type SendRecord, type DebugInfo } from "../lib/api";
import { detectIOS, isStandalone } from "../lib/ua";

interface SubInfo {
  id: string;
  label: string;
  subscription: PushSubscriptionJSON;
}

const props = defineProps<{ subscribers: SubInfo[] }>();

const sendsBySubscriber = ref<Record<string, SendRecord[]>>({});
const debug = ref<DebugInfo | null>(null);
const expanded = ref<Record<string, boolean>>({});
const ios = detectIOS();
const standalone = isStandalone();
let timer: number | undefined;

async function refresh() {
  try {
    const [sendsResults, debugRes] = await Promise.all([
      Promise.all(props.subscribers.map((s) => api.sends(s.id))),
      api.debug(),
    ]);
    const map: Record<string, SendRecord[]> = {};
    props.subscribers.forEach((s, i) => {
      map[s.id] = sendsResults[i].sends;
    });
    sendsBySubscriber.value = map;
    debug.value = debugRes;
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

const userAgent = navigator.userAgent;

function endpointHost(sub: SubInfo): string {
  try {
    return new URL(sub.subscription.endpoint!).host;
  } catch {
    return sub.subscription.endpoint ?? "—";
  }
}
</script>

<template>
  <section class="card">
    <h2>Diagnostics</h2>
    <p>
      UA: <small>{{ userAgent }}</small
      ><br />
      iOS: <small>{{ ios.isIOS ? (ios.version ?? "yes") : "no" }}</small> · Standalone (installed):
      <small>{{ standalone ? "yes" : "no" }}</small>
    </p>

    <div
      v-for="sub in subscribers"
      :key="sub.id"
      style="margin-top: 16px; border-top: 1px solid #333; padding-top: 12px"
    >
      <h3>{{ sub.label }} — send log (last 10)</h3>
      <p>
        Endpoint: <code>{{ endpointHost(sub) }}</code>
        <span style="margin-left: 8px">
          <button style="font-size: 0.75rem" @click="expanded[sub.id] = !expanded[sub.id]">
            {{ expanded[sub.id] ? "Hide" : "Show" }} subscription JSON
          </button>
        </span>
      </p>
      <pre v-if="expanded[sub.id]" class="json">{{
        JSON.stringify(sub.subscription, null, 2)
      }}</pre>

      <table v-if="sendsBySubscriber[sub.id]?.length">
        <thead>
          <tr>
            <th>Requested</th>
            <th>Sent</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sendsBySubscriber[sub.id]" :key="s.id">
            <td>{{ fmt(s.requested_at) }}</td>
            <td>{{ fmt(s.sent_at) }}</td>
            <td
              :class="s.status && s.status >= 200 && s.status < 300 ? 'status-good' : 'status-bad'"
            >
              {{ s.status ?? (s.sent_at ? "—" : "pending") }}
            </td>
            <td>
              <small>{{ s.error ?? s.response_body ?? "" }}</small>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else><small>No sends yet for this path.</small></p>
    </div>
  </section>

  <section class="card" v-if="debug">
    <h2>Server Debug</h2>

    <h3>Config</h3>
    <table>
      <tbody>
        <tr>
          <th>SITE_URL</th>
          <td>
            <code>{{ debug.config.site_url }}</code>
          </td>
        </tr>
        <tr>
          <th>VAPID key (prefix)</th>
          <td>
            <code>{{ debug.config.vapid_public_key_prefix }}</code>
          </td>
        </tr>
        <tr>
          <th>Port</th>
          <td>
            <code>{{ debug.config.port }}</code>
          </td>
        </tr>
        <tr>
          <th>Node</th>
          <td>
            <code>{{ debug.config.node_version }}</code>
          </td>
        </tr>
        <tr>
          <th>Uptime</th>
          <td>{{ debug.config.uptime_seconds }}s</td>
        </tr>
      </tbody>
    </table>

    <h3 style="margin-top: 16px">Active subscriptions ({{ debug.subscriptions.length }})</h3>
    <table v-if="debug.subscriptions.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Push service</th>
          <th>UA (truncated)</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in debug.subscriptions" :key="s.id">
          <td>
            <code>{{ s.id.slice(0, 8) }}…</code>
          </td>
          <td>
            <code>{{ s.type }}</code>
          </td>
          <td>
            <code>{{ s.endpoint_host }}</code>
          </td>
          <td>
            <small>{{ (s.user_agent ?? "—").slice(0, 60) }}</small>
          </td>
          <td>
            <small>{{ fmt(s.created_at) }}</small>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else><small>No active subscriptions.</small></p>

    <h3 style="margin-top: 16px">All recent sends (last 30, all devices)</h3>
    <table v-if="debug.recent_sends.length">
      <thead>
        <tr>
          <th>Sub ID</th>
          <th>Push service</th>
          <th>Requested</th>
          <th>Sent</th>
          <th>Status</th>
          <th>Response / Error</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in debug.recent_sends" :key="s.id">
          <td>
            <code>{{ s.subscription_id.slice(0, 8) }}…</code>
          </td>
          <td>
            <code>{{ s.endpoint_host ?? "—" }}</code>
          </td>
          <td>
            <small>{{ fmt(s.requested_at) }}</small>
          </td>
          <td>
            <small>{{ fmt(s.sent_at) }}</small>
          </td>
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
