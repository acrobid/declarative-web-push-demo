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
    <p style="margin-top: 12px"><small>Personal trigger URL (hit it from any device):</small></p>
    <div class="row">
      <code style="flex: 1; overflow: auto">{{ triggerUrl }}</code>
      <button @click="copyUrl">Copy</button>
    </div>
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
