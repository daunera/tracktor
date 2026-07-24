<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { authStore } from '$stores/auth.svelte';
  import { sheetStore } from '$stores/sheet.svelte';
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import type { PendingAppInvitationListItem } from '$lib/domain/invitation';
  import { Button } from '$lib/components/ui/button/index.js';
  import { toast } from 'svelte-sonner';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Shield from '@lucide/svelte/icons/shield';
  import Ban from '@lucide/svelte/icons/ban';
  import ArrowUp from '@lucide/svelte/icons/arrow-up-from-line';
  import ArrowDown from '@lucide/svelte/icons/arrow-down-from-line';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Mail from '@lucide/svelte/icons/mail';
  import * as m from '$lib/paraglide/messages';
  import AppInviteForm from './AppInviteForm.svelte';

  interface UserRecord {
    id: string;
    username: string;
    email: string | null;
    name: string | null;
    authProvider: string;
    status: string;
    role: string;
    isSuperadmin: boolean;
    createdAt: string;
  }

  let users = $state<UserRecord[]>([]);
  let pendingInvitations = $state<PendingAppInvitationListItem[]>([]);
  let loading = $state(true);
  let loadingInvitations = $state(true);
  let error = $state<string | null>(null);
  let statusFilter = $state<string>('');
  let invitationToCancel = $state<PendingAppInvitationListItem | null>(null);
  let showCancelInviteDialog = $state(false);

  onMount(async () => {
    await Promise.all([loadUsers(), loadPendingInvitations()]);
  });

  // Refresh when the sheet closes after an invitation was sent
  $effect(() => {
    if (!sheetStore.open) {
      loadPendingInvitations();
    }
  });

  const loadUsers = async () => {
    loading = true;
    error = null;
    try {
      const queryParam = statusFilter ? `?status=${statusFilter}` : '';
      const { data: res } = await apiClient.get<ApiResponse>(`/auth/users${queryParam}`);
      if (res.success && res.data) {
        const userList = Array.isArray(res.data) ? res.data : [res.data];
        users = userList as UserRecord[];
      } else {
        users = [];
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
      error = err.response?.data?.message || err.message || m.settings_users_error_load();
    } finally {
      loading = false;
    }
  };

  const loadPendingInvitations = async () => {
    loadingInvitations = true;
    try {
      const { data: res } = await apiClient.get<ApiResponse>('/auth/invitations');
      if (res.success && Array.isArray(res.data)) {
        pendingInvitations = res.data as PendingAppInvitationListItem[];
      } else {
        pendingInvitations = [];
      }
    } catch (err: any) {
      console.error('Error loading pending invitations:', err);
      pendingInvitations = [];
    } finally {
      loadingInvitations = false;
    }
  };

  const openInviteSheet = () => {
    sheetStore.openSheet(AppInviteForm, m.app_invite_title(), m.app_invite_description());
  };

  const handleAction = async (userId: string, action: 'approve' | 'reject' | 'unblock') => {
    try {
      const { data: res } = await apiClient.post<ApiResponse>('/auth/approve', {
        userId,
        action
      });
      if (res.success) {
        toast.success(
          action === 'approve'
            ? m.settings_users_toast_approved()
            : action === 'reject'
              ? m.settings_users_toast_rejected()
              : m.settings_users_toast_unblocked()
        );
        await loadUsers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.settings_users_error_action());
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const { data: res } = await apiClient.post<ApiResponse>('/auth/role', {
        userId,
        role: newRole
      });
      if (res.success) {
        toast.success(res.message || m.settings_users_toast_role_changed());
        await loadUsers();
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || err.message || m.settings_users_error_role_change()
      );
    }
  };

  const cancelAppInvitation = async () => {
    const invitation = invitationToCancel;
    if (!invitation) return;
    try {
      const { data: res } = await apiClient.delete<ApiResponse>(
        `/auth/invitations/${invitation.id}`
      );
      if (res.success) {
        toast.success(m.app_invite_cancelled());
        await loadPendingInvitations();
      } else {
        toast.error(res.message || m.app_invite_error());
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || m.app_invite_error());
    } finally {
      showCancelInviteDialog = false;
      invitationToCancel = null;
    }
  };

  const canBlock = (user: UserRecord): boolean => {
    if (user.id === authStore.user?.id) return false;
    if (user.isSuperadmin) return false;
    return true;
  };

  const canChangeRole = (user: UserRecord): boolean => {
    if (user.id === authStore.user?.id) return false;
    if (user.isSuperadmin) return false;
    return true;
  };
</script>

<div id="users-tab" class="h-full w-full">
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <span class="text-sm font-medium">{m.settings_users_status_filter()}</span>
    {#each [{ value: '', label: m.settings_users_filter_all() }, { value: 'pending', label: m.settings_users_filter_pending() }, { value: 'active', label: m.settings_users_filter_active() }, { value: 'rejected', label: m.settings_users_filter_rejected() }] as filter}
      <button
        type="button"
        onclick={() => {
          statusFilter = filter.value;
          loadUsers();
        }}
        class="rounded-full px-3 py-1 text-xs font-medium transition-colors {statusFilter ===
        filter.value
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
      >
        {filter.label}
      </button>
    {/each}
    <div class="ml-auto flex items-center gap-2">
      <Button variant="default" size="sm" onclick={openInviteSheet}>
        <Mail class="mr-1 h-4 w-4" />
        {m.settings_users_action_invite()}
      </Button>
      <Button variant="outline" size="sm" onclick={loadUsers}>
        {m.settings_users_refresh()}
      </Button>
    </div>
  </div>

  {#if loading}
    <p class="text-muted-foreground py-8 text-center">{m.settings_users_loading()}</p>
  {:else if error}
    <div class="bg-destructive/10 border-destructive/50 rounded-lg border p-4">
      <p class="text-destructive text-sm">{error}</p>
    </div>
  {:else if users.length === 0}
    <p class="text-muted-foreground py-8 text-center">
      {statusFilter
        ? m.settings_users_no_filtered({ status: statusFilter })
        : m.settings_users_no_users()}
    </p>
  {:else}
    <div class="border-border overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-muted/50">
            <th class="px-4 py-3 text-left font-medium">{m.settings_users_col_username()}</th>
            <th class="px-4 py-3 text-left font-medium">{m.settings_users_col_name()}</th>
            <th class="px-4 py-3 text-left font-medium">{m.settings_users_col_email()}</th>
            <th class="px-4 py-3 text-left font-medium">{m.settings_users_col_role()}</th>
            <th class="px-4 py-3 text-left font-medium">{m.settings_users_col_provider()}</th>
            <th class="px-4 py-3 text-left font-medium">{m.settings_users_col_status()}</th>
            <th class="hidden px-4 py-3 text-left font-medium sm:table-cell"
              >{m.settings_users_col_registered()}</th
            >
            <th class="px-4 py-3 text-right font-medium">{m.settings_users_col_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#each users as user (user.id)}
            <tr class="border-border border-t">
              <td class="px-4 py-3 font-medium">{user.username}</td>
              <td class="text-muted-foreground px-4 py-3">{user.name || '-'}</td>
              <td class="text-muted-foreground px-4 py-3">{user.email || '-'}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {user.isSuperadmin
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300 ring-inset dark:bg-amber-900 dark:text-amber-300'
                    : user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}"
                >
                  {user.isSuperadmin
                    ? m.settings_users_role_superadmin()
                    : user.role === 'admin'
                      ? m.settings_users_role_admin()
                      : m.settings_users_role_user()}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {user.authProvider ===
                  'google'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}"
                >
                  {user.authProvider === 'google'
                    ? m.settings_users_provider_google()
                    : m.settings_users_provider_password()}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {user.status ===
                  'active'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : user.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}"
                >
                  {user.status === 'active'
                    ? m.settings_users_status_active()
                    : user.status === 'pending'
                      ? m.settings_users_status_pending()
                      : m.settings_users_status_rejected()}
                </span>
              </td>
              <td class="text-muted-foreground hidden px-4 py-3 text-xs sm:table-cell">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  {#if user.status === 'pending'}
                    <Button
                      size="sm"
                      variant="default"
                      onclick={() => handleAction(user.id, 'approve')}
                      title={m.settings_users_action_approve()}
                    >
                      <Check class="h-4 w-4" />
                      <span class="hidden sm:inline">{m.settings_users_action_approve()}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canBlock(user)}
                      onclick={() => handleAction(user.id, 'reject')}
                      title={canBlock(user)
                        ? m.settings_users_action_reject()
                        : m.settings_users_cannot_reject()}
                    >
                      <X class="h-4 w-4" />
                      <span class="hidden sm:inline">{m.settings_users_action_reject()}</span>
                    </Button>
                  {:else if user.status === 'active'}
                    {#if user.role === 'admin'}
                      {#if canChangeRole(user)}
                        <Button
                          size="sm"
                          variant="outline"
                          onclick={() => handleRoleChange(user.id, 'user')}
                          title={m.settings_users_action_demote()}
                        >
                          <ArrowDown class="h-4 w-4" />
                          <span class="hidden sm:inline">{m.settings_users_action_demote()}</span>
                        </Button>
                      {/if}
                    {:else if canChangeRole(user)}
                      <Button
                        size="sm"
                        variant="outline"
                        onclick={() => handleRoleChange(user.id, 'admin')}
                        title={m.settings_users_action_promote()}
                      >
                        <ArrowUp class="h-4 w-4" />
                        <span class="hidden sm:inline">{m.settings_users_action_promote()}</span>
                      </Button>
                    {/if}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canBlock(user)}
                      onclick={() => handleAction(user.id, 'reject')}
                      title={canBlock(user)
                        ? m.settings_users_action_block()
                        : m.settings_users_cannot_block()}
                    >
                      <Ban class="h-4 w-4" />
                      <span class="hidden sm:inline">{m.settings_users_action_block()}</span>
                    </Button>
                  {:else if user.status === 'rejected'}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canBlock(user)}
                      onclick={() => handleAction(user.id, 'unblock')}
                      title={canBlock(user)
                        ? m.settings_users_action_unblock()
                        : m.settings_users_cannot_unblock()}
                    >
                      <Shield class="h-4 w-4" />
                      <span class="hidden sm:inline">{m.settings_users_action_unblock()}</span>
                    </Button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Pending App Invitations Section -->
  <div class="mt-8">
    <h3 class="mb-3 text-lg font-semibold">{m.app_invite_pending_title()}</h3>
    {#if loadingInvitations}
      <p class="text-muted-foreground py-4 text-center">{m.settings_users_loading()}</p>
    {:else if pendingInvitations.length === 0}
      <p class="text-muted-foreground py-4 text-center">{m.share_list_empty()}</p>
    {:else}
      <div class="border-border overflow-x-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-muted/50">
              <th class="px-4 py-3 text-left font-medium">{m.app_invite_col_email()}</th>
              <th class="px-4 py-3 text-left font-medium">{m.app_invite_col_invited_by()}</th>
              <th class="px-4 py-3 text-left font-medium">{m.app_invite_col_date()}</th>
              <th class="px-4 py-3 text-right font-medium">{m.settings_users_col_actions()}</th>
            </tr>
          </thead>
          <tbody>
            {#each pendingInvitations as invitation (invitation.id)}
              <tr class="border-border border-t">
                <td class="px-4 py-3 font-medium">{invitation.email}</td>
                <td class="text-muted-foreground px-4 py-3">
                  {invitation.invitedByName || invitation.invitedByUsername}
                </td>
                <td class="text-muted-foreground px-4 py-3">
                  {invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString() : '-'}
                </td>
                <td class="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="destructive"
                    onclick={() => {
                      invitationToCancel = invitation;
                      showCancelInviteDialog = true;
                    }}
                    title={m.share_menu_delete()}
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

{#if showCancelInviteDialog && invitationToCancel}
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
        {m.app_invite_confirm_delete({ email: invitationToCancel.email })}
      </p>
      <div class="mt-8 flex w-full justify-around gap-4">
        <Button variant="secondary" type="button" onclick={() => (showCancelInviteDialog = false)}>
          {m.common_cancel()}
        </Button>
        <Button variant="destructive" type="button" onclick={cancelAppInvitation}>
          {m.common_confirm()}
        </Button>
      </div>
    </div>
  </div>
{/if}
