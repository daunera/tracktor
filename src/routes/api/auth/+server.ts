import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { env, isHttps } from '$lib/config/env.server';
import { isGoogleLoginEnabled, isPasswordLoginEnabled } from '$server/services/googleOAuth';
import { jsonResponse, withRouteErrorHandling } from '$server/utils/route-handler';

// POST /api/auth - Login with username/password
export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth POST error:', async () => {
    if (env.DISABLE_PASSWORD_LOGIN) {
      throw error(400, 'Password login is disabled');
    }

    const body = event.locals.requestBody || (await event.request.json());

    // Validate request body
    if (!body.username || !body.password) {
      throw error(400, 'Username and password are required');
    }

    const result = await authService.loginUser(body.username, body.password);

    // Set session cookie
    const loginData = result.data as { sessionToken?: string } | undefined;
    if (loginData?.sessionToken) {
      event.cookies.set('session', loginData.sessionToken, {
        path: '/',
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    return jsonResponse(result);
  });
};

// GET /api/auth - Get authentication status and validate session
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth GET error:', async () => {
    const result = await authService.getUsersCount();
    const isAuthDisabled = env.DISABLE_AUTH;
    const passwordLoginEnabled = isPasswordLoginEnabled();
    const googleLoginEnabled = isGoogleLoginEnabled();

    // Check if user has a valid session
    const sessionToken = event.cookies.get('session');
    let user = null;

    if (sessionToken) {
      try {
        const sessionResult = await authService.validateSession(sessionToken);
        if (sessionResult.user?.status === 'rejected') {
          // User has been rejected/blocked — don't treat as authenticated
          return jsonResponse({
            ...result,
            isAuthDisabled,
            passwordLoginEnabled,
            googleLoginEnabled,
            user: null,
            isAuthenticated: false,
            reason: 'rejected',
            message:
              'Your account has been blocked by an administrator. Please contact the system administrator.'
          });
        }
        user = sessionResult.user;
      } catch (err) {
        // Session is invalid, but don't throw error - just return null user
        console.error('Invalid session during auth check:', err);
      }
    }

    return jsonResponse({
      ...result,
      isAuthDisabled,
      passwordLoginEnabled,
      googleLoginEnabled,
      user,
      isAuthenticated: isAuthDisabled || !!user
    });
  });
};

// DELETE /api/auth - Logout
export const DELETE: RequestHandler = async (event) => {
  return withRouteErrorHandling('Auth DELETE error:', async () => {
    const sessionToken = event.cookies.get('session');

    if (sessionToken) {
      // Get session ID from token for logout
      const { validateSessionToken } = await import('$server/utils/session');
      const { session } = await validateSessionToken(sessionToken);

      if (session) {
        await authService.logoutUser(session.id);
      }
    }

    // Clear session cookie with proper options
    event.cookies.set('session', '', {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    });

    return jsonResponse(undefined, 'Logout successful');
  });
};
