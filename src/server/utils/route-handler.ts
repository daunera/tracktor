import { error, json } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { AppError } from '$server/exceptions/AppError';

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

export function rethrowRouteError(err: unknown, fallbackMessage = 'Internal server error'): never {
  // SvelteKit redirect() throws a Redirect object — pass through
  if (isRedirect(err)) {
    throw err;
  }

  // SvelteKit error() throws an HttpError object — pass through
  if (isHttpError(err)) {
    throw err;
  }

  if (err instanceof ZodError) {
    throw error(400, `Validation error: ${err.issues.map((issue) => issue.message).join(', ')}`);
  }

  if (err instanceof AppError) {
    throw error(err.status, err.message);
  }

  throw error(500, fallbackMessage);
}

export async function withRouteErrorHandling<T>(
  label: string,
  handler: () => Promise<T>,
  fallbackMessage = 'Internal server error'
): Promise<T> {
  try {
    return await handler();
  } catch (err) {
    if (!isFrameworkError(err)) {
      console.error(label, err);
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
      console.error(label, err);
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
