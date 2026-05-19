<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>What actually happens on iOS (as of testing)</h2>
    <ul class="bullets">
      <li>Subscription succeeds — endpoint is issued by Apple's push service.</li>
      <li>Server signs the payload and POSTs to that endpoint.</li>
      <li>Push service returns HTTP 201 — accepted for delivery.</li>
      <li>
        As of Safari 18.5, delivery works — notification appears without requiring the site to be
        installed to the Home Screen.
      </li>
      <li>
        Earlier versions: push service accepted every send (201) but the device displayed nothing.
      </li>
    </ul>
    <p><small>Run the test below. The Diagnostics panel will show the receipts.</small></p>
  </section>
</template>
