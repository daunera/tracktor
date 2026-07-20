import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as invitationService from '$server/services/invitationService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// GET /api/vehicles/[id]/invitations - List pending invitations for a vehicle
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Vehicle invitations GET error:', async () => {
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id } = event.params;

    if (!id) {
      throw error(400, 'Vehicle ID is required');
    }

    const result = await invitationService.getPendingInvitationsForVehicle(id, user.id);
    return json(result);
  });
};
