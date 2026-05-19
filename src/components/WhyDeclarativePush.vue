<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>What is Declarative Web Push?</h2>
    <ul class="bullets">
      <li>No service worker needed — the OS displays the notification natively.</li>
      <li>Subscribe via <code>window.pushManager</code> (Safari 18.5+).</li>
      <li>
        Server sends JSON with <code>"web_push": 8030</code> and a <code>notification</code> object.
      </li>
      <li>OS parses the payload, shows the banner, updates the app badge.</li>
      <li>Better battery life, better privacy than the old service-worker model.</li>
    </ul>
    <p>
      <small
        >Apple shipped this in Safari 18.5.
        <a
          href="https://webkit.org/blog/16535/meet-declarative-web-push/"
          target="_blank"
          rel="noopener"
          >WebKit blog post</a
        ></small
      >
    </p>
  </section>
</template>
