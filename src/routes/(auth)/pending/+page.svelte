<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$stores/auth.svelte';
  import Clock from '@lucide/svelte/icons/clock';
  import { Button } from '$lib/components/ui/button/index.js';

  let email = $derived($page.url.searchParams.get('email') || '');
  let checking = $state(false);

  const redirectBasedOnStatus = () => {
    const user = authStore.user;
    if (!user) return;

    if (user.status === 'active' || user.role === 'admin') {
      goto('/dashboard', { replaceState: true });
    } else if (user.status === 'rejected') {
      goto('/login', { replaceState: true });
    }
  };

  const checkStatus = async () => {
    checking = true;
    await authStore.checkAuthStatus();
    redirectBasedOnStatus();
    checking = false;
  };

  onMount(async () => {
    await authStore.checkAuthStatus();
    if (authStore.isLoggedIn) {
      redirectBasedOnStatus();
    }
  });
</script>

<div class="flex flex-col items-center gap-6 py-8 text-center">
  <Clock class="text-primary h-12 w-12" />
  <h1 class="text-2xl font-semibold">Registration Pending Approval</h1>
  <p class="text-muted-foreground max-w-md">
    Your registration is pending approval from an administrator.
    {#if email}
      A notification will be sent to <strong>{email}</strong> once your account has been activated.
    {/if}
  </p>
  <p class="text-muted-foreground text-sm">
    If you believe this is an error, please contact the system administrator.
  </p>
  <div class="flex gap-3">
    <Button variant="default" onclick={checkStatus} disabled={checking}>
      {checking ? 'Checking...' : 'Check Status'}
    </Button>
    <Button variant="outline" onclick={() => goto('/login')}>Back to Login</Button>
  </div>
</div>
