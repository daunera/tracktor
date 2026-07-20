import type { Response, Insurance } from '$lib/domain';
import { apiClient } from '$lib/helper/api.helper';
import { uploadFile } from './file.service';
import * as m from '$lib/paraglide/messages';

export const saveInsuranceWithAttachment = async (
  insurance: Insurance,
  attachment: File | undefined,
  removeExisting: boolean = false
): Promise<Response<Insurance>> => {
  if (attachment) {
    try {
      const res = await uploadFile(attachment);
      insurance.attachment = res.data.filename || null;
    } catch (e: any) {
      return {
        status: 'ERROR',
        error: e.response?.data?.message || m.file_upload_error()
      };
    }
  }
  // Handle existing attachment removal
  if (removeExisting) {
    insurance.attachment = null;
  }
  // If no new attachment and this is an update (has id) and not removing existing, don't modify attachment field
  // This preserves existing attachment when editing without uploading new file
  else if (!attachment && insurance.id) {
    // Remove attachment from the payload to avoid overwriting existing value
    const { attachment: _, ...insuranceWithoutAttachment } = insurance;
    return saveInsurance(insuranceWithoutAttachment as Insurance);
  }
  return saveInsurance(insurance);
};

export const saveInsurance = async (insurance: Insurance): Promise<Response<Insurance>> => {
  const res: Response<Insurance> = { status: 'OK' };
  try {
    const method = insurance.id ? 'PUT' : 'POST';
    const url = `/vehicles/${insurance.vehicleId}/insurance/${insurance.id || ''}`;

    const response = await apiClient[method.toLowerCase() as 'put' | 'post'](url, insurance);
    res.data = response.data;
  } catch (e: any) {
    res.status = 'ERROR';
    res.error = e.response?.data?.message || m.file_upload_error();
  }
  return res;
};

export const deleteInsurance = async (insurance: Insurance): Promise<Response<string>> => {
  const res: Response<string> = { status: 'OK' };
  try {
    const response = await apiClient.delete(
      `/vehicles/${insurance.vehicleId}/insurance/${insurance.id}`
    );
    res.data = response.data;
  } catch (e: any) {
    res.status = 'ERROR';
    res.error = e.response?.data?.message || m.file_upload_error();
  }
  return res;
};
