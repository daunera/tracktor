import { error, json, type RequestEvent } from '@sveltejs/kit';
import type { ApiResponse } from '$lib/response';
import { z, ZodError } from 'zod';
import { AppError } from '$server/exceptions/AppError';
import * as m from '$lib/paraglide/messages';
import logger from '$server/config/logger';

const getLocale = (e: { request: Request }): string | undefined => {
  try {
    const cookie = e.request.headers.get('cookie') || '';
    const match = cookie.match(/paraglide_lang=([^;]+)/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
};

/** SvelteKit throws Redirect and HttpError as plain class instances (not extending Error).
 *  These must be rethrown so the framework can handle them, NOT converted to 500s. */
function isRedirect(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'location' in err &&
    typeof (err as Record<string, unknown>).location === 'string' &&
    'status' in err &&
    typeof (err as Record<string, unknown>).status === 'number'
  );
}

function isHttpError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'body' in err &&
    'status' in err &&
    typeof (err as Record<string, unknown>).status === 'number'
  );
}

function isFrameworkError(err: unknown): boolean {
  return isRedirect(err) || isHttpError(err);
}

export function rethrowRouteError(err: unknown, fallbackMessage?: string): never {
  // SvelteKit redirect() throws a Redirect object — pass through
  if (isRedirect(err)) {
    throw err;
  }

  // SvelteKit error() throws an HttpError object — pass through
  if (isHttpError(err)) {
    throw err;
  }

  if (err instanceof ZodError) {
    const detail = err.issues.map((issue) => issue.message).join(', ');
    throw error(400, m.api_validation_error({ detail }));
  }

  if (err instanceof AppError) {
    throw error(err.status, err.message);
  }

  throw error(500, fallbackMessage ?? m.api_internal_error());
}

export function jsonResponse<T>(
  data: T,
  message?: string,
  init?: Parameters<typeof json>[1]
): Response {
  const response: ApiResponse<T> = { success: true, data };
  if (message) response.message = message;
  return json(response, init);
}

export async function parseBody<T>(
  event: RequestEvent,
  schema: z.ZodType<T>,
  overrides?: Record<string, unknown>
): Promise<T> {
  const body = await event.request.json();
  const input = overrides ? { ...body, ...overrides } : body;
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })
      .join('; ');
    throw error(400, `Validation failed: ${messages}`);
  }
  return result.data;
}

export async function withRouteErrorHandling<T>(
  label: string,
  handler: () => Promise<T>,
  fallbackMessage?: string
): Promise<T> {
  try {
    return await handler();
  } catch (err) {
    if (!isFrameworkError(err)) {
      logger.error(label, err);
    }
    rethrowRouteError(err, fallbackMessage);
  }
}

export async function withJsonErrorHandling<T>(
  label: string,
  handler: () => Promise<T>,
  message: string,
  status = 500
): Promise<T | Response> {
  try {
    return await handler();
  } catch (err) {
    if (!isFrameworkError(err)) {
      logger.error(label, err);
    }
    return json(
      {
        success: false,
        message
      },
      { status }
    );
  }
}
