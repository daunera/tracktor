import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as vehicleShareService from '$server/services/vehicleShareService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// POST /api/vehicles/[id]/transfer-ownership - Transfer vehicle ownership
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Transfer ownership POST error:', async () => {
    const { id } = event.params;
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!id) {
      throw error(400, 'Vehicle ID is required');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.newOwnerId) {
      throw error(400, 'newOwnerId is required');
    }

    const result = await vehicleShareService.transferOwnership(id, body.newOwnerId, user.id);
    return json(result);
  });
};
