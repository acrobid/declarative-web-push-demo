<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>What actually happens on iOS (as of testing)</h2>
    <ul class="bullets">
      <li>Subscription succeeds — endpoint is issued by Apple's push service.</li>
      <li>Server signs the payload and POSTs to that endpoint.</li>
      <li>Push service returns HTTP 201 — accepted for delivery.</li>
      <li>
        Device displays nothing. No banner. No badge. Locked or unlocked, foreground or background.
      </li>
      <li>Same payload to Firefox/Chrome desktop displays correctly.</li>
    </ul>
    <p><small>Run the test below. The Diagnostics panel will show the receipts.</small></p>
  </section>
</template>
