<script lang="ts">
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import { toast } from 'svelte-sonner';
  import { sheetStore } from '$stores/sheet.svelte';
  import SubmitButton from '$appui/SubmitButton.svelte';
  import * as m from '$lib/paraglide/messages';

  let email = $state('');
  let processing = $state(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let isValidEmail = $derived(emailRegex.test(email.trim()));

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    if (!isValidEmail) return;

    processing = true;
    try {
      const { data: res } = await apiClient.post<ApiResponse>('/auth/invitations', {
        email: normalizedEmail
      });
      if (res.success) {
        toast.success(m.app_invite_sent({ email: normalizedEmail }));
        sheetStore.closeSheet();
      } else {
        toast.error(res.message || m.app_invite_error());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.app_invite_error());
    } finally {
      processing = false;
    }
  };
</script>

<form method="POST" action="javascript:" onsubmit={handleSubmit} class="space-y-6">
  <div class="space-y-2">
    <label for="invite-email" class="text-sm font-medium">{m.app_invite_form_email_label()}</label>
    <input
      id="invite-email"
      type="email"
      bind:value={email}
      placeholder={m.auth_email_placeholder()}
      autocomplete="email"
      class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
    />
    <p class="text-muted-foreground text-xs">{m.app_invite_form_email_help()}</p>
  </div>

  <SubmitButton type="submit" disabled={processing || !isValidEmail} class="w-full cursor-pointer">
    {m.app_invite_form_submit()}
  </SubmitButton>
</form>
