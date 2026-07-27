import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import * as invitationService from '$server/services/invitationService';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { InvitationEmailLocale } from '$server/services/invitationEmailService';

// POST /api/auth/invitations - Create an app invitation (admin only)
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth invitations POST error:', async () => {
    const currentUser = event.locals.user;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    if (authService.getEffectiveRole(currentUser) !== 'admin') {
      throw error(403, 'Only admins can send invitations');
    }

    const body = event.locals.requestBody || (await event.request.json());

    if (!body.email) {
      throw error(400, 'Email is required');
    }

    const locale = getLocale() as InvitationEmailLocale;

    const result = await invitationService.createInvitation(
      body.email,
      null,
      null,
      currentUser.id,
      locale
    );

    return jsonResponse(result);
  });
};

// GET /api/auth/invitations - List pending app invitations (admin only)
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth invitations GET error:', async () => {
    const currentUser = event.locals.user;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    if (authService.getEffectiveRole(currentUser) !== 'admin') {
      throw error(403, 'Only admins can view invitations');
    }

    const invitations = await invitationService.getPendingAppInvitations();

    return json({
      success: true,
      data: invitations,
      message: 'Pending app invitations retrieved successfully'
    });
  });
};
