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
  <template v-if="!supported">
    <section class="card">
      <h2>Not available on this browser</h2>
      <p class="status-bad">
        <code>window.pushManager</code> is not exposed. Declarative Web Push is only available on
        Safari 18.5+. Chrome and Firefox still require the old service-worker model.
      </p>
      <p>
        <small
          >This demo sends directly — without Firebase — to prove the <code>web_push</code> field
          works.</small
        >
      </p>
    </section>
  </template>
  <template v-else-if="props.existing">
    <div class="subscribed-badge">
      <span class="status-good">Subscribed</span>
      <button :disabled="busy" @click="onSubscribe">
        {{ busy ? "Subscribing…" : "Re-subscribe" }}
      </button>
    </div>
  </template>
  <template v-else>
    <div class="cta-group">
      <button class="primary hero-btn" :disabled="busy" @click="onSubscribe">
        {{ busy ? "Subscribing…" : "Send me a notification" }}
      </button>
      <p class="cta-hint">
        <span class="em">No service worker required.</span>
        <span class="muted-hint">Works on Safari 18.5+</span>
      </p>
    </div>
    <p v-if="error" class="status-bad cta-error">
      <small>{{ error }}</small>
    </p>
  </template>
</template>
