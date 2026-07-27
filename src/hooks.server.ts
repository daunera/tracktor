import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { defineCustomServerStrategy } from '$lib/paraglide/runtime';
import { eq } from 'drizzle-orm';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { createErrorResponseBody, logError } from './server/utils/errorHandler';

import {
  CorsMiddleware,
  RateLimitMiddleware,
  AuthMiddleware,
  LoggingMiddleware
} from '$server/middlewares';

import { MiddlewareChain } from '$server/middlewares/base';
import { db } from '$server/db/index';
import { configTable } from '$server/db/schema/config';
import { initializeDatabase } from '$server/db/init';
import { appAsciiArt, appVersion, logger } from '$server/config';
import { env } from '$lib/config/env.server';
import { ensureAppDirectories } from '$server/utils/fs';
import { initializeNotificationScheduler } from '$server/services/notificationSchedulerService';

const middlewareChain = new MiddlewareChain();
middlewareChain.init([
  new CorsMiddleware(),
  new AuthMiddleware(),
  new RateLimitMiddleware(),
  new LoggingMiddleware()
]);

/** Paraglide cookie name — matches what the generated runtime uses. */
const PARAGLIDE_COOKIE = 'PARAGLIDE_LOCALE';

/** Locale cache TTL — 60 s is fine since the global locale changes rarely. */
const LOCALE_CACHE_TTL = 60_000;

/* ---------- DB locale cache (avoids a query on every request) ---------- */

let cachedLocale: string | null = null;
let cachedLocaleAt = 0;

/**
 * Read the globally-configured locale from the `configs` table.
 * Returns `null` when no locale has been saved yet.
 */
async function getDbLocale(): Promise<string | null> {
  const now = Date.now();
  if (cachedLocale !== null && now - cachedLocaleAt < LOCALE_CACHE_TTL) {
    return cachedLocale;
  }
  try {
    const row = await db
      .select({ value: configTable.value })
      .from(configTable)
      .where(eq(configTable.key, 'locale'))
      .get();

    const value = row?.value ?? null;
    cachedLocale = value;
    cachedLocaleAt = now;
    return value;
  } catch {
    cachedLocale = null;
    cachedLocaleAt = now;
    return null;
  }
}

/* ------- Register a custom strategy so the DB locale is used during SSR ----- */

let strategyRegistered = false;

function ensureCustomStrategy() {
  if (strategyRegistered) return;
  defineCustomServerStrategy('custom-db-locale', {
    getLocale: async () => {
      const locale = await getDbLocale();
      return locale ?? undefined;
    }
  });
  strategyRegistered = true;
}

const envSnapshot = () => ({
  APP_VERSION: appVersion,
  LOG_LEVEL: env.LOG_LEVEL,
  LOG_DIR: env.LOG_DIR,
  NODE_ENV: env.NODE_ENV,
  DB_PATH: env.DB_PATH,
  DEMO_MODE: env.DEMO_MODE,
  FORCE_DATA_SEED: env.FORCE_DATA_SEED
});

const logEnvSnapshot = () => {
  const snapshot = envSnapshot();

  Object.entries(snapshot).forEach(([key, value]) => logger.info(`${key}: ${String(value)}`));
};

let dbInitialized = false;

const initPromise = (async () => {
  if (dbInitialized) return;

  try {
    logger.info(appAsciiArt);
    logger.info(`Starting Tracktor v${appVersion}`);
    logEnvSnapshot();
  } catch (error) {
    logger.error('Failed to log startup banner', error);
  }

  try {
    await ensureAppDirectories();
  } catch (error) {
    logger.error('Failed to create required application directories', error);

    const wrapped = new Error('Failed to create required application directories');

    (wrapped as any).cause = error;

    throw wrapped;
  }

  try {
    await initializeDatabase();
    dbInitialized = true;
    logger.info('Database initialization completed');
  } catch (error) {
    logger.error('Failed to initialize database', error);

    const wrapped = new Error('Failed to initialize database');

    (wrapped as any).cause = error;

    throw wrapped;
  }

  try {
    await initializeNotificationScheduler();
    logger.info('Notification scheduler initialization completed');
  } catch (error) {
    logger.error('Failed to initialize notification scheduler', error);
    // Don't throw - scheduler is not critical for app startup
  }
})();

export const handleError: HandleServerError = async ({ error, event }) => {
  logError(error, event);

  const body = createErrorResponseBody(error);

  return { message: body.error.message || 'Internal server error' };
};

const originalHandle: Handle = async ({ event, resolve }) => {
  await initPromise;

  const middlewareResult = await middlewareChain.handle(event);

  if (middlewareResult.response) {
    return middlewareResult.response;
  }

  const response = await resolve(event);

  CorsMiddleware.addCorsHeaders(response, event.request);

  return response;
};

const handleParaglide: Handle = async ({ event, resolve }) => {
  // Register the custom DB-locale strategy on first request.
  ensureCustomStrategy();

  const response = await paraglideMiddleware(event.request, ({ request: newRequest, locale }) => {
    event.request = newRequest;

    return resolve(event, {
      transformPageChunk: ({ html }) => {
        const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];
        const direction = rtlLanguages.includes(locale) ? 'rtl' : 'ltr';
        let result = html
          .replace('%paraglide.lang%', locale)
          .replace('dir="%paraglide.lang%"', `dir="${direction}"`);

        // Inject a cookie-setter script so the client-side hydration picks
        // up the same locale via the "cookie" strategy without a flash.
        if (locale !== 'en') {
          const script = `<script>(function(){if(document.cookie.indexOf('${PARAGLIDE_COOKIE}=')===-1){document.cookie='${PARAGLIDE_COOKIE}=${locale};path=/;max-age=34560000;SameSite=Lax'}})()</script>`;
          result = result.replace('</head>', `${script}</head>`);
        }

        return result;
      }
    });
  });

  return response;
};

export const handle = sequence(originalHandle, handleParaglide);
