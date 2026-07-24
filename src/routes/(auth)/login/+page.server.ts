import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  // Preserve query params (e.g. ?reason=no_invitation) when redirecting to root
  throw redirect(307, `/${url.search}`);
};
