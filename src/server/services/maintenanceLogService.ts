import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { createOwnedEntityService } from '../utils/entity-service-factory';
import type { z } from 'zod';
import { maintenanceSchema } from '$lib/domain/maintenance';
import { eq } from 'drizzle-orm';

type MaintenanceLogPayload = Omit<z.infer<typeof maintenanceSchema>, 'id' | 'vehicleId'>;
type MaintenanceLogUpdatePayload = Partial<MaintenanceLogPayload>;

const entityService = createOwnedEntityService<MaintenanceLogPayload, MaintenanceLogUpdatePayload>({
  table: schema.maintenanceLogTable,
  entityName: 'Maintenance log'
});

export const addMaintenanceLog = async (
  vehicleId: string,
  maintenanceLogData: MaintenanceLogPayload,
  username?: string | null
) => {
  const result = await entityService.add(vehicleId, maintenanceLogData);
  return result;
};

export const getMaintenanceLogById = entityService.getById;
export const deleteMaintenanceLog = entityService.removeScoped;

export const updateMaintenanceLog = async (
  vehicleId: string,
  id: string,
  maintenanceLogData: MaintenanceLogUpdatePayload,
  username?: string | null
) => {
  const existing = await entityService.getById(id);
  const updatedLog = await db
    .update(schema.maintenanceLogTable)
    .set({
      ...maintenanceLogData,
      updatedBy: username || undefined
    })
    .where(eq(schema.maintenanceLogTable.id, id))
    .returning();
  return updatedLog[0];
};

export const getMaintenanceLogs = async (vehicleId: string) => {
  const rows = await db.query.maintenanceLogTable.findMany({
    where: (logs, { eq }) => eq(logs.vehicleId, vehicleId),
    orderBy: (logs, { asc }) => [asc(logs.date), asc(logs.odometer)]
  });
  return rows.map((r) => ({ ...r, date: new Date(r.date) }));
};
