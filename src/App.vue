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

  <footer style="margin-top: 32px">
    <small>
      Source code &amp; blog post forthcoming. Contact:
      <a href="mailto:thick.jet4332@fastmail.com">thick.jet4332@fastmail.com</a>
    </small>
  </footer>
</template>
