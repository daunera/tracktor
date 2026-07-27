import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as vehicleShareService from '$server/services/vehicleShareService';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// GET /api/vehicles/[id]/shares/me - Get the current user's share for a vehicle
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Share me GET error:', async () => {
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const { id } = event.params;

    if (!id) {
      throw error(400, 'Vehicle ID is required');
    }

    const result = await vehicleShareService.getShareForUser(id, user.id);
    return jsonResponse(result);
  });
};
