import { Google } from 'arctic';
import { env } from '$lib/config/env.server';

let googleProvider: Google | null = null;

export function getGoogleProvider(): Google {
  if (!googleProvider) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
      );
    }

    const redirectUri = env.BASE_URL
      ? `${env.BASE_URL}/api/auth/google/callback`
      : 'http://localhost:5173/api/auth/google/callback';

    googleProvider = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  }
  return googleProvider;
}

export function isGoogleLoginEnabled(): boolean {
  return !env.DISABLE_GOOGLE_LOGIN && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

export function isPasswordLoginEnabled(): boolean {
  return !env.DISABLE_PASSWORD_LOGIN;
}
