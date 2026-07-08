import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// POST /api/auth/approve - Approve/reject/unblock a user (superadmin only)
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth approve POST error:', async () => {
    const currentUser = event.locals.user;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    // Check if user is admin
    if (authService.getEffectiveRole(currentUser) !== 'admin') {
      throw error(403, 'Only admins can manage users');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.userId) {
      throw error(400, 'userId is required');
    }

    if (!body.action) {
      throw error(400, 'action is required (approve, reject, or unblock)');
    }

    let result;
    const approverUsername = currentUser.username;

    switch (body.action) {
      case 'approve':
        result = await authService.approveUser(body.userId, approverUsername, currentUser.id);
        break;
      case 'reject':
        result = await authService.rejectUser(body.userId, approverUsername, currentUser.id);
        break;
      case 'unblock':
        result = await authService.unblockUser(body.userId, approverUsername, currentUser.id);
        break;
      default:
        throw error(400, 'Invalid action. Must be approve, reject, or unblock.');
    }

    return json(result);
  });
};
