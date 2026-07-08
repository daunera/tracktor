import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import * as authService from '$server/services/authService';
import { withRouteErrorHandling } from '$server/utils/route-handler';

// GET /api/users/search?q= - Search active users for sharing
export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('User search GET error:', async () => {
    const url = new URL(event.request.url);
    const query = url.searchParams.get('q') || '';

    if (query.length < 2) {
      return json({
        success: true,
        data: [],
        message: 'Query must be at least 2 characters'
      });
    }

    const result = await authService.searchUsers(query);
    return json(result);
  });
};
