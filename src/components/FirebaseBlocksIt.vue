<script setup lang="ts"></script>

<template>
  <section class="card">
    <h2>Firebase Cloud Messaging blocks it</h2>
    <ul class="bullets">
      <li>Safari supports declarative web push. It works today.</li>
      <li>
        But if you use Firebase Cloud Messaging to send push, FCM's SDK
        <strong>rejects the <code>web_push</code> field</strong> with a validation error.
      </li>
      <li>
        This means Firebase users cannot use declarative push — even on Safari where it's fully
        supported.
      </li>
      <li>
        The fix is trivial: allow a single optional field. Google acknowledged the issue in 2025 but
        has taken no action.
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
    <p><small>Star and comment to signal demand for this single-field fix.</small></p>
  </section>
</template>
