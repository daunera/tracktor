import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { createOwnedEntityService } from '../utils/entity-service-factory';
import { clearFixedEndDate } from './domain-payload.helper';
import { requireRecord } from './service-response.helper';
import { eq } from 'drizzle-orm';
import type { Insurance } from '$lib/domain/insurance';

type InsurancePayload = {
  provider: string;
  policyNumber: string;
  startDate: string;
  endDate: string | null;
  recurrenceType: Insurance['recurrenceType'];
  recurrenceInterval: number;
  cost: number;
  classification: Insurance['classification'];
  attachmentPassword: Insurance['attachmentPassword'];
  notes: string | null;
  attachment: string | null;
};

type InsuranceUpdatePayload = Partial<InsurancePayload>;

const entityService = createOwnedEntityService<InsurancePayload, InsuranceUpdatePayload>({
  table: schema.insuranceTable,
  entityName: 'Insurance',
  sanitize: clearFixedEndDate
});

export const addInsurance = async (
  vehicleId: string,
  insuranceData: InsurancePayload,
  _username?: string | null
) => {
  const result = await entityService.add(vehicleId, insuranceData);
  return result;
};

export const getInsuranceById = entityService.getById;
export const deleteInsurance = entityService.remove;

export const updateInsurance = async (
  vehicleId: string,
  id: string,
  insuranceData: InsurancePayload,
  username?: string | null
) => {
  requireRecord(
    await db.query.insuranceTable.findFirst({
      where: (insurances, { eq, and }) =>
        and(eq(insurances.vehicleId, vehicleId), eq(insurances.id, id))
    }),
    `No Insurances found for id: ${id}`
  );
  const updatedInsurance = await db
    .update(schema.insuranceTable)
    .set({ ...clearFixedEndDate(insuranceData), updatedBy: username || undefined })
    .where(eq(schema.insuranceTable.id, id))
    .returning();
  return updatedInsurance[0];
};

export const getInsurances = async (vehicleId: string) => {
  const insurance = await db.query.insuranceTable.findMany({
    where: (insurances, { eq }) => eq(insurances.vehicleId, vehicleId),
    orderBy: (ins, { desc }) => [desc(ins.startDate)]
  });
  const normalized = insurance.map((i) =>
    i.recurrenceType !== 'none' ? { ...i, endDate: null } : i
  );
  return normalized;
};
