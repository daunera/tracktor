import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import * as invitationService from '$server/services/invitationService';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// DELETE /api/auth/invitations/[id] - Cancel an app invitation (admin only)
export const DELETE: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth invitations DELETE error:', async () => {
    const currentUser = event.locals.user;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    if (authService.getEffectiveRole(currentUser) !== 'admin') {
      throw error(403, 'Only admins can cancel invitations');
    }

    const invitationId = event.params.id;

    if (!invitationId) {
      throw error(400, 'Invitation ID is required');
    }

    const result = await invitationService.cancelAppInvitation(invitationId, currentUser.id);

    return jsonResponse(result);
  });
};
