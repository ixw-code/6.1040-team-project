<script setup lang="ts">
import { onMounted } from "vue";
import SignIn from "./SignIn.vue";
import PasswordForm from "./PasswordForm.vue";
import HouseholdPicker from "./HouseholdPicker.vue";
import { useSession } from "./session.ts";
const { me, checked, load } = useSession();
onMounted(load);
</script>

<template>
  <main v-if="!checked" class="workspace">Loading…</main>
  <main v-else-if="!me" class="workspace sign-in">
    <p class="household">Shift Happens</p>
    <SignIn lead="Sign in to manage your household chores."><PasswordForm /></SignIn>
  </main>
  <HouseholdPicker v-else :key="me.user" :person="me.user" :username="me.username" />
</template>
