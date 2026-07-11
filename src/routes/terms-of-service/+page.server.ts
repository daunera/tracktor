import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { baseUrl } = await parent();
  const hostname = baseUrl ? new URL(baseUrl).hostname : 'example.com';
  const contactEmail = `info@${hostname}`;

  return { contactEmail };
};
