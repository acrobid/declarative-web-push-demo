<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>What Apple says should happen</h2>
    <ul class="bullets">
      <li>No service worker needed — the OS displays the notification.</li>
      <li>Site subscribes via <code>window.pushManager</code>.</li>
      <li>
        Server sends JSON with <code>"web_push": 8030</code> and a <code>notification</code> object.
      </li>
      <li>OS parses payload, shows banner, updates app badge.</li>
      <li>More private and battery-friendly than the old service-worker model.</li>
    </ul>
    <p>
      <small
        >Source:
        <a
          href="https://webkit.org/blog/16535/meet-declarative-web-push/"
          target="_blank"
          rel="noopener"
          >webkit.org/blog/16535</a
        ></small
      >
    </p>
  </section>
</template>
