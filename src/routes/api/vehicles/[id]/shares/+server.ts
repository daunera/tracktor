import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as vehicleShareService from '$server/services/vehicleShareService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// GET /api/vehicles/[id]/shares - List shares for a vehicle
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Shares GET error:', async () => {
    const { id } = event.params;

    if (!id) {
      throw error(400, 'Vehicle ID is required');
    }

    const result = await vehicleShareService.getSharesForVehicle(id);
    return json(result);
  });
};

// POST /api/vehicles/[id]/shares - Add a share
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Shares POST error:', async () => {
    const { id } = event.params;
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!id) {
      throw error(400, 'Vehicle ID is required');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.userId) {
      throw error(400, 'userId is required');
    }

    if (!body.role || !['viewer', 'editor'].includes(body.role)) {
      throw error(400, 'role must be "viewer" or "editor"');
    }

    const result = await vehicleShareService.addShare(id, body.userId, body.role, user.id);
    return json(result, { status: 201 });
  });
};
