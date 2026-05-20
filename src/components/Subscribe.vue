<script setup lang="ts">
import { ref } from "vue";
import { subscribePush, type SubscribeResult } from "../lib/push";
import { supportsDeclarativePush } from "../lib/ua";

const emit = defineEmits<{
  (e: "subscribed", result: SubscribeResult): void;
}>();

const props = defineProps<{
  existing: SubscribeResult | null;
}>();

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
    <template v-if="!supported">
      <p class="status-bad">
        This browser does not expose <code>window.pushManager</code>. Declarative Web Push is only
        available on Safari 18.5+. On Chrome and Firefox, the old service-worker model is the only
        option.
      </p>
      <p>
        <small
          >On Safari, the <code>web_push</code> field works when sending directly — but Firebase
          rejects it as an unknown field. This demo sends directly without Firebase.</small
        >
      </p>
    </template>
    <template v-else-if="props.existing">
      <p class="status-good">
        Subscribed — ID <code>{{ props.existing.subscriber_id.slice(0, 8) }}&hellip;</code>
      </p>
      <button :disabled="busy" @click="onSubscribe">
        {{ busy ? "Subscribing…" : "Re-subscribe" }}
      </button>
    </template>
    <template v-else>
      <p>
        Grant notification permission and subscribe via
        <code>window.pushManager</code>. No service worker required.
      </p>
      <button class="primary" :disabled="busy" @click="onSubscribe">
        {{ busy ? "Subscribing…" : "Subscribe to push" }}
      </button>
    </template>
    <p v-if="error" class="status-bad">
      <small>{{ error }}</small>
    </p>
  </section>
</template>
