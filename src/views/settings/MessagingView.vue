<template>
  <main class="page">
    <div class="page-head">
      <div>
        <h1>Messaging</h1>
        <p class="sub">The platform's WhatsApp and SMS accounts, used by every clinic that does not use its own.
          OTP codes and booking messages go out through them.</p>
      </div>
    </div>
    <MessagingSettings />
  </main>
</template>

<script setup>
import MessagingSettings from '@/components/messaging/MessagingSettings.vue'
</script>
