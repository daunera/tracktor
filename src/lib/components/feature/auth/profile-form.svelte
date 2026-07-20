<script lang="ts">
  import * as Form from '$ui/form/index.js';
  import FormLabel from '$appui/FormLabel.svelte';
  import Input from '$appui/input.svelte';
  import SubmitButton from '$appui/SubmitButton.svelte';
  import { authStore } from '$stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { superForm, defaults } from 'sveltekit-superforms';
  import { zod4 } from 'sveltekit-superforms/adapters';
  import { z } from 'zod/v4';
  import User from '@lucide/svelte/icons/user';
  import Mail from '@lucide/svelte/icons/mail';
  import Lock from '@lucide/svelte/icons/lock';
  import BadgeInfo from '@lucide/svelte/icons/badge-info';
  import IconWithPopover from '$appui/IconWithPopover.svelte';
  import { sheetStore } from '$stores/sheet.svelte';
  import * as m from '$lib/paraglide/messages';
  import { legal_nav_privacy, legal_nav_tos } from '$lib/paraglide/messages';

  let processing = $state(false);
  let nameValue = $state(authStore.user?.name || '');
  let emailValue = $state(authStore.user?.email || '');
  let selectedTheme = $state(themeStore.theme);

  const isGoogleUser = $derived(authStore.user?.authProvider === 'google');

  const themes = $derived(themeStore.getThemes());

  const profileSchema = z
    .object({
      currentPassword: z.string().optional(),
      newPassword: z.string().optional(),
      confirmPassword: z.string().optional()
    })
    .refine(
      (data) => {
        if (isGoogleUser) return true;
        if (data.newPassword && !data.currentPassword) return false;
        return true;
      },
      {
        message: m.profile_zod_current_password_required(),
        path: ['currentPassword']
      }
    )
    .refine(
      (data) => {
        if (data.newPassword && data.newPassword.length < 6) return false;
        return true;
      },
      {
        message: m.profile_zod_new_password_min(),
        path: ['newPassword']
      }
    )
    .refine(
      (data) => {
        if (data.newPassword && data.newPassword !== data.confirmPassword) return false;
        return true;
      },
      { message: m.profile_zod_passwords_mismatch(), path: ['confirmPassword'] }
    );

  const form = superForm(defaults(zod4(profileSchema)), {
    validators: zod4(profileSchema),
    SPA: true,
    resetForm: false,
    onUpdated: async ({ form: f }) => {
      if (f.valid) {
        processing = true;

        const payload: Record<string, string> = {};

        // Only send name/email for password users
        if (!isGoogleUser) {
          if (nameValue !== (authStore.user?.name || '')) {
            payload.name = nameValue;
          }
          if (emailValue !== (authStore.user?.email || '')) {
            payload.email = emailValue;
          }
        }

        // Send password fields if provided
        if (f.data.currentPassword) payload.currentPassword = f.data.currentPassword;
        if (f.data.newPassword) payload.newPassword = f.data.newPassword;

        const success = await authStore.updateProfile(
          Object.keys(payload).length > 0 ? payload : {}
        );

        if (success) {
          // Clear password fields after successful update
          formData.update((d) => ({
            ...d,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
          sheetStore.closeSheet();
        }
        processing = false;
      }
    }
  });

  const { form: formData, enhance } = form;
</script>

<form id="auth-profile-form" use:enhance onsubmit={(e) => e.preventDefault()}>
  <fieldset class="flex flex-col gap-6" disabled={processing}>
    <!-- Name field -->
    <div class="w-full">
      <div class="form-label-wrapper flex flex-row items-center justify-between gap-2">
        <label for="profile-name" data-slot="form-label" class="text-sm leading-none font-medium"
          >{m.profile_name()}</label
        >
        {#if isGoogleUser}
          <IconWithPopover
            icon={BadgeInfo}
            tooltip={m.profile_readonly_google()}
            side="left"
            className="h-4 w-4 text-foreground/50"
          />
        {/if}
      </div>
      <Input
        id="profile-name"
        name="profile-name"
        icon={User}
        type="text"
        bind:value={nameValue}
        readonly={isGoogleUser}
        class={isGoogleUser ? 'opacity-60' : ''}
      />
    </div>

    <!-- Email field -->
    <div class="w-full">
      <div class="form-label-wrapper flex flex-row items-center justify-between gap-2">
        <label for="profile-email" data-slot="form-label" class="text-sm leading-none font-medium"
          >{m.profile_email()}</label
        >
        {#if isGoogleUser}
          <IconWithPopover
            icon={BadgeInfo}
            tooltip={m.profile_readonly_google()}
            side="left"
            className="h-4 w-4 text-foreground/50"
          />
        {/if}
      </div>
      <Input
        id="profile-email"
        name="profile-email"
        icon={Mail}
        type="email"
        bind:value={emailValue}
        readonly={isGoogleUser}
        class={isGoogleUser ? 'opacity-60' : ''}
      />
    </div>

    <!-- Password section -->
    <div class="border-t pt-4">
      <p class="text-muted-foreground mb-4 text-sm">
        {m.profile_password_hint()}
      </p>

      <div class="flex flex-col gap-6">
        {#if !isGoogleUser}
          <Form.Field {form} name="currentPassword" class="w-full">
            <Form.Control>
              {#snippet children({ props })}
                <FormLabel description={m.profile_current_password_desc()}
                  >{m.profile_current_password()}</FormLabel
                >
                <Input
                  {...props}
                  bind:value={$formData.currentPassword}
                  icon={Lock}
                  type="password"
                  autocomplete="current-password"
                />
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        {/if}

        <Form.Field {form} name="newPassword" class="w-full">
          <Form.Control>
            {#snippet children({ props })}
              <FormLabel description={m.profile_new_password_desc()}
                >{m.profile_new_password()}</FormLabel
              >
              <Input
                {...props}
                bind:value={$formData.newPassword}
                icon={Lock}
                type="password"
                autocomplete="new-password"
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>

        <Form.Field {form} name="confirmPassword" class="w-full">
          <Form.Control>
            {#snippet children({ props })}
              <FormLabel description={m.profile_confirm_password_desc()}
                >{m.profile_confirm_password()}</FormLabel
              >
              <Input
                {...props}
                bind:value={$formData.confirmPassword}
                icon={Lock}
                type="password"
                autocomplete="new-password"
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </div>
    </div>

    <!-- Theme selector -->
    <div class="border-t pt-4">
      <div class="form-label-wrapper flex flex-row items-center justify-between gap-2">
        <span data-slot="form-label" class="text-sm leading-none font-medium"
          >{m.profile_theme()}</span
        >
        <IconWithPopover
          icon={BadgeInfo}
          tooltip={m.profile_theme_desc()}
          side="left"
          className="h-4 w-4 text-foreground/50"
        />
      </div>
      <div class="mt-2 flex flex-wrap gap-3">
        {#each themes as theme (theme.name)}
          <button
            type="button"
            onclick={() => {
              selectedTheme = theme.name;
              themeStore.setTheme(theme.name);
            }}
            class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors
              {selectedTheme === theme.name
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input hover:bg-muted'}"
          >
            <span
              class="inline-block h-4 w-4 rounded-full"
              style="background-color: {theme.colors?.primary || '#000'}"
            ></span>
            {theme.label}
          </button>
        {/each}
      </div>
    </div>

    <SubmitButton {processing} class="w-full">{m.profile_update_button()}</SubmitButton>
  </fieldset>
</form>

<div class="border-t pt-4 pb-2">
  <div class="text-muted-foreground flex items-center justify-center gap-4 text-xs">
    <a href="/privacy-policy" class="hover:text-foreground transition-colors">
      {legal_nav_privacy()}
    </a>
    <a href="/terms-of-service" class="hover:text-foreground transition-colors">
      {legal_nav_tos()}
    </a>
  </div>
</div>
