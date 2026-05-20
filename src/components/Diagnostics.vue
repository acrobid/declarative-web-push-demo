<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api, type SendRecord } from "../lib/api";
import { detectIOS, isStandalone } from "../lib/ua";

const props = defineProps<{
  subscriberId: string;
  subscription: PushSubscriptionJSON;
}>();

const sends = ref<SendRecord[]>([]);
const expanded = ref(false);
const ios = detectIOS();
const standalone = isStandalone();
let timer: number | undefined;

async function refresh() {
  try {
    const res = await api.sends(props.subscriberId);
    sends.value = res.sends;
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

const endpointHost = (() => {
  try {
    return new URL(props.subscription.endpoint!).host;
  } catch {
    return props.subscription.endpoint ?? "—";
  }
})();
</script>

<template>
  <section class="card">
    <h2>Diagnostics</h2>
    <p>
      Endpoint: <code>{{ endpointHost }}</code
      ><br />
      UA: <small>{{ userAgent }}</small
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

    <h2 style="margin-top: 16px">Send log (last 10)</h2>
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
