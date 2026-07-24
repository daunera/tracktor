<script lang="ts">
  import LoginForm from '$feature/auth/login-form.svelte';
  import { authStore } from '$stores/auth.svelte';
  import { onMount } from 'svelte';
  import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  let authCheckComplete = $state(false);
  let initialError = $state<string | null>(null);

  onMount(async () => {
    await authStore.checkAuthStatus();
    authCheckComplete = true;

    // Check if user was blocked/rejected (detected by store's checkAuthStatus)
    if (authStore.blockedReason) {
      initialError = authStore.blockedReason;
      authStore.blockedReason = null;
    } else {
      // Check URL params (e.g. from Google OAuth redirect)
      const reasonParam = $page.url.searchParams.get('reason');
      if (reasonParam === 'rejected') {
        initialError = m.auth_account_blocked();
      } else if (reasonParam === 'no_invitation') {
        initialError = m.auth_no_invitation();
      }
    }

    if (authStore.isLoggedIn) {
      if (authStore.user?.status === 'pending') {
        goto('/pending', { replaceState: true });
      } else {
        goto('/dashboard', { replaceState: true });
      }
    }
    if (!authStore.hasUsers) goto('/register', { replaceState: true });
  });
</script>

{#if !authCheckComplete}
  <div id="login-loading-content" class="w-full space-y-6">
    <div id="login-loading-field-1" class="space-y-2">
      <Skeleton class="h-4 w-20" />
      <Skeleton class="h-10 w-full" />
    </div>
    <div id="login-loading-field-2" class="space-y-2">
      <Skeleton class="h-4 w-16" />
      <Skeleton class="h-10 w-full" />
    </div>
    <Skeleton id="login-loading-button" class="h-10 w-full" />
  </div>
{:else}
  <LoginForm {initialError} />
{/if}
