import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { isGoogleLoginEnabled, getGoogleProvider } from '$server/services/googleOAuth';
import { syncSuperadminRole } from '$server/services/authService';
import { env, isHttps } from '$lib/config/env.server';
import { db } from '$server/db/index';
import { usersTable } from '$server/db/schema/index';
import { eq } from 'drizzle-orm';
import { generateSessionToken, createSession } from '$server/utils/session';
import * as arctic from 'arctic';

function generateRandomSuffix(length: number = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// GET /api/auth/google/callback - Handle Google OAuth callback
export const GET: RequestHandler = async (event) => {
  if (!isGoogleLoginEnabled()) {
    throw error(400, 'Google login is disabled');
  }

  const url = new URL(event.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const storedState = event.cookies.get('google_oauth_state');
  const storedCodeVerifier = event.cookies.get('google_oauth_code_verifier');

  // Clear the OAuth cookies
  event.cookies.set('google_oauth_state', '', { path: '/', maxAge: 0 });
  event.cookies.set('google_oauth_code_verifier', '', { path: '/', maxAge: 0 });

  // Validate state and code
  if (!code || !storedState || state !== storedState || !storedCodeVerifier) {
    throw error(400, 'Invalid OAuth request. Please try again.');
  }

  const google = getGoogleProvider();

  let tokens: arctic.OAuth2Tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
  } catch (e) {
    if (e instanceof arctic.OAuth2RequestError) {
      throw error(400, 'Invalid authorization code. Please try again.');
    }
    throw error(500, 'Failed to authenticate with Google. Please try again.');
  }

  // Fetch user info from Google
  const accessToken = tokens.accessToken();
  const userinfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!userinfoResponse.ok) {
    throw error(500, 'Failed to fetch user info from Google.');
  }

  const googleUser = await userinfoResponse.json();
  const googleId = googleUser.sub as string;
  const email = googleUser.email as string;
  const name = googleUser.name as string;
  const picture = googleUser.picture as string;

  // Find or create user
  let userId: string;
  let userStatus: 'pending' | 'active' | 'rejected';

  // Check if user exists by googleId
  let existingUser = await db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(users.googleId, googleId)
  });

  if (existingUser) {
    // Existing Google user — refresh profile data
    userId = existingUser.id;
    userStatus = existingUser.status;
    await db
      .update(usersTable)
      .set({
        avatarUrl: picture,
        name,
        email
      })
      .where(eq(usersTable.id, userId));

    // Sync superadmin role on every login
    await syncSuperadminRole(existingUser);
  } else if (email) {
    // Check if user exists by email (account linking)
    existingUser = await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email)
    });

    if (existingUser) {
      // Link Google account to existing user
      userId = existingUser.id;
      userStatus = existingUser.status;
      await db
        .update(usersTable)
        .set({
          googleId,
          avatarUrl: picture,
          name: existingUser.name || name
        })
        .where(eq(usersTable.id, userId));

      // Sync superadmin role on every login
      await syncSuperadminRole(existingUser);
    } else {
      // Create new user
      const isSuperadmin = env.SUPERADMIN_EMAILS.split(',')
        .map((e) => e.trim().toLowerCase())
        .includes(email.toLowerCase());

      // Derive username from email prefix
      let baseUsername = email.split('@')[0].toLowerCase();
      let username = baseUsername;

      // Ensure username is unique
      while (
        await db.query.usersTable.findFirst({
          where: (users, { eq }) => eq(users.username, username)
        })
      ) {
        username = `${baseUsername}_${generateRandomSuffix(4)}`;
      }

      userId = crypto.randomUUID();
      userStatus = isSuperadmin ? 'active' : 'pending';
      const now = new Date().toISOString();

      await db.insert(usersTable).values({
        id: userId,
        username,
        email,
        name,
        avatarUrl: picture,
        googleId,
        authProvider: 'google',
        role: isSuperadmin ? 'admin' : 'user',
        status: userStatus,
        approvedBy: isSuperadmin ? 'system' : null,
        approvedAt: isSuperadmin ? now : null
      });
    }
  } else {
    throw error(400, 'Google account has no email. Cannot create user.');
  }

  // Create session for all non-rejected users (pending users need it too)
  const sessionToken = generateSessionToken();
  const session = await createSession(sessionToken, userId);

  event.cookies.set('session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  // Check user status
  if (userStatus === 'pending') {
    // Redirect to pending approval page (session lets them auto-redirect on approval)
    throw redirect(302, '/pending');
  }

  if (userStatus === 'rejected') {
    // Redirect to login page with rejection message
    throw redirect(
      302,
      '/login?reason=rejected&message=Your+account+has+been+blocked+by+an+administrator.'
    );
  }

  throw redirect(302, '/dashboard');
};
