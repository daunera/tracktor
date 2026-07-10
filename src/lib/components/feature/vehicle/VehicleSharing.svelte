<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import type { VehicleShareWithUser } from '$lib/domain/vehicle-share';
  import { toast } from 'svelte-sonner';
  import ResourceState from '$appui/ResourceState.svelte';
  import TableSkeleton from '$appui/TableSkeleton.svelte';
  import AppTable from '$layout/AppTable.svelte';
  import IconButton from '$appui/IconButton.svelte';
  import LabelWithIcon from '$appui/LabelWithIcon.svelte';
  import Button from '$ui/button/button.svelte';
  import User from '@lucide/svelte/icons/user';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
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
  let transferTarget = $state<VehicleShareWithUser | null>(null);
  let showTransferDialog = $state(false);
  let transferProcessing = $state(false);

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
        error = res.message || m.share_error_load();
      }
    } catch (err: any) {
      error = err.message || m.share_error_load();
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
        toast.error(res.message || m.share_error_remove());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.share_error_remove());
    } finally {
      showDeleteDialog = false;
      shareToRemove = null;
    }
  };

  const transferOwnership = async () => {
    const target = transferTarget;
    if (!target) return;
    const vid = getVehicleId();
    if (!vid) return;
    transferProcessing = true;
    try {
      const { data: res } = await apiClient.post<ApiResponse>(
        `/vehicles/${vid}/transfer-ownership`,
        { newOwnerId: target.userId }
      );
      if (res.success) {
        toast.success(m.share_toast_transferred());
        vehicleStore.shareRefreshKey++;
        vehicleStore.refreshVehicles();
      } else {
        toast.error(res.message || m.share_error_transfer());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.share_error_transfer());
    } finally {
      showTransferDialog = false;
      transferTarget = null;
      transferProcessing = false;
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
      cell: ({ row }) => renderSnippet(ActionButtons, { share: row.original })
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

{#if showTransferDialog && transferTarget}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div
      in:scale={{ duration: 500 }}
      class="flex max-h-[90vh] max-w-xl min-w-sm flex-col items-center justify-center overflow-y-auto rounded-lg bg-white p-8 shadow-2xl dark:bg-gray-800"
    >
      <span class="rounded-lg bg-amber-50 p-3">
        <ArrowLeftRight class="h-6 w-6 text-amber-600" />
      </span>
      <h3 class="mt-4 text-2xl text-black dark:text-white">
        {m.share_transfer_confirm_title()}
      </h3>
      <h5 class="text-muted-foreground mt-2 text-center text-sm">
        {m.share_transfer_confirm_message({
          user: transferTarget.name || transferTarget.username
        })}
      </h5>
      <div class="mt-8 flex w-full justify-around gap-4">
        <Button
          variant="secondary"
          type="button"
          onclick={() => {
            showTransferDialog = false;
            transferTarget = null;
          }}>{m.common_cancel()}</Button
        >
        <Button
          variant="default"
          type="button"
          onclick={transferOwnership}
          disabled={transferProcessing}>{m.common_confirm()}</Button
        >
      </div>
    </div>
  </div>
{/if}

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

{#snippet ActionButtons(params: { share: VehicleShareWithUser })}
  <div class="flex justify-end gap-1">
    <IconButton
      id="share-transfer-btn-{params.share.id}"
      buttonStyles="hover:bg-gray-200 dark:hover:bg-gray-700"
      iconStyles="text-gray-600 dark:text-gray-100 hover:text-amber-500"
      icon={ArrowLeftRight}
      onclick={() => {
        transferTarget = params.share;
        showTransferDialog = true;
      }}
      ariaLabel={m.share_transfer_ownership()}
    />
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
