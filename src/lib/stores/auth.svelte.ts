import { goto } from '$app/navigation';
import { env } from '$lib/config/env';
import { apiClient } from '../helper/api.helper';
import type { ApiResponse } from '../response';
import { toast } from 'svelte-sonner';
import * as m from '$lib/paraglide/messages';

interface User {
  id: string;
  username: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  authProvider?: string;
  status?: string;
  role?: string;
}

class AuthStore {
  user = $state<User | null>(null);
  isLoggedIn = $state<boolean>(false);
  hasUsers = $state<boolean>(false);
  isAuthDisabled = $state<boolean>(env.DISABLE_AUTH);
  passwordLoginEnabled = $state<boolean>(true);
  googleLoginEnabled = $state<boolean>(false);
  blockedReason = $state<string | null>(null);

  constructor() {
    this.isLoggedIn = env.DISABLE_AUTH;
    this.hasUsers = env.DISABLE_AUTH;
  }

  get isAdmin(): boolean {
    if (this.isAuthDisabled) return true;
    return this.user?.role === 'admin';
  }

  checkAuthStatus = async () => {
    if (this.isAuthDisabled) {
      this.isLoggedIn = true;
      this.hasUsers = true;
      return;
    }

    try {
      const { data: res } = await apiClient.get<ApiResponse>('/auth', {
        skipInterceptors: true
      });
      this.isAuthDisabled = !!res.data?.isAuthDisabled;
      this.hasUsers = res.data?.hasUsers ?? false;
      this.passwordLoginEnabled = res.data?.passwordLoginEnabled !== false;
      this.googleLoginEnabled = res.data?.googleLoginEnabled === true;

      if (this.isAuthDisabled) {
        this.isLoggedIn = true;
        this.hasUsers = true;
        return;
      }

      // Detect rejected/blocked status
      if (res.data?.reason === 'rejected') {
        this.blockedReason = res.data.message || m.auth_account_blocked();
        this.user = null;
        this.isLoggedIn = false;
        return;
      }

      if (res.data.isAuthenticated && res.data.user) {
        this.user = res.data.user;
        this.isLoggedIn = true;
      } else {
        this.user = null;
        this.isLoggedIn = false;
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.hasUsers = false;
      this.user = null;
      this.isLoggedIn = this.isAuthDisabled;
    }
  };

  login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; errorMessage?: string }> => {
    try {
      const { data: res } = await apiClient.post<ApiResponse>(
        '/auth',
        { username, password },
        { skipInterceptors: true }
      );

      if (res.success && res.data) {
        this.user = res.data.user;
        this.isLoggedIn = true;
        toast.success(m.auth_login_success());
        return { success: true };
      }
      return { success: false };
    } catch (err: any) {
      this.user = null;
      this.isLoggedIn = false;
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || err.message || m.auth_login_failed();
      return { success: false, errorMessage };
    }
  };

  googleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  register = async (
    username: string,
    password: string,
    email: string
  ): Promise<{ success: boolean; autoApproved?: boolean }> => {
    try {
      const { data: res } = await apiClient.post<ApiResponse>(
        '/auth/register',
        {
          username,
          password,
          email
        },
        { skipInterceptors: true }
      );

      if (res.success) {
        toast.success(m.auth_register_success());
        this.hasUsers = true;
        const autoApproved = !!(res.data as any)?.autoApproved;
        return { success: true, autoApproved };
      }
      return { success: false };
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(
        `${m.auth_register_failed_prefix()}${err.response?.data?.message || err.message}`
      );
      return { success: false };
    }
  };

  logout = async () => {
    try {
      await apiClient.delete('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.user = null;
      this.isLoggedIn = false;
      goto('/login');
    }
  };

  updateProfile = async (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    try {
      const { data: res } = await apiClient.put<ApiResponse>('/auth/profile', data);

      if (res.success) {
        // Update local user state with returned data
        if (this.user) {
          if (data.name !== undefined) this.user.name = data.name;
          if (data.email !== undefined) this.user.email = data.email;
        }
        toast.success(m.profile_update_success());
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Profile update error:', err);
      toast.error(
        `${m.profile_update_failed_prefix()}${err.response?.data?.message || err.message}`
      );
      return false;
    }
  };
}

export const authStore = new AuthStore();
