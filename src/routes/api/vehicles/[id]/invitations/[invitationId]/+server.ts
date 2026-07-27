import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as invitationService from '$server/services/invitationService';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// DELETE /api/vehicles/[id]/invitations/[invitationId] - Cancel a pending invitation
export const DELETE: RequestHandler = async (event) => {
  return withRouteErrorHandling('Vehicle invitation DELETE error:', async () => {
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id, invitationId } = event.params;

    if (!id) {
      throw error(400, 'Vehicle ID is required');
    }

    if (!invitationId) {
      throw error(400, 'Invitation ID is required');
    }

    const result = await invitationService.cancelInvitation(invitationId, id, user.id);
    return jsonResponse(result);
  });
};
