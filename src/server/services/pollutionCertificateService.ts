import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { createOwnedEntityService } from '../utils/entity-service-factory';
import { clearFixedEndDate } from './domain-payload.helper';
import type { z } from 'zod';
import { pollutionCertificateSchema } from '$lib/domain/pucc';
import { requireRecord } from './service-response.helper';
import { eq } from 'drizzle-orm';

type PollutionCertificatePayload = Omit<
  z.infer<typeof pollutionCertificateSchema>,
  'id' | 'vehicleId'
>;
type PollutionCertificateUpdatePayload = Partial<PollutionCertificatePayload>;

const entityService = createOwnedEntityService<
  PollutionCertificatePayload,
  PollutionCertificateUpdatePayload
>({
  table: schema.pollutionCertificateTable,
  entityName: 'Pollution certificate',
  sanitize: clearFixedEndDate
});

export const addPollutionCertificate = async (
  vehicleId: string,
  pollutionCertificateData: PollutionCertificatePayload,
  _username?: string | null
) => {
  const result = await entityService.add(vehicleId, pollutionCertificateData);
  return result;
};

export const getPollutionCertificateById = entityService.getById;
export const deletePollutionCertificate = entityService.remove;

export const updatePollutionCertificate = async (
  vehicleId: string,
  id: string,
  pollutionCertificateData: PollutionCertificatePayload,
  username?: string | null
) => {
  requireRecord(
    await db.query.pollutionCertificateTable.findFirst({
      where: (certificates, { eq, and }) =>
        and(eq(certificates.vehicleId, vehicleId), eq(certificates.id, id))
    }),
    `No PUCC found for id : ${id}`
  );

  const updatedCertificate = await db
    .update(schema.pollutionCertificateTable)
    .set({ ...clearFixedEndDate(pollutionCertificateData), updatedBy: username || undefined })
    .where(eq(schema.pollutionCertificateTable.id, id))
    .returning();
  return updatedCertificate[0];
};

export const getPollutionCertificates = async (vehicleId: string) => {
  const pollutionCertificates = await db.query.pollutionCertificateTable.findMany({
    where: (certificates, { eq }) => eq(certificates.vehicleId, vehicleId)
  });
  const normalized = pollutionCertificates.map((c) =>
    c.recurrenceType !== 'none' ? { ...c, expiryDate: null } : c
  );
  return normalized;
};
