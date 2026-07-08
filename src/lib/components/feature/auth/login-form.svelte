<script lang="ts">
  import { FieldGroup, Field, FieldLabel } from '$ui/field/index.js';
  import Input from '$appui/input.svelte';
  import { authStore } from '$stores/auth.svelte';
  import { goto } from '$app/navigation';
  import UserIcon from '@lucide/svelte/icons/circle-user-round';
  import RectangleEllipsis from '@lucide/svelte/icons/rectangle-ellipsis';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import SubmitButton from '$appui/SubmitButton.svelte';
  import LogIn from '@lucide/svelte/icons/log-in';
  import * as m from '$lib/paraglide/messages';

  let { initialError = null }: { initialError?: string | null } = $props();

  let username = $state('');
  let password = $state('');
  let processing = $state(false);
  let loginError = $state<string | null>(null);

  $effect(() => {
    loginError = initialError;
  });

  const handleLogin = async (event: Event) => {
    event.preventDefault();
    if (!username || !password || processing) return;

    processing = true;
    loginError = null;
    try {
      const result = await authStore.login(username, password);
      if (result.success) {
        goto('/dashboard');
      } else {
        loginError = result.errorMessage || 'Login failed. Please try again.';
      }
    } finally {
      processing = false;
    }
  };

  const hasAnyLoginMethod = $derived(
    authStore.passwordLoginEnabled || authStore.googleLoginEnabled
  );
</script>

<form id="auth-login-form" onsubmit={handleLogin}>
  <fieldset disabled={processing} class="w-full">
    <FieldGroup class="w-full">
      {#if loginError}
        <div
          class="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <div class="flex items-start gap-2">
            <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        </div>
      {/if}
      <!-- Google Sign-In Button - ABOVE password fields -->
      {#if authStore.googleLoginEnabled}
        <div class:py-8={authStore.googleLoginEnabled && !authStore.passwordLoginEnabled}>
          <Field>
            <button
              type="button"
              onclick={() => authStore.googleLogin()}
              class="border-input bg-background hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-300"
            >
              <LogIn class="h-5 w-5" />
              Sign in with Google
            </button>
          </Field>
        </div>
      {/if}

      {#if authStore.passwordLoginEnabled}
        {#if authStore.googleLoginEnabled}
          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t"></span>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background text-muted-foreground px-2">or</span>
            </div>
          </div>
        {/if}

        <Field>
          <FieldLabel for="email">{m.auth_username()}</FieldLabel>
          <Input
            id="email"
            icon={UserIcon}
            type="text"
            required
            bind:value={username}
            placeholder={m.auth_username_placeholder()}
          />
        </Field>
        <Field>
          <FieldLabel for="password">{m.auth_password()}</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            placeholder={m.auth_password_placeholder()}
            icon={RectangleEllipsis}
            bind:value={password}
          />
        </Field>
        <Field>
          <SubmitButton
            {processing}
            class="transition-all duration-300"
            loadingText={m.auth_login_loading()}
          >
            {m.auth_login_button()}
          </SubmitButton>
        </Field>
      {/if}

      {#if !hasAnyLoginMethod}
        <p class="text-muted-foreground text-center text-sm">
          No login methods are currently enabled. Please contact the system administrator.
        </p>
      {/if}
    </FieldGroup>
  </fieldset>
</form>
