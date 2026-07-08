import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// PUT /api/auth/profile - Update current user's profile (password)
export const PUT: RequestHandler = async (event) => {
  return withRouteErrorHandling('Profile PUT error:', async () => {
    // Get current user from session
    const sessionToken = event.cookies.get('session');
    if (!sessionToken) {
      throw error(401, 'Not authenticated');
    }

    const { user } = await authService.validateSession(sessionToken);
    if (!user) {
      throw error(401, 'Invalid session');
    }

    const body = event.locals.requestBody || (await event.request.json());

    // Validate request body
    if (!body.newPassword) {
      throw error(400, 'New password is required');
    }

    if (body.newPassword && body.newPassword.length < 6) {
      throw error(400, 'Password must be at least 6 characters long');
    }

    const result = await authService.updateUserProfile(user.id, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });

    return json(result);
  });
};
