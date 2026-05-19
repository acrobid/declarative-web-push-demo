<script setup lang="ts">
import { computed } from "vue";
import { detectIOS, isStandalone } from "../lib/ua";

const ios = detectIOS();
const standalone = isStandalone();
const show = computed(() => ios.isIOS && !standalone);
</script>

<template>
  <section v-if="show" class="card">
    <h2>Install first (iOS only)</h2>
    <p>iOS Safari requires the site to be installed to the Home Screen before Push works.</p>
    <ol>
      <li>Tap the Share button in Safari.</li>
      <li>Tap <strong>Add to Home Screen</strong>.</li>
      <li>Open the installed app from your Home Screen, then continue here.</li>
    </ol>
  </section>
</template>
