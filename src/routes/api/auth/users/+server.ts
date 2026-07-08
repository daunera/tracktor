import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// GET /api/auth/users - List all users (superadmin only)
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth users GET error:', async () => {
    const currentUser = event.locals.user;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    // Check if user is admin
    if (authService.getEffectiveRole(currentUser) !== 'admin') {
      throw error(403, 'Only admins can access this endpoint');
    }

    const url = new URL(event.request.url);
    const statusFilter = url.searchParams.get('status') || undefined;

    const result = await authService.getUsers(statusFilter);
    return json(result);
  });
};
