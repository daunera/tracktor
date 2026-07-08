import { env as publicEnv } from '$env/dynamic/public';
import { resolve } from '$app/paths';

/**
 * Client-side environment configuration
 * Only includes public environment variables that are safe to expose to the browser
 */
export const clientEnv = {
  DEMO_MODE: publicEnv.TRACKTOR_DEMO_MODE === 'true',
  DISABLE_AUTH: publicEnv.TRACKTOR_DISABLE_AUTH === 'true',
  DISABLE_PASSWORD_LOGIN: publicEnv.TRACKTOR_DISABLE_PASSWORD_LOGIN === 'true',
  DISABLE_GOOGLE_LOGIN: publicEnv.TRACKTOR_DISABLE_GOOGLE_LOGIN === 'true',
  BASE_URL: resolve('/')
} as const;

export const env = {
  ...clientEnv
} as const;

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const isTest = import.meta.env.MODE === 'test';
