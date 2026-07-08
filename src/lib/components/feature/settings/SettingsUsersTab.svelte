<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$stores/auth.svelte';
  import { apiClient } from '$lib/helper/api.helper';
  import type { ApiResponse } from '$lib/response';
  import { Button } from '$lib/components/ui/button/index.js';
  import { toast } from 'svelte-sonner';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Shield from '@lucide/svelte/icons/shield';
  import Ban from '@lucide/svelte/icons/ban';
  import ArrowUp from '@lucide/svelte/icons/arrow-up-from-line';
  import ArrowDown from '@lucide/svelte/icons/arrow-down-from-line';

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
  let loading = $state(true);
  let error = $state<string | null>(null);
  let statusFilter = $state<string>('');

  onMount(async () => {
    await loadUsers();
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
      error = err.response?.data?.message || err.message || 'Failed to load users';
    } finally {
      loading = false;
    }
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
            ? 'User approved'
            : action === 'reject'
              ? 'User rejected'
              : 'User unblocked'
        );
        await loadUsers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Action failed');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const { data: res } = await apiClient.post<ApiResponse>('/auth/role', {
        userId,
        role: newRole
      });
      if (res.success) {
        toast.success(res.message || 'Role changed successfully');
        await loadUsers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to change role');
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
    <span class="text-sm font-medium">Status filter:</span>
    {#each [{ value: '', label: 'All users' }, { value: 'pending', label: 'Pending' }, { value: 'active', label: 'Active' }, { value: 'rejected', label: 'Rejected' }] as filter}
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
    <Button variant="outline" size="sm" onclick={loadUsers} class="ml-auto">Refresh</Button>
  </div>

  {#if loading}
    <p class="text-muted-foreground py-8 text-center">Loading users...</p>
  {:else if error}
    <div class="bg-destructive/10 border-destructive/50 rounded-lg border p-4">
      <p class="text-destructive text-sm">{error}</p>
    </div>
  {:else if users.length === 0}
    <p class="text-muted-foreground py-8 text-center">
      {statusFilter ? `No ${statusFilter} users found.` : 'No users found.'}
    </p>
  {:else}
    <div class="border-border overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-muted/50">
            <th class="px-4 py-3 text-left font-medium">Username</th>
            <th class="px-4 py-3 text-left font-medium">Name</th>
            <th class="px-4 py-3 text-left font-medium">Email</th>
            <th class="px-4 py-3 text-left font-medium">Role</th>
            <th class="px-4 py-3 text-left font-medium">Provider</th>
            <th class="px-4 py-3 text-left font-medium">Status</th>
            <th class="hidden px-4 py-3 text-left font-medium sm:table-cell">Registered</th>
            <th class="px-4 py-3 text-right font-medium">Actions</th>
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
                  {user.isSuperadmin ? 'superadmin' : user.role}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {user.authProvider ===
                  'google'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}"
                >
                  {user.authProvider}
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
                  {user.status}
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
                      title="Approve"
                    >
                      <Check class="h-4 w-4" />
                      <span class="hidden sm:inline">Approve</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canBlock(user)}
                      onclick={() => handleAction(user.id, 'reject')}
                      title={canBlock(user) ? 'Reject' : 'Cannot reject yourself or a superadmin'}
                    >
                      <X class="h-4 w-4" />
                      <span class="hidden sm:inline">Reject</span>
                    </Button>
                  {:else if user.status === 'active'}
                    {#if user.role === 'admin'}
                      {#if canChangeRole(user)}
                        <Button
                          size="sm"
                          variant="outline"
                          onclick={() => handleRoleChange(user.id, 'user')}
                          title="Demote to user"
                        >
                          <ArrowDown class="h-4 w-4" />
                          <span class="hidden sm:inline">Demote</span>
                        </Button>
                      {/if}
                    {:else if canChangeRole(user)}
                      <Button
                        size="sm"
                        variant="outline"
                        onclick={() => handleRoleChange(user.id, 'admin')}
                        title="Promote to admin"
                      >
                        <ArrowUp class="h-4 w-4" />
                        <span class="hidden sm:inline">Promote</span>
                      </Button>
                    {/if}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canBlock(user)}
                      onclick={() => handleAction(user.id, 'reject')}
                      title={canBlock(user) ? 'Block' : 'Cannot block yourself or a superadmin'}
                    >
                      <Ban class="h-4 w-4" />
                      <span class="hidden sm:inline">Block</span>
                    </Button>
                  {:else if user.status === 'rejected'}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canBlock(user)}
                      onclick={() => handleAction(user.id, 'unblock')}
                      title={canBlock(user) ? 'Unblock' : 'Cannot unblock yourself or a superadmin'}
                    >
                      <Shield class="h-4 w-4" />
                      <span class="hidden sm:inline">Unblock</span>
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
</div>
