import { env } from '$lib/config/env.server';
import { BaseMiddleware, type MiddlewareResult } from './base';
import type { RequestEvent } from '@sveltejs/kit';
import { CorsMiddleware } from './cors';
import { AppError, Status } from '$server/exceptions/AppError';
import { validateSession, getUsersCount } from '$server/services/authService';

const BYPASS_PATHS = [
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/health',
  '/api/config/branding'
];

export class AuthMiddleware extends BaseMiddleware {
  protected async process(event: RequestEvent): Promise<MiddlewareResult> {
    if (!this.requiresAuth(event.url.pathname)) {
      return { continue: true };
    }
    return await this.handleAuthentication(event);
  }

  private async handleAuthentication(event: RequestEvent): Promise<MiddlewareResult> {
    const usersStatus = await getUsersCount();
    if (!usersStatus.hasUsers) {
      return {
        response: CorsMiddleware.createErrorResponse(
          'No users found. Please create a user account first.',
          Status.BAD_REQUEST,
          event.request
        ),
        continue: false
      };
    }

    const authHeader = event.request.headers.get('Authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') || event.cookies.get('session');

    if (!sessionToken) {
      return {
        response: CorsMiddleware.createErrorResponse(
          'Session token is required. Please login first.',
          Status.UNAUTHORIZED,
          event.request
        ),
        continue: false
      };
    }

    try {
      const { user } = await validateSession(sessionToken);

      if (!user) {
        return {
          response: CorsMiddleware.createErrorResponse(
            'Invalid or expired session. Please login again.',
            Status.UNAUTHORIZED,
            event.request
          ),
          continue: false
        };
      }

      // Check user registration status
      if (user.status === 'pending') {
        return {
          response: CorsMiddleware.createErrorResponse(
            'Your registration is pending approval. Please wait for an administrator to approve your account.',
            Status.FORBIDDEN,
            event.request
          ),
          continue: false
        };
      }

      if (user.status === 'rejected') {
        return {
          response: CorsMiddleware.createErrorResponse(
            'Your registration has been rejected by an administrator.',
            Status.FORBIDDEN,
            event.request
          ),
          continue: false
        };
      }

      event.locals.user = user;
      return { continue: true };
    } catch (error) {
      let statusCode = Status.INTERNAL_SERVER_ERROR;
      let message = 'Authentication failed';

      if (error instanceof AppError) {
        statusCode = error.status;
        message = error.message;
      }

      return {
        response: CorsMiddleware.createErrorResponse(
          message,
          statusCode,
          event.request,
          error as Error
        ),
        continue: false
      };
    }
  }

  private requiresAuth(pathname: string): boolean {
    if (env.DISABLE_AUTH) {
      return false;
    }

    if (!pathname.startsWith('/api')) {
      return false;
    }

    // Exact match for root /api/auth (GET for status, POST for login, DELETE for logout)
    if (pathname === '/api/auth') {
      return false;
    }

    // Check if pathname should be bypassed
    return !BYPASS_PATHS.some((path) => pathname.startsWith(path));
  }
}
