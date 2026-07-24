<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import type { VehicleShareForUser } from '$lib/domain/vehicle-share';
  import { toast } from 'svelte-sonner';
  import ResourceState from '$appui/ResourceState.svelte';
  import TableSkeleton from '$appui/TableSkeleton.svelte';
  import Button from '$ui/button/button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { vehicleStore } from '$stores/vehicle.svelte';

  let share = $state<VehicleShareForUser | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showLeaveDialog = $state(false);
  let leaving = $state(false);
  let lastVehicleId = $state<string | undefined>();

  const loadShare = async () => {
    const vehicleId = vehicleStore.selectedId;
    if (!vehicleId) return;

    loading = true;
    error = null;

    try {
      const { data: res } = await apiClient.get<ApiResponse>(`/vehicles/${vehicleId}/shares/me`);
      if (res.success && res.data) {
        share = res.data as VehicleShareForUser;
      } else {
        error = res.message || m.share_error_load_access();
      }
    } catch (err: any) {
      error = err.response?.data?.message || err.message || m.share_error_load_access();
    } finally {
      loading = false;
    }
  };

  const leaveShare = async () => {
    const vehicleId = vehicleStore.selectedId;
    if (!vehicleId || !share) return;

    leaving = true;
    try {
      const { data: res } = await apiClient.delete<ApiResponse>(
        `/vehicles/${vehicleId}/shares/${share.id}`
      );
      if (res.success) {
        toast.success(m.share_toast_left());
        vehicleStore.refreshVehicles();
      } else {
        toast.error(res.message || m.share_error_remove());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.share_error_remove());
    } finally {
      leaving = false;
      showLeaveDialog = false;
    }
  };

  $effect(() => {
    const vehicleId = vehicleStore.selectedId;
    if (vehicleId && vehicleId !== lastVehicleId) {
      lastVehicleId = vehicleId;
      loadShare();
    }
  });

  onMount(() => {
    if (vehicleStore.selectedId) loadShare();
  });
</script>

<div class="tab-container lg:bg-secondary rounded-md p-2 lg:p-4" role="tabpanel">
  <h2 class="mb-6 font-bold underline underline-offset-8 lg:text-2xl">{m.share_your_access()}</h2>

  {#if loading}
    <TableSkeleton containerId="shared-access-skeleton" />
  {:else if error}
    <ResourceState state="error" message={error} />
  {:else if share}
    <div class="space-y-4">
      <p class="text-muted-foreground text-sm">{m.share_your_access_description()}</p>
      <Button variant="destructive" onclick={() => (showLeaveDialog = true)} disabled={leaving}>
        {m.share_leave_access()}
      </Button>
    </div>
  {/if}
</div>

{#if showLeaveDialog}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div
      in:scale={{ duration: 500 }}
      class="dark:bg-card flex max-h-[90vh] w-[80vh] max-w-[400px] max-w-xl min-w-0 flex-col items-center justify-center overflow-y-auto rounded-lg bg-white p-8 shadow-2xl sm:w-auto sm:min-w-sm"
    >
      <h3 class="mt-4 text-2xl text-black dark:text-white">{m.share_leave_confirm_title()}</h3>
      <p class="text-muted-foreground mt-2 text-center text-sm">
        {m.share_leave_confirm_message()}
      </p>
      <div class="mt-8 flex w-full justify-around gap-4">
        <Button variant="secondary" type="button" onclick={() => (showLeaveDialog = false)}>
          {m.common_cancel()}
        </Button>
        <Button variant="destructive" type="button" onclick={leaveShare} disabled={leaving}>
          {m.common_confirm()}
        </Button>
      </div>
    </div>
  </div>
{/if}
