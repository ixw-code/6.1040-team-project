<script setup lang="ts">
// The team's sign-in (SignIn.vue + PasswordForm.vue, unchanged) on the corkboard, as an index card.
// Styles reach into those components with :deep so their files don't need edits.
import "./resident.css";
import PasswordForm from "../PasswordForm.vue";
import SignIn from "../SignIn.vue";
</script>

<template>
  <div class="resident rs-cork">
    <main class="wrap">
      <p class="brand rs-heading">Shift Happens</p>
      <div class="rs-paper card">
        <svg class="pin" width="22" height="22" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="var(--rs-pin)" /><circle cx="7" cy="7" r="2.4" fill="#f3a093" /></svg>
        <SignIn>
          <PasswordForm />
        </SignIn>
      </div>
    </main>
  </div>
</template>

<style scoped>
.wrap { flex: 1; width: 100%; max-width: 420px; margin: 0 auto; padding: 48px 18px; display: flex; flex-direction: column; gap: 18px; }
.brand { margin: 0; font-size: 2.75rem; line-height: 1; letter-spacing: .03em; color: var(--rs-cork-ink); }
.card { position: relative; padding: 28px 22px 22px; transform: rotate(-.6deg); }
.pin { position: absolute; top: -8px; left: 50%; margin-left: -11px; }

.card :deep(h1) { margin: 0; font-family: "Fira Sans Condensed", sans-serif; font-variant-caps: small-caps; font-weight: 500; letter-spacing: .05em; font-size: 2rem; }
.card :deep(.lead) { margin: 4px 0 18px; font-size: 1.05rem; }
.card :deep(.refusal) { margin: 0 0 14px; font-family: "Patrick Hand", cursive; font-size: 1.2rem; color: var(--rs-overdue); }
.card :deep(.field) { display: flex; flex-direction: column; gap: 6px; font-family: "Fira Sans Condensed", sans-serif; font-variant-caps: small-caps; font-weight: 500; letter-spacing: .05em; font-size: 1.15rem; }
.card :deep(.field input) { height: 44px; padding: 0 10px; border: 2px solid var(--rs-ink); border-radius: 4px; background: #fff; color: var(--rs-ink); font: 17px "Times New Roman", Times, serif; font-variant-caps: normal; letter-spacing: 0; }
.card :deep(.hint) { font-family: "Times New Roman", Times, serif; font-variant-caps: normal; letter-spacing: 0; font-size: .9rem; color: #5a4a38; }
.card :deep(.button) { min-height: 50px; border: 2px solid var(--rs-ink); border-radius: 999px; background: var(--rs-ink); color: #fffaf0; font-family: "Fira Sans Condensed", sans-serif; font-variant-caps: small-caps; font-weight: 500; letter-spacing: .06em; font-size: 1.35rem; cursor: pointer; }
.card :deep(.button:disabled) { opacity: .6; cursor: default; }
.card :deep(.switch) { margin: 0; text-align: center; }
.card :deep(.text-button) { min-height: 44px; padding: 0 4px; border: 0; background: none; color: var(--rs-ink); font: inherit; text-decoration: underline; cursor: pointer; }
</style>
