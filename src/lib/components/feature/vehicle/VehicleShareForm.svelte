<script lang="ts">
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import { toast } from 'svelte-sonner';
  import { sheetStore } from '$stores/sheet.svelte';
  import { vehicleStore } from '$stores/vehicle.svelte';
  import SubmitButton from '$appui/SubmitButton.svelte';
  import * as m from '$lib/paraglide/messages';

  let vehicleId = $derived(vehicleStore.selectedId);

  let searchQuery = $state('');
  let searchResults = $state<{ id: string; username: string; name: string | null }[]>([]);
  let searching = $state(false);
  let selectedUserId = $state('');
  let selectedUserLabel = $state('');
  let processing = $state(false);

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      const { data: res } = await apiClient.get<ApiResponse>(
        `/users/search?q=${encodeURIComponent(query)}`
      );
      if (res.success && Array.isArray(res.data)) {
        searchResults = res.data as { id: string; username: string; name: string | null }[];
      }
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  };

  const selectUser = (user: { id: string; username: string; name: string | null }) => {
    selectedUserId = user.id;
    selectedUserLabel = user.name || user.username;
    searchQuery = '';
    searchResults = [];
  };

  const handleSubmit = async () => {
    if (!vehicleId || !selectedUserId) return;
    processing = true;
    try {
      const { data: res } = await apiClient.post<ApiResponse>(`/vehicles/${vehicleId}/shares`, {
        userId: selectedUserId,
        role: 'editor'
      });
      if (res.success) {
        toast.success(m.share_toast_added());
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
  <div class="space-y-2">
    <label for="share-user-search" class="text-sm font-medium">{m.share_form_search_user()}</label>
    {#if selectedUserId}
      <div
        class="border-input flex items-center justify-between rounded-md border px-3 py-2 text-sm"
      >
        <span class="font-medium">{selectedUserLabel}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground text-xs underline"
          onclick={() => {
            selectedUserId = '';
            selectedUserLabel = '';
          }}
        >
          {m.share_change()}
        </button>
      </div>
    {:else}
      <input
        id="share-user-search"
        type="text"
        bind:value={searchQuery}
        oninput={() => searchUsers(searchQuery)}
        placeholder={m.share_form_search_placeholder()}
        class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      {#if searching}
        <p class="text-muted-foreground text-sm">{m.share_searching()}</p>
      {:else if searchResults.length > 0}
        <div class="border-border max-h-48 overflow-y-auto rounded-lg border">
          {#each searchResults as result (result.id)}
            <button
              type="button"
              onclick={() => selectUser(result)}
              class="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors"
            >
              <div
                class="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
              >
                {(result.name || result.username)[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <span class="font-medium">{result.name || result.username}</span>
                {#if result.name}
                  <span class="text-muted-foreground ml-1">(@{result.username})</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {:else if searchQuery.length >= 2}
        <p class="text-muted-foreground text-sm">{m.share_no_users()}</p>
      {/if}
    {/if}
  </div>

  <SubmitButton
    type="submit"
    disabled={processing || !selectedUserId}
    class="w-full cursor-pointer"
  >
    {m.share_form_submit_add()}
  </SubmitButton>
</form>
