import type { LayoutServerLoad } from './$types';
import { appVersion } from '$server/config/appVersion';
import { env } from '$lib/config/env.server';

export const load: LayoutServerLoad = async () => ({
  appVersion,
  maxFileSize: env.BODY_SIZE_LIMIT
});
