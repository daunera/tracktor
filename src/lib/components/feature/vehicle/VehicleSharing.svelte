<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import type { VehicleShareWithUser } from '$lib/domain/vehicle-share';
  import type { PendingInvitationListItem } from '$lib/domain/invitation';
  import { toast } from 'svelte-sonner';
  import ResourceState from '$appui/ResourceState.svelte';
  import TableSkeleton from '$appui/TableSkeleton.svelte';
  import AppTable from '$layout/AppTable.svelte';
  import IconButton from '$appui/IconButton.svelte';
  import LabelWithIcon from '$appui/LabelWithIcon.svelte';
  import Button from '$ui/button/button.svelte';
  import Badge from '$ui/badge/badge.svelte';
  import User from '@lucide/svelte/icons/user';
  import Mail from '@lucide/svelte/icons/mail';
  import IdCard from '@lucide/svelte/icons/id-card';
  import Shield from '@lucide/svelte/icons/shield';
  import Clock from '@lucide/svelte/icons/clock';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
  import DeleteConfirmation from '$appui/DeleteConfirmation.svelte';
  import { formatTableText } from '$helper/table-cell.helper';
  import { renderComponent, renderSnippet } from '$ui/data-table';
  import type { ColumnDef } from '@tanstack/table-core';
  import * as m from '$lib/paraglide/messages';
  import { vehicleStore } from '$stores/vehicle.svelte';

  let shares = $state<VehicleShareWithUser[]>([]);
  let pendingInvitations = $state<PendingInvitationListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let lastVehicleId = $state<string | undefined>();
  let shareToRemove = $state<VehicleShareWithUser | null>(null);
  let invitationToCancel = $state<PendingInvitationListItem | null>(null);
  let showDeleteDialog = $state(false);
  let showCancelInviteDialog = $state(false);
  let transferTarget = $state<VehicleShareWithUser | null>(null);
  let showTransferDialog = $state(false);
  let transferProcessing = $state(false);

  const roleLabel = (role: 'viewer' | 'editor') =>
    role === 'editor' ? m.share_form_role_editor() : m.share_form_role_viewer();

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
      const [sharesRes, invitationsRes] = await Promise.all([
        apiClient.get<ApiResponse>(`/vehicles/${vid}/shares`),
        apiClient.get<ApiResponse>(`/vehicles/${vid}/invitations`)
      ]);

      if (sharesRes.data.success && Array.isArray(sharesRes.data.data)) {
        shares = sharesRes.data.data as VehicleShareWithUser[];
      } else {
        error = sharesRes.data.message || m.share_error_load();
        return;
      }

      if (invitationsRes.data.success && Array.isArray(invitationsRes.data.data)) {
        pendingInvitations = invitationsRes.data.data as PendingInvitationListItem[];
      } else {
        pendingInvitations = [];
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

  const cancelInvitation = async () => {
    const invitation = invitationToCancel;
    if (!invitation) return;
    const vid = getVehicleId();
    if (!vid) return;
    try {
      const { data: res } = await apiClient.delete<ApiResponse>(
        `/vehicles/${vid}/invitations/${invitation.id}`
      );
      if (res.success) {
        toast.success(m.share_invite_cancelled());
        vehicleStore.shareRefreshKey++;
      } else {
        toast.error(res.message || m.share_error_cancel_invite());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.share_error_cancel_invite());
    } finally {
      showCancelInviteDialog = false;
      invitationToCancel = null;
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
      id: 'user',
      accessorKey: 'username',
      enableHiding: false,
      meta: { className: 'lg:hidden' },
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
      accessorKey: 'name',
      meta: { className: 'hidden lg:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: IdCard,
          iconClass: 'h-4 w-4',
          label: m.settings_users_col_name(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(textCell, { value: row.original.name })
    },
    {
      accessorKey: 'username',
      meta: { className: 'hidden lg:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: User,
          iconClass: 'h-4 w-4',
          label: m.settings_users_col_username(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(textCell, { value: row.original.username })
    },
    {
      accessorKey: 'email',
      meta: { className: 'hidden md:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: Mail,
          iconClass: 'h-4 w-4',
          label: m.share_col_email(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(textCell, { value: row.original.email })
    },
    {
      accessorKey: 'role',
      meta: { className: 'hidden md:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: Shield,
          iconClass: 'h-4 w-4',
          label: m.share_col_role(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(roleCell, { role: row.original.role })
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => renderSnippet(ActionButtons, { share: row.original })
    }
  ];

  const pendingColumns: ColumnDef<PendingInvitationListItem>[] = [
    {
      id: 'pending-summary',
      accessorKey: 'email',
      enableHiding: false,
      meta: { className: 'lg:hidden' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: Mail,
          iconClass: 'h-4 w-4',
          label: m.share_col_email(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(pendingSummaryCell, { invitation: row.original })
    },
    {
      accessorKey: 'name',
      meta: { className: 'hidden lg:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: IdCard,
          iconClass: 'h-4 w-4',
          label: m.settings_users_col_name(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(textCell, { value: row.original.name })
    },
    {
      accessorKey: 'username',
      meta: { className: 'hidden lg:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: User,
          iconClass: 'h-4 w-4',
          label: m.settings_users_col_username(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(textCell, { value: row.original.username })
    },
    {
      accessorKey: 'email',
      meta: { className: 'hidden lg:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: Mail,
          iconClass: 'h-4 w-4',
          label: m.share_col_email(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(textCell, { value: row.original.email })
    },
    {
      accessorKey: 'role',
      meta: { className: 'hidden md:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: Shield,
          iconClass: 'h-4 w-4',
          label: m.share_col_role(),
          style: 'justify-start'
        }),
      cell: ({ row }) => renderSnippet(roleCell, { role: row.original.role })
    },
    {
      id: 'status',
      meta: { className: 'hidden md:table-cell' },
      header: () =>
        renderComponent(LabelWithIcon, {
          icon: Clock,
          iconClass: 'h-4 w-4',
          label: m.settings_users_col_status(),
          style: 'justify-start'
        }),
      cell: () => renderSnippet(statusCell)
    },
    {
      id: 'pending-actions',
      enableHiding: false,
      cell: ({ row }) => renderSnippet(PendingActionButtons, { invitation: row.original })
    }
  ];
</script>

{#if loading}
  <TableSkeleton containerId="sharing-list-skeleton" />
{:else if error}
  <ResourceState state="error" message={error} />
{:else if shares.length === 0 && pendingInvitations.length === 0}
  <ResourceState state="empty" message={m.share_list_empty()} />
{:else}
  {#if shares.length > 0}
    <AppTable data={shares} {columns} />
  {/if}

  {#if pendingInvitations.length > 0}
    <div class="mt-8 space-y-3">
      <h3 class="text-lg font-semibold">{m.share_pending_title()}</h3>
      <AppTable data={pendingInvitations} columns={pendingColumns} />
    </div>
  {/if}
{/if}

<DeleteConfirmation onConfirm={removeShare} bind:open={showDeleteDialog} />

{#if showCancelInviteDialog}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div
      in:scale={{ duration: 500 }}
      class="dark:bg-card flex max-h-[90vh] w-[80vh] max-w-[400px] max-w-xl min-w-0 flex-col items-center justify-center overflow-y-auto rounded-lg bg-white p-8 shadow-2xl sm:w-auto sm:min-w-sm"
    >
      <h3 class="mt-4 text-2xl text-black dark:text-white">{m.share_menu_delete()}</h3>
      <p class="text-muted-foreground mt-2 text-center text-sm">
        {invitationToCancel?.email}
      </p>
      <div class="mt-8 flex w-full justify-around gap-4">
        <Button variant="secondary" type="button" onclick={() => (showCancelInviteDialog = false)}>
          {m.common_cancel()}
        </Button>
        <Button variant="destructive" type="button" onclick={cancelInvitation}>
          {m.common_confirm()}
        </Button>
      </div>
    </div>
  </div>
{/if}

{#if showTransferDialog && transferTarget}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div
      in:scale={{ duration: 500 }}
      class="dark:bg-card flex max-h-[90vh] w-[80vh] max-w-[400px] max-w-xl min-w-0 flex-col items-center justify-center overflow-y-auto rounded-lg bg-white p-8 shadow-2xl sm:w-auto sm:min-w-sm"
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
      class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
    >
      {(params.share.name || params.share.username)[0]?.toUpperCase() || '?'}
    </div>
    <div class="min-w-0">
      <p class="truncate text-sm font-medium">{params.share.name || params.share.username}</p>
      {#if params.share.name}
        <p class="text-muted-foreground truncate text-xs">@{params.share.username}</p>
      {/if}
      {#if params.share.email}
        <p class="text-muted-foreground truncate text-xs">{params.share.email}</p>
      {/if}
      <p class="text-muted-foreground mt-1 text-xs md:hidden">{roleLabel(params.share.role)}</p>
    </div>
  </div>
{/snippet}

{#snippet pendingSummaryCell(params: { invitation: PendingInvitationListItem })}
  <div class="space-y-1">
    <p class="text-sm font-medium">{params.invitation.email}</p>
    {#if params.invitation.name}
      <p class="text-muted-foreground text-xs">{params.invitation.name}</p>
    {/if}
    <div class="mt-1 flex flex-wrap items-center gap-2 md:hidden">
      <Badge variant="secondary">{m.share_status_pending()}</Badge>
      <span class="text-muted-foreground text-xs">{roleLabel(params.invitation.role)}</span>
    </div>
  </div>
{/snippet}

{#snippet textCell(params: { value: string | null | undefined })}
  <span class="text-sm">{formatTableText(params.value)}</span>
{/snippet}

{#snippet roleCell(params: { role: 'viewer' | 'editor' })}
  <span class="text-sm">{roleLabel(params.role)}</span>
{/snippet}

{#snippet statusCell()}
  <Badge variant="secondary">{m.share_status_pending()}</Badge>
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

{#snippet PendingActionButtons(params: { invitation: PendingInvitationListItem })}
  <div class="flex justify-end gap-1">
    <IconButton
      id="invite-cancel-btn-{params.invitation.id}"
      buttonStyles="hover:bg-gray-200 dark:hover:bg-gray-700"
      iconStyles="text-gray-600 dark:text-gray-100 hover:text-red-500"
      icon={Trash2}
      onclick={() => {
        invitationToCancel = params.invitation;
        showCancelInviteDialog = true;
      }}
      ariaLabel={m.share_menu_delete()}
    />
  </div>
{/snippet}
