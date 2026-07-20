import type { Config, Response } from '$lib/domain';
import { apiClient } from '$lib/helper/api.helper';
import * as m from '$lib/paraglide/messages';

export const saveConfig = async (configs: Config[]): Promise<Response<any>> => {
  const res: Response<any> = { status: 'OK' };
  try {
    const url = `/config`;

    const response = await apiClient.put(url, configs);
    res.data = response.data;
  } catch (e: any) {
    res.status = 'ERROR';
    res.error = e.response?.data?.message || m.settings_save_error();
  }
  return res;
};
