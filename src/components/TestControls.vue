<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/api";

interface SubInfo {
  id: string;
  label: string;
  triggerToken: string;
}

const props = defineProps<{ subscribers: SubInfo[] }>();
const emit = defineEmits<{ (e: "sent"): void }>();

const busy = ref(false);
const lastResult = ref<string | null>(null);

async function send(delay: number) {
  busy.value = true;
  lastResult.value = null;
  try {
    const results = await Promise.all(props.subscribers.map((s) => api.send(s.id, delay)));
    if (delay > 0) {
      lastResult.value = `Scheduled (${props.subscribers.map((s, i) => `${s.label} pending_id=${(results[i] as { pending_id?: number }).pending_id}`).join(", ")}). Lock your phone now.`;
    } else {
      lastResult.value = `Sent to ${props.subscribers.length} path${props.subscribers.length > 1 ? "s" : ""}. Check Diagnostics for status.`;
    }
    emit("sent");
  } catch (e) {
    lastResult.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function triggerUrl(sub: SubInfo): string {
  return `${window.location.origin}/t/${sub.triggerToken}`;
}

async function copyUrl(sub: SubInfo) {
  await navigator.clipboard.writeText(triggerUrl(sub));
  lastResult.value = `${sub.label} URL copied.`;
}

async function sendOne(sub: SubInfo, delay: number) {
  busy.value = true;
  lastResult.value = null;
  try {
    const r = await api.send(sub.id, delay);
    lastResult.value =
      delay > 0
        ? `${sub.label}: scheduled, pending_id=${(r as { pending_id?: number }).pending_id}. Lock your phone now.`
        : `${sub.label}: sent. Check Diagnostics.`;
    emit("sent");
  } catch (e) {
    lastResult.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h2>Trigger a notification</h2>

    <template v-if="subscribers.length > 1">
      <p><small>Send to both paths simultaneously:</small></p>
      <div class="row">
        <button :disabled="busy" @click="send(0)">Send both now</button>
        <button :disabled="busy" @click="send(15)">Send both in 15s</button>
        <button :disabled="busy" @click="send(60)">Send both in 60s</button>
      </div>

      <p style="margin-top: 12px"><small>Or send to one path only:</small></p>
      <div v-for="sub in subscribers" :key="sub.id" class="row" style="margin-top: 4px">
        <span style="min-width: 120px"
          ><small>{{ sub.label }}:</small></span
        >
        <button :disabled="busy" @click="sendOne(sub, 0)">Now</button>
        <button :disabled="busy" @click="sendOne(sub, 15)">15s</button>
        <button :disabled="busy" @click="sendOne(sub, 60)">60s</button>
      </div>
    </template>

    <template v-else-if="subscribers.length === 1">
      <div class="row">
        <button :disabled="busy" @click="sendOne(subscribers[0], 0)">Send now</button>
        <button :disabled="busy" @click="sendOne(subscribers[0], 15)">Send in 15s</button>
        <button :disabled="busy" @click="sendOne(subscribers[0], 60)">Send in 60s</button>
      </div>
    </template>

    <template v-for="sub in subscribers" :key="sub.id">
      <p style="margin-top: 12px">
        <small>{{ sub.label }} trigger URL:</small>
      </p>
      <div class="row">
        <code style="flex: 1; overflow: auto">{{ triggerUrl(sub) }}</code>
        <button @click="copyUrl(sub)">Copy</button>
      </div>
    </template>

    <p v-if="lastResult" style="margin-top: 8px">
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
