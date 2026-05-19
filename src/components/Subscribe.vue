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
