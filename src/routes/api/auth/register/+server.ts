import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { isHttps } from '$lib/config/env.server';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// POST /api/auth/register - Register a new user
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Register POST error:', async () => {
    const body = await event.request.json();

    // Validate request body
    if (!body.username || !body.password || !body.email) {
      throw error(400, 'Username, email, and password are required');
    }

    // Basic validation
    if (body.username.length < 3) {
      throw error(400, 'Username must be at least 3 characters long');
    }

    if (body.password.length < 6) {
      throw error(400, 'Password must be at least 6 characters long');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw error(400, 'Invalid email format');
    }

    const result = await authService.createUser(body.username, body.password, body.email);

    // Set session cookie so the user is logged in
    if (result.data?.sessionToken) {
      event.cookies.set('session', result.data.sessionToken, {
        path: '/',
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    return jsonResponse(result, undefined, { status: 201 });
  });
};
