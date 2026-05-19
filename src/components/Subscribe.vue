<script setup lang="ts">
import { ref } from "vue";
import { subscribePush, subscribeSW, type SubscribeResult } from "../lib/push";
import { supportsDeclarativePush, supportsServiceWorkerPush } from "../lib/ua";

const emit = defineEmits<{
  (e: "declarative-subscribed", result: SubscribeResult): void;
  (e: "sw-subscribed", result: SubscribeResult): void;
}>();

const props = defineProps<{
  declarativeSub: SubscribeResult | null;
  swSub: SubscribeResult | null;
}>();

const supportsDeclarative = supportsDeclarativePush();
const supportsSW = supportsServiceWorkerPush();

const declarativeBusy = ref(false);
const declarativeError = ref<string | null>(null);
const swBusy = ref(false);
const swError = ref<string | null>(null);

async function onSubscribeDeclarative() {
  declarativeBusy.value = true;
  declarativeError.value = null;
  try {
    const result = await subscribePush();
    emit("declarative-subscribed", result);
  } catch (e) {
    declarativeError.value = e instanceof Error ? e.message : String(e);
  } finally {
    declarativeBusy.value = false;
  }
}

async function onSubscribeSW() {
  swBusy.value = true;
  swError.value = null;
  try {
    const result = await subscribeSW();
    emit("sw-subscribed", result);
  } catch (e) {
    swError.value = e instanceof Error ? e.message : String(e);
  } finally {
    swBusy.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h2>Subscribe</h2>
    <p>
      Subscribe using each path independently to see whether they behave differently on this device.
    </p>

    <div class="subscribe-grid">
      <!-- Declarative Web Push -->
      <div class="subscribe-col">
        <h3>Declarative Web Push</h3>
        <p>
          <small
            >Uses <code>window.pushManager</code>. No service worker. Browser renders the
            notification natively.</small
          >
        </p>
        <template v-if="props.declarativeSub">
          <p class="status-good">
            <small>Subscribed — ID {{ props.declarativeSub.subscriber_id.slice(0, 8) }}…</small>
          </p>
          <button
            v-if="supportsDeclarative"
            @click="onSubscribeDeclarative"
            :disabled="declarativeBusy"
          >
            Re-subscribe
          </button>
        </template>
        <template v-else-if="!supportsDeclarative">
          <p class="status-bad">
            <small><code>window.pushManager</code> not found — not supported here.</small>
          </p>
        </template>
        <template v-else>
          <button class="primary" :disabled="declarativeBusy" @click="onSubscribeDeclarative">
            {{ declarativeBusy ? "Subscribing…" : "Subscribe (declarative)" }}
          </button>
        </template>
        <p v-if="declarativeError" class="status-bad">
          <small>{{ declarativeError }}</small>
        </p>
      </div>

      <!-- Service Worker Web Push -->
      <div class="subscribe-col">
        <h3>Service Worker Push</h3>
        <p>
          <small
            >Uses <code>registration.pushManager</code>. Requires a registered SW to handle the
            <code>push</code> event and call <code>showNotification()</code>.</small
          >
        </p>
        <template v-if="props.swSub">
          <p class="status-good">
            <small>Subscribed — ID {{ props.swSub.subscriber_id.slice(0, 8) }}…</small>
          </p>
          <button v-if="supportsSW" @click="onSubscribeSW" :disabled="swBusy">Re-subscribe</button>
        </template>
        <template v-else-if="!supportsSW">
          <p class="status-bad">
            <small>Service workers or PushManager not supported here.</small>
          </p>
        </template>
        <template v-else>
          <button class="primary" :disabled="swBusy" @click="onSubscribeSW">
            {{ swBusy ? "Subscribing…" : "Subscribe (SW)" }}
          </button>
        </template>
        <p v-if="swError" class="status-bad">
          <small>{{ swError }}</small>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.subscribe-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

@media (max-width: 600px) {
  .subscribe-grid {
    grid-template-columns: 1fr;
  }
}

.subscribe-col {
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
}

.subscribe-col h3 {
  margin: 0 0 8px;
  font-size: 0.9rem;
}
</style>
