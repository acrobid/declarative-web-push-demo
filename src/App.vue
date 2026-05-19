<script setup lang="ts">
import { computed, ref } from "vue";
import WhatApplePromises from "./components/WhatApplePromises.vue";
import WhatActuallyHappens from "./components/WhatActuallyHappens.vue";
import InstallInstructions from "./components/InstallInstructions.vue";
import Subscribe from "./components/Subscribe.vue";
import TestControls from "./components/TestControls.vue";
import Diagnostics from "./components/Diagnostics.vue";
import type { SubscribeResult } from "./lib/push";

const declarativeSub = ref<SubscribeResult | null>(null);
const swSub = ref<SubscribeResult | null>(null);
const diag = ref<InstanceType<typeof Diagnostics> | null>(null);

function onDeclarativeSubscribed(r: SubscribeResult) {
  declarativeSub.value = r;
  localStorage.setItem("dwp:declarative-sub", JSON.stringify(r));
}

function onSWSubscribed(r: SubscribeResult) {
  swSub.value = r;
  localStorage.setItem("dwp:sw-sub", JSON.stringify(r));
}

try {
  const d = localStorage.getItem("dwp:declarative-sub");
  if (d) declarativeSub.value = JSON.parse(d) as SubscribeResult;
} catch {
  /* ignore */
}
try {
  const s = localStorage.getItem("dwp:sw-sub");
  if (s) swSub.value = JSON.parse(s) as SubscribeResult;
} catch {
  /* ignore */
}

// Keep backward compat with the old single-sub key (declarative).
if (!declarativeSub.value) {
  try {
    const old = localStorage.getItem("dwp:sub");
    if (old) {
      declarativeSub.value = JSON.parse(old) as SubscribeResult;
      localStorage.setItem("dwp:declarative-sub", old);
    }
  } catch {
    /* ignore */
  }
}

const subscribers = computed(() => {
  const list = [];
  if (declarativeSub.value)
    list.push({
      id: declarativeSub.value.subscriber_id,
      label: "Declarative",
      triggerToken: declarativeSub.value.trigger_token,
    });
  if (swSub.value)
    list.push({
      id: swSub.value.subscriber_id,
      label: "Service Worker",
      triggerToken: swSub.value.trigger_token,
    });
  return list;
});

const diagSubscribers = computed(() => {
  const list = [];
  if (declarativeSub.value)
    list.push({
      id: declarativeSub.value.subscriber_id,
      label: "Declarative",
      subscription: declarativeSub.value.subscription,
    });
  if (swSub.value)
    list.push({
      id: swSub.value.subscriber_id,
      label: "Service Worker",
      subscription: swSub.value.subscription,
    });
  return list;
});

const hasAnySub = computed(() => declarativeSub.value !== null || swSub.value !== null);
</script>

<template>
  <header>
    <h1>Declarative Web Push on iOS — live test</h1>
    <p>
      Apple shipped Declarative Web Push to replace the service-worker notification model on iOS. It
      works as of Safari 18.5 — no install required. This page lets you subscribe to both the
      declarative path and the classic SW path and compare delivery side-by-side on the same device.
    </p>
  </header>

  <WhatApplePromises />
  <WhatActuallyHappens />
  <InstallInstructions />

  <Subscribe
    :declarative-sub="declarativeSub"
    :sw-sub="swSub"
    @declarative-subscribed="onDeclarativeSubscribed"
    @sw-subscribed="onSWSubscribed"
  />

  <template v-if="hasAnySub">
    <TestControls :subscribers="subscribers" @sent="diag?.refresh()" />
    <Diagnostics ref="diag" :subscribers="diagSubscribers" />
  </template>

  <footer style="margin-top: 32px">
    <small>
      Source code &amp; blog post forthcoming. Contact:
      <a href="mailto:thick.jet4332@fastmail.com">thick.jet4332@fastmail.com</a>
    </small>
  </footer>
</template>
