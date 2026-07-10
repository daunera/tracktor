<script lang="ts">
  import { FieldGroup, Field, FieldLabel } from '$ui/field/index.js';
  import Input from '$appui/input.svelte';
  import { authStore } from '$stores/auth.svelte';
  import { goto } from '$app/navigation';
  import UserIcon from '@lucide/svelte/icons/circle-user-round';
  import RectangleEllipsis from '@lucide/svelte/icons/rectangle-ellipsis';
  import SubmitButton from '$appui/SubmitButton.svelte';
  import LogIn from '@lucide/svelte/icons/log-in';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';

  let username = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let processing = $state(false);

  $effect(() => {
    // Check if users exist when component mounts
    authStore.checkAuthStatus();
  });

  const handleRegister = async (event: Event) => {
    event.preventDefault();
    if (!username || !password || !confirmPassword || processing) return;

    if (password !== confirmPassword) {
      toast.error(m.auth_password_mismatch());
      confirmPassword = '';
      return;
    }

    processing = true;
    try {
      const success = await authStore.register(username, password);
      if (success) {
        goto('/pending');
      }
    } finally {
      processing = false;
    }
  };

  const hasAnyLoginMethod = $derived(
    authStore.passwordLoginEnabled || authStore.googleLoginEnabled
  );
</script>

<form id="auth-register-form" onsubmit={handleRegister}>
  <fieldset disabled={processing} class="w-full">
    <FieldGroup class="w-full">
      <!-- Google Sign-In Button - ABOVE password fields -->
      {#if authStore.googleLoginEnabled}
        <Field>
          <button
            type="button"
            onclick={() => authStore.googleLogin()}
            class="border-input bg-background hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-300"
          >
            <LogIn class="h-5 w-5" />
            {m.auth_google_signup()}
          </button>
        </Field>
      {/if}

      {#if authStore.passwordLoginEnabled}
        {#if authStore.googleLoginEnabled}
          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t"></span>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background text-muted-foreground px-2">{m.auth_or()}</span>
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
          <FieldLabel for="confirm-password">{m.auth_confirm_password()}</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            required
            placeholder={m.auth_password_placeholder()}
            icon={RectangleEllipsis}
            bind:value={confirmPassword}
          />
        </Field>
        <Field>
          <SubmitButton
            {processing}
            class="transition-all duration-300"
            loadingText={m.auth_signup_loading()}
          >
            {m.auth_signup_button()}
          </SubmitButton>
        </Field>
      {/if}

      {#if !hasAnyLoginMethod}
        <p class="text-muted-foreground text-center text-sm">
          {m.auth_no_register_methods()}
        </p>
      {/if}
    </FieldGroup>
  </fieldset>
</form>
