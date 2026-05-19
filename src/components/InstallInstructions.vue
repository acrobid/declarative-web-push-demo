<script setup lang="ts">
import { computed } from "vue";
import { detectIOS, isStandalone } from "../lib/ua";

const ios = detectIOS();
const standalone = isStandalone();
const show = computed(() => ios.isIOS && !standalone);
</script>

<template>
  <section v-if="show" class="card">
    <h2>Running in Safari (not installed)</h2>
    <p>
      Declarative Web Push works directly in Safari — no Home Screen install required. If you want
      to compare installed vs. in-browser behavior, you can add it to your Home Screen.
    </p>
    <ol>
      <li>Tap the Share button in Safari.</li>
      <li>Tap <strong>Add to Home Screen</strong>.</li>
      <li>Open from your Home Screen and subscribe again to get a separate reading.</li>
    </ol>
  </section>
</template>
