import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// PUT /api/auth/profile - Update current user's profile (name, email, password)
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

    const body = await event.request.json();

    // Validate email format if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        throw error(400, 'Invalid email format');
      }
    }

    // Validate password
    if (body.newPassword && body.newPassword.length < 6) {
      throw error(400, 'Password must be at least 6 characters long');
    }

    const result = await authService.updateUserProfile(user.id, {
      name: body.name,
      email: body.email,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });

    return jsonResponse(result);
  });
};
