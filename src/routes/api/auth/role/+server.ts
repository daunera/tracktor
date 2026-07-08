import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// POST /api/auth/role - Change a user's role (promote/demote)
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth role POST error:', async () => {
    const currentUser = event.locals.user;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    // Check if user is admin
    if (authService.getEffectiveRole(currentUser) !== 'admin') {
      throw error(403, 'Only admins can change user roles');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.userId) {
      throw error(400, 'userId is required');
    }

    if (!body.role || !['admin', 'user'].includes(body.role)) {
      throw error(400, 'role must be "admin" or "user"');
    }

    const result = await authService.changeUserRole(body.userId, body.role, currentUser.id);
    return json(result);
  });
};
