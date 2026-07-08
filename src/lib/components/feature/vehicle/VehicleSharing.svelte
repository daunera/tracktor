<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import type { VehicleShareWithUser } from '$lib/domain/vehicle-share';
  import { toast } from 'svelte-sonner';
  import ResourceState from '$appui/ResourceState.svelte';
  import TableSkeleton from '$appui/TableSkeleton.svelte';
  import AppTable from '$layout/AppTable.svelte';
  import IconButton from '$appui/IconButton.svelte';
  import LabelWithIcon from '$appui/LabelWithIcon.svelte';
  import User from '@lucide/svelte/icons/user';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import DeleteConfirmation from '$appui/DeleteConfirmation.svelte';
  import { renderComponent, renderSnippet } from '$ui/data-table';
  import type { ColumnDef } from '@tanstack/table-core';
  import * as m from '$lib/paraglide/messages';
  import { vehicleStore } from '$stores/vehicle.svelte';

  let shares = $state<VehicleShareWithUser[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let lastVehicleId = $state<string | undefined>();
  let shareToRemove = $state<VehicleShareWithUser | null>(null);
  let showDeleteDialog = $state(false);

  $effect(() => {
    const vid = vehicleStore.selectedId;
    if (vid && vid !== lastVehicleId) {
      lastVehicleId = vid;
      loadShares();
    }
  });

  $effect(() => {
    const key = vehicleStore.shareRefreshKey;
    if (key > 0 && lastVehicleId) {
      loadShares();
    }
  });

  onMount(() => {
    if (vehicleStore.selectedId) loadShares();
  });

  const getVehicleId = () => vehicleStore.selectedId;

  const loadShares = async () => {
    const vid = getVehicleId();
    if (!vid) return;
    loading = true;
    error = null;
    try {
      const { data: res } = await apiClient.get<ApiResponse>(`/vehicles/${vid}/shares`);
      if (res.success && Array.isArray(res.data)) {
        shares = res.data as VehicleShareWithUser[];
      } else {
        error = res.message || 'Failed to load shares';
      }
    } catch (err: any) {
      error = err.message || 'Failed to load shares';
    } finally {
      loading = false;
    }
  };

  const removeShare = async () => {
    const share = shareToRemove;
    if (!share) return;
    const vid = getVehicleId();
    if (!vid) return;
    try {
      const { data: res } = await apiClient.delete<ApiResponse>(
        `/vehicles/${vid}/shares/${share.id}`
      );
      if (res.success) {
        toast.success(m.share_toast_removed());
        vehicleStore.shareRefreshKey++;
      } else {
        toast.error(res.message || 'Failed to remove share');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to remove share');
    } finally {
      showDeleteDialog = false;
      shareToRemove = null;
    }
  };

  const columns: ColumnDef<VehicleShareWithUser>[] = [
    {
      accessorKey: 'username',
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: User,
          iconClass: 'h-4 w-4',
          label: m.share_col_user(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(userCell, { share: row.original })
    },
    {
      id: 'actions',
      cell: ({ row }) => renderSnippet(DeleteButton, { share: row.original })
    }
  ];
</script>

{#if loading}
  <TableSkeleton containerId="sharing-list-skeleton" />
{:else if error}
  <ResourceState state="error" message={error} />
{:else if shares.length === 0}
  <ResourceState state="empty" message={m.share_list_empty()} />
{:else}
  <AppTable data={shares} {columns} />
{/if}

<DeleteConfirmation onConfirm={removeShare} bind:open={showDeleteDialog} />

{#snippet userCell(params: { share: VehicleShareWithUser })}
  <div class="flex items-center gap-3">
    <div
      class="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
    >
      {(params.share.name || params.share.username)[0]?.toUpperCase() || '?'}
    </div>
    <div>
      <p class="text-sm font-medium">{params.share.name || params.share.username}</p>
      {#if params.share.name}
        <p class="text-muted-foreground text-xs">@{params.share.username}</p>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet DeleteButton(params: { share: VehicleShareWithUser })}
  <div class="flex justify-end">
    <IconButton
      id="share-remove-btn-{params.share.id}"
      buttonStyles="hover:bg-gray-200 dark:hover:bg-gray-700"
      iconStyles="text-gray-600 dark:text-gray-100 hover:text-red-500"
      icon={Trash2}
      onclick={() => {
        shareToRemove = params.share;
        showDeleteDialog = true;
      }}
      ariaLabel={m.share_menu_delete()}
    />
  </div>
{/snippet}
