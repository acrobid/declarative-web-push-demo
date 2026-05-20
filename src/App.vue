<script setup lang="ts">
import { ref } from "vue";
import WhyDeclarativePush from "./components/WhyDeclarativePush.vue";
import FirebaseBlocksIt from "./components/FirebaseBlocksIt.vue";
import InstallInstructions from "./components/InstallInstructions.vue";
import Subscribe from "./components/Subscribe.vue";
import TestControls from "./components/TestControls.vue";
import Diagnostics from "./components/Diagnostics.vue";
import { api } from "./lib/api";
import type { SubscribeResult } from "./lib/push";

const sub = ref<SubscribeResult | null>(null);
const diag = ref<InstanceType<typeof Diagnostics> | null>(null);
const autoSent = ref(false);
const autoSendError = ref<string | null>(null);

async function onSubscribed(r: SubscribeResult) {
  sub.value = r;
  localStorage.setItem("dwp:sub", JSON.stringify(r));

  if (!autoSent.value) {
    try {
      await api.send(r.subscriber_id, 0);
      autoSent.value = true;
    } catch (e) {
      autoSendError.value = e instanceof Error ? e.message : String(e);
    }
  }
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
  <section class="hero">
    <h1>
      Notifications work without a service worker on Safari.<br />Google Firebase blocks the
      feature.
    </h1>
    <p class="hero-sub">
      Apple shipped
      <span class="em">push notifications without a service worker</span>. It's
      <em class="magic-word">magic</em>. <span class="em">It works today.</span> But Firebase Cloud
      Messaging rejects the field that makes it possible.
      <span class="em">1 line of code in a type file is all it would take to fix.</span>
    </p>
  </section>

  <section class="hero-cta">
    <Subscribe :existing="sub" @subscribed="onSubscribed" />
  </section>

  <template v-if="sub">
    <Transition name="reveal">
      <section v-if="autoSent || autoSendError" class="card success-card">
        <template v-if="autoSent">
          <h2>Notification sent. No service worker was used.</h2>
          <p>
            Go to your home screen or lock your phone — you'll see the notification there. It was
            delivered directly by iOS, not by JavaScript running in a background thread.
          </p>
          <p class="sub">This is Declarative Web Push.</p>
          <p class="magic-note">
            <span class="em">Pro tip:</span> Install this page to your Home Screen. Notifications
            show up with your app icon &mdash; <span class="em">feels like a native app</span>.
          </p>
        </template>
        <template v-else>
          <h2>Subscribed, but the auto-send failed</h2>
          <p class="status-bad">{{ autoSendError }}</p>
        </template>
      </section>
    </Transition>

    <TestControls
      :subscriber-id="sub.subscriber_id"
      :trigger-token="sub.trigger_token"
      @sent="diag?.refresh()"
    />

    <Diagnostics ref="diag" :subscriber-id="sub.subscriber_id" :subscription="sub.subscription" />

    <section class="card catch-card">
      <h2>What just happened?</h2>
      <ul class="bullets">
        <li>
          You subscribed via <code>window.pushManager</code> —
          <span class="em">no service worker</span>
          was registered.
        </li>
        <li>
          The server sent a JSON payload with <code>"web_push": 8030</code> and a notification
          object.
        </li>
        <li>iOS parsed the payload and displayed the notification natively.</li>
        <li>Better battery life, better privacy than the old service-worker model.</li>
      </ul>
      <p>
        <small
          ><a
            href="https://webkit.org/blog/16535/meet-declarative-web-push/"
            target="_blank"
            rel="noopener"
            >Apple shipped this in Safari 18.5</a
          ></small
        >
      </p>

      <h2 style="margin-top: 24px">But here's the catch.</h2>
      <ul class="bullets">
        <li>
          Declarative Web Push requires a <strong>custom server</strong> — you can't use Firebase
          Cloud Messaging.
        </li>
        <li>
          FCM's SDK rejects the <code>web_push</code> field as unknown, even on Safari where it's
          fully supported.
        </li>
        <li>
          You either self-host (like this demo) or wait for Google to accept a one-field
          passthrough.
        </li>
      </ul>
      <p>
        <a
          href="https://github.com/firebase/firebase-admin-node/issues/2892"
          target="_blank"
          rel="noopener"
          >GitHub issue: firebase-admin-node#2892</a
        >
      </p>
      <p>
        <small>Star and comment to signal demand for this single-field fix.</small>
      </p>
    </section>
  </template>

  <template v-else>
    <WhyDeclarativePush />
    <FirebaseBlocksIt />
  </template>

  <InstallInstructions />

  <footer class="footer">
    <small>
      Source code &amp; blog post forthcoming. Contact:
      <a href="mailto:thick.jet4332@fastmail.com">thick.jet4332@fastmail.com</a>
    </small>
  </footer>
</template>
