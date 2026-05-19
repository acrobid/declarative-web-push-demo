<script setup lang="ts">
import { ref } from "vue";
import WhyDeclarativePush from "./components/WhyDeclarativePush.vue";
import FirebaseBlocksIt from "./components/FirebaseBlocksIt.vue";
import InstallInstructions from "./components/InstallInstructions.vue";
import Subscribe from "./components/Subscribe.vue";
import TestControls from "./components/TestControls.vue";
import Diagnostics from "./components/Diagnostics.vue";
import type { SubscribeResult } from "./lib/push";

const sub = ref<SubscribeResult | null>(null);
const diag = ref<InstanceType<typeof Diagnostics> | null>(null);

function onSubscribed(r: SubscribeResult) {
  sub.value = r;
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
    <h1>Declarative Web Push works on Safari. Firebase blocks it.</h1>
    <p>
      Apple shipped Declarative Web Push in Safari 18.5 — push notifications without a service
      worker, with better battery life and privacy. It works. But Firebase Cloud Messaging strips
      the <code>web_push</code> field from push payloads, making it impossible to use even on Safari
      where it's fully supported. This demo proves what you're missing.
    </p>
  </header>

  <WhyDeclarativePush />
  <FirebaseBlocksIt />
  <InstallInstructions />

  <Subscribe :existing="sub" @subscribed="onSubscribed" />

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
