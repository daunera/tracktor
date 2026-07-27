import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as vehicleShareService from '$server/services/vehicleShareService';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// PUT /api/vehicles/[id]/shares/[shareId] - Update share role
export const PUT: RequestHandler = async (event) => {
  return withRouteErrorHandling('Share PUT error:', async () => {
    const { shareId } = event.params;
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!shareId) {
      throw error(400, 'Share ID is required');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.role || !['viewer', 'editor'].includes(body.role)) {
      throw error(400, 'role must be "viewer" or "editor"');
    }

    const result = await vehicleShareService.updateShareRole(shareId, body.role, user.id);
    return jsonResponse(result);
  });
};

// DELETE /api/vehicles/[id]/shares/[shareId] - Remove share
export const DELETE: RequestHandler = async (event) => {
  return withRouteErrorHandling('Share DELETE error:', async () => {
    const { shareId } = event.params;
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    if (!shareId) {
      throw error(400, 'Share ID is required');
    }

    const result = await vehicleShareService.removeShare(shareId, user.id);
    return jsonResponse(result);
  });
};
