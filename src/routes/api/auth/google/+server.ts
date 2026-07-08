import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { isGoogleLoginEnabled, getGoogleProvider } from '$server/services/googleOAuth';
import * as arctic from 'arctic';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// GET /api/auth/google - Initiate Google OAuth flow
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Google OAuth GET error:', async () => {
    if (!isGoogleLoginEnabled()) {
      throw error(400, 'Google login is disabled');
    }

    const google = getGoogleProvider();
    const state = arctic.generateState();
    const codeVerifier = arctic.generateCodeVerifier();
    const scopes = ['openid', 'profile', 'email'];
    const url = google.createAuthorizationURL(state, codeVerifier, scopes);

    // Store state and codeVerifier in cookies (10 min expiry)
    event.cookies.set('google_oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: false, // set to true in production with HTTPS
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    event.cookies.set('google_oauth_code_verifier', codeVerifier, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    // Redirect to Google's consent page
    throw redirect(302, url.toString());
  });
};
