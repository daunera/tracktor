import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as invitationService from '$server/services/invitationService';
import { withRouteErrorHandling } from '$server/utils/route-handler';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { InvitationEmailLocale } from '$server/services/invitationEmailService';

// POST /api/invitations - Create an invitation for a vehicle
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Invitations POST error:', async () => {
    const user = event.locals.user;

    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.email) {
      throw error(400, 'email is required');
    }

    if (!body.vehicleId) {
      throw error(400, 'vehicleId is required');
    }

    if (!body.role || !['viewer', 'editor'].includes(body.role)) {
      throw error(400, 'role must be "viewer" or "editor"');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw error(400, 'Invalid email format');
    }

    const locale = getLocale() as InvitationEmailLocale;

    const result = await invitationService.createInvitation(
      body.email,
      body.vehicleId,
      body.role,
      user.id,
      locale
    );

    return json(result, { status: 201 });
  });
};
