<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$stores/auth.svelte';
  import Clock from '@lucide/svelte/icons/clock';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as m from '$lib/paraglide/messages';

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
  <h1 class="text-2xl font-semibold">{m.pending_title()}</h1>
  <p class="text-muted-foreground max-w-md">
    {m.pending_description()}
    {#if email}
      {m.pending_email_hint({ email })}
    {/if}
  </p>
  <p class="text-muted-foreground text-sm">
    {m.pending_error_hint()}
  </p>
  <div class="flex gap-3">
    <Button variant="default" onclick={checkStatus} disabled={checking}>
      {checking ? m.pending_checking() : m.pending_check_status()}
    </Button>
    <Button variant="outline" onclick={() => goto('/login')}>{m.pending_back_to_login()}</Button>
  </div>
</div>
