import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { MEGABYTE, parseSize } from '$ui/file-drop-zone';

/**
 * Client-side environment configuration
 * Only includes public environment variables that are safe to expose to the browser
 */
export const clientEnv = {
  DEMO_MODE: publicEnv.TRACKTOR_DEMO_MODE === 'true',
  // Allow disabling auth via either the public or private env var so it works in container deployments
  DISABLE_AUTH:
    publicEnv.TRACKTOR_DISABLE_AUTH === 'true' || privateEnv.TRACKTOR_DISABLE_AUTH === 'true',
  DISABLE_PASSWORD_LOGIN:
    publicEnv.TRACKTOR_DISABLE_PASSWORD_LOGIN === 'true' ||
    privateEnv.TRACKTOR_DISABLE_PASSWORD_LOGIN === 'true',
  DISABLE_GOOGLE_LOGIN:
    publicEnv.TRACKTOR_DISABLE_GOOGLE_LOGIN === 'true' ||
    privateEnv.TRACKTOR_DISABLE_GOOGLE_LOGIN === 'true'
} as const;

function getCorsOrigins(origins?: string): string[] {
  if (!origins) {
    return ['*'];
  }

  return origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getDBPath(): string | undefined {
  switch (privateEnv.NODE_ENV) {
    case 'development':
      return './tracktor.dev.db';
    case 'test':
      return './tracktor.test.db';
    case 'production':
    default:
      return './tracktor.db';
  }
}

/**
 * Server-side environment configuration
 * Includes all environment variables
 */
export const serverEnv = {
  NODE_ENV: privateEnv.NODE_ENV || 'dev',
  DB_PATH: privateEnv.DB_PATH || getDBPath(),
  UPLOADS_DIR: privateEnv.UPLOADS_DIR || './uploads',
  BODY_SIZE_LIMIT: privateEnv.BODY_SIZE_LIMIT
    ? parseSize(privateEnv.BODY_SIZE_LIMIT)
    : 10 * MEGABYTE,
  CORS_ORIGINS: getCorsOrigins(privateEnv.CORS_ORIGINS),
  FORCE_DATA_SEED: privateEnv.FORCE_DATA_SEED === 'true',
  LOG_REQUESTS: !privateEnv.LOG_REQUESTS || privateEnv.LOG_REQUESTS === 'true',
  LOG_LEVEL: privateEnv.LOG_LEVEL || 'info',
  LOG_DIR: privateEnv.LOG_DIR || './logs',
  APP_VERSION: privateEnv.APP_VERSION,
  BASE_URL: privateEnv.BASE_URL || '',
  APP_SECRET: privateEnv.APP_SECRET || '',
  GOOGLE_CLIENT_ID: privateEnv.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: privateEnv.GOOGLE_CLIENT_SECRET || '',
  SUPERADMIN_EMAILS: privateEnv.SUPERADMIN_EMAILS || '',
  SUPERADMIN_USERNAMES: privateEnv.SUPERADMIN_USERNAMES || ''
} as const;

/**
 * Universal environment configuration
 * Available on server
 */
export const env = {
  ...clientEnv,
  ...serverEnv
} as const;

// Environment helpers
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Whether the app is served over HTTPS, derived from BASE_URL. */
export const isHttps = env.BASE_URL.startsWith('https://');
