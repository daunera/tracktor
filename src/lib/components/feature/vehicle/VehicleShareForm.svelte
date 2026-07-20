<script lang="ts">
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import { toast } from 'svelte-sonner';
  import { sheetStore } from '$stores/sheet.svelte';
  import { vehicleStore } from '$stores/vehicle.svelte';
  import SubmitButton from '$appui/SubmitButton.svelte';
  import * as m from '$lib/paraglide/messages';

  let vehicleId = $derived(vehicleStore.selectedId);

  let email = $state('');
  let processing = $state(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let isValidEmail = $derived(emailRegex.test(email.trim()));

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    if (!vehicleId || !isValidEmail) return;

    processing = true;
    try {
      const { data: res } = await apiClient.post<ApiResponse>('/invitations', {
        email: normalizedEmail,
        vehicleId,
        role: 'editor'
      });
      if (res.success) {
        toast.success(m.share_invite_sent({ email: normalizedEmail }));
        vehicleStore.shareRefreshKey++;
        sheetStore.closeSheet();
      } else {
        toast.error(res.message || m.share_error_share());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.share_error_operation());
    } finally {
      processing = false;
    }
  };
</script>

<form method="POST" action="javascript:" onsubmit={handleSubmit} class="space-y-6">
  <div class="bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-xs" role="note">
    {m.share_google_email_warning()}
  </div>

  <div class="space-y-2">
    <label for="share-email" class="text-sm font-medium">{m.share_form_email_label()}</label>
    <input
      id="share-email"
      type="email"
      bind:value={email}
      placeholder={m.share_search_placeholder()}
      autocomplete="email"
      class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
    />
    <p class="text-muted-foreground text-xs">{m.share_form_email_help()}</p>
  </div>

  <SubmitButton type="submit" disabled={processing || !isValidEmail} class="w-full cursor-pointer">
    {m.share_form_submit_add()}
  </SubmitButton>
</form>
