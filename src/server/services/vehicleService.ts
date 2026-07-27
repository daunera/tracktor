import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Vehicle } from '$lib/domain/vehicle';
import { performDelete } from '../utils/serviceUtils';
import { requireRecord } from './service-response.helper';
import { getAccessibleVehicleIds, getUserRoleForVehicle } from './vehicleShareService';
import { AppError, Status } from '$server/exceptions/AppError';
import {
  computeAverageMileage,
  computeLatestOdometer,
  type FuelLogInput
} from '$lib/domain/fuel/mileage';

type VehiclePayload = Omit<Vehicle, 'insuranceStatus' | 'puccStatus'>;
type VehicleMutationPayload = Omit<VehiclePayload, 'id'>;

function serializeVehiclePayload(vehicleData: VehicleMutationPayload) {
  const { id: _, ...data } = vehicleData as VehicleMutationPayload & { id?: unknown };
  return {
    ...data,
    customFields: vehicleData.customFields ? JSON.stringify(vehicleData.customFields) : null
  };
}

function parseVehicleRecord<T extends { customFields: string | null }>(vehicle: T) {
  return {
    ...vehicle,
    customFields: vehicle.customFields ? JSON.parse(vehicle.customFields) : null
  };
}

const getStatusFromDates = (dates: Date[], today: Date) => {
  if (dates.length === 0) return 'Not Available';
  return dates.some((date) => date > today) ? 'Active' : 'Expired';
};

export const addVehicle = async (
  vehicleData: VehicleMutationPayload,
  userId: string,
  username?: string | null
) => {
  const processedData = serializeVehiclePayload(vehicleData);
  const [vehicle] = await db
    .insert(schema.vehicleTable)
    .values({
      ...processedData,
      userId,
      createdBy: username || undefined
    })
    .returning();

  return parseVehicleRecord(vehicle);
};

export const getAllVehicles = async (userId?: string) => {
  let accessibleIds: string[] | undefined;
  if (userId) {
    accessibleIds = await getAccessibleVehicleIds(userId);
  }

  const vehiclesQuery = db
    .select({
      id: schema.vehicleTable.id,
      make: schema.vehicleTable.make,
      model: schema.vehicleTable.model,
      year: schema.vehicleTable.year,
      licensePlate: schema.vehicleTable.licensePlate,
      color: schema.vehicleTable.color,
      odometer: schema.vehicleTable.odometer,
      vin: schema.vehicleTable.vin,
      image: schema.vehicleTable.image,
      fuelType: schema.vehicleTable.fuelType,
      customFields: schema.vehicleTable.customFields,
      userId: schema.vehicleTable.userId,
      ownerName: schema.usersTable.name,
      ownerUsername: schema.usersTable.username
    })
    .from(schema.vehicleTable)
    .leftJoin(schema.usersTable, eq(schema.vehicleTable.userId, schema.usersTable.id));

  const vehicles = accessibleIds
    ? await vehiclesQuery.where(inArray(schema.vehicleTable.id, accessibleIds))
    : await vehiclesQuery;

  const [insurances, pollutionCerts, maxFuelOdometerRows, maxMaintenanceOdometerRows, allFuelLogs] =
    await Promise.all([
      db.query.insuranceTable.findMany({
        columns: { vehicleId: true, endDate: true }
      }),
      db.query.pollutionCertificateTable.findMany({
        columns: { vehicleId: true, expiryDate: true }
      }),
      db
        .select({
          vehicleId: schema.fuelLogTable.vehicleId,
          maxOdometer: sql<number>`MAX(${schema.fuelLogTable.odometer})`.as('max_odometer')
        })
        .from(schema.fuelLogTable)
        .where(sql`${schema.fuelLogTable.odometer} IS NOT NULL`)
        .groupBy(schema.fuelLogTable.vehicleId),
      db
        .select({
          vehicleId: schema.maintenanceLogTable.vehicleId,
          maxOdometer: sql<number>`MAX(${schema.maintenanceLogTable.odometer})`.as('max_odometer')
        })
        .from(schema.maintenanceLogTable)
        .where(sql`${schema.maintenanceLogTable.odometer} IS NOT NULL`)
        .groupBy(schema.maintenanceLogTable.vehicleId),
      db.query.fuelLogTable.findMany({
        columns: {
          vehicleId: true,
          filled: true,
          missedLast: true,
          odometer: true,
          fuelAmount: true
        },
        orderBy: (log, { asc }) => [asc(log.date), asc(log.odometer)]
      })
    ]);

  const maxFuelOdometer = new Map(maxFuelOdometerRows.map((r) => [r.vehicleId, r.maxOdometer]));
  const maxMaintenanceOdometer = new Map(
    maxMaintenanceOdometerRows.map((r) => [r.vehicleId, r.maxOdometer])
  );

  const fuelLogsByVehicle = new Map<string, FuelLogInput[]>();
  for (const log of allFuelLogs) {
    if (!fuelLogsByVehicle.has(log.vehicleId)) {
      fuelLogsByVehicle.set(log.vehicleId, []);
    }
    fuelLogsByVehicle.get(log.vehicleId)!.push(log);
  }

  const today = new Date();

  const enrichedVehicles = vehicles.map((vehicle) => {
    const vehicleFuelLogs = fuelLogsByVehicle.get(vehicle.id) || [];

    const latestOdometer = computeLatestOdometer(
      vehicle.odometer,
      maxFuelOdometer.get(vehicle.id) ?? null,
      maxMaintenanceOdometer.get(vehicle.id) ?? null
    );

    const overallMileage = computeAverageMileage(vehicleFuelLogs);

    const vehicleInsuranceDates = insurances
      .filter((ins) => ins.vehicleId === vehicle.id && ins.endDate)
      .map((ins) => new Date(ins.endDate!));

    const vehiclePuccDates = pollutionCerts
      .filter((pucc) => pucc.vehicleId === vehicle.id && pucc.expiryDate)
      .map((pucc) => new Date(pucc.expiryDate!));

    const parsedVehicle = parseVehicleRecord(vehicle);

    return {
      ...parsedVehicle,
      odometer: latestOdometer || vehicle.odometer || 0,
      overallMileage,
      insuranceStatus: getStatusFromDates(vehicleInsuranceDates, today),
      puccStatus: getStatusFromDates(vehiclePuccDates, today)
    };
  });

  return enrichedVehicles;
};

export const getVehicleById = async (id: string, userId?: string) => {
  const vehicleRow = await db
    .select({
      id: schema.vehicleTable.id,
      make: schema.vehicleTable.make,
      model: schema.vehicleTable.model,
      year: schema.vehicleTable.year,
      licensePlate: schema.vehicleTable.licensePlate,
      vin: schema.vehicleTable.vin,
      color: schema.vehicleTable.color,
      odometer: schema.vehicleTable.odometer,
      image: schema.vehicleTable.image,
      fuelType: schema.vehicleTable.fuelType,
      customFields: schema.vehicleTable.customFields,
      userId: schema.vehicleTable.userId,
      ownerName: schema.usersTable.name,
      ownerUsername: schema.usersTable.username
    })
    .from(schema.vehicleTable)
    .leftJoin(schema.usersTable, eq(schema.vehicleTable.userId, schema.usersTable.id))
    .where(eq(schema.vehicleTable.id, id))
    .then((rows) => rows[0] || null);

  const vehicle = requireRecord(vehicleRow, `No vehicle found for id : ${id}`);

  // Check access if userId is provided
  if (userId) {
    const role = await getUserRoleForVehicle(userId, id);
    if (!role) {
      throw new AppError('Vehicle not found', Status.NOT_FOUND);
    }
  }

  const [fuelLogs, maxFuelOdometerRow, maxMaintenanceOdometerRow] = await Promise.all([
    db.query.fuelLogTable.findMany({
      where: (log, { eq }) => eq(log.vehicleId, id),
      columns: { filled: true, missedLast: true, odometer: true, fuelAmount: true },
      orderBy: (log, { asc }) => [asc(log.date), asc(log.odometer)]
    }),
    db.query.fuelLogTable.findFirst({
      where: (log, { and, eq }) => and(eq(log.vehicleId, id), sql`${log.odometer} IS NOT NULL`),
      orderBy: (log, { desc }) => [desc(log.odometer)],
      columns: { odometer: true }
    }),
    db.query.maintenanceLogTable.findFirst({
      where: (log, { and, eq }) => and(eq(log.vehicleId, id), sql`${log.odometer} IS NOT NULL`),
      orderBy: (log, { desc }) => [desc(log.odometer)],
      columns: { odometer: true }
    })
  ]);

  const currentOdometer = computeLatestOdometer(
    vehicle.odometer,
    maxFuelOdometerRow?.odometer ?? null,
    maxMaintenanceOdometerRow?.odometer ?? null
  );
  const overallMileage = computeAverageMileage(fuelLogs);

  return {
    ...parseVehicleRecord(vehicle),
    currentOdometer: currentOdometer || vehicle.odometer || 0,
    overallMileage
  };
};

export const updateVehicle = async (
  id: string,
  vehicleData: VehicleMutationPayload,
  username?: string | null,
  userId?: string
) => {
  // Validate vehicle exists and user has access (owner or editor)
  if (userId) {
    const role = await getUserRoleForVehicle(userId, id);
    if (!role) {
      throw new AppError('Vehicle not found', Status.NOT_FOUND);
    }
    if (role === 'viewer') {
      throw new AppError('You do not have permission to update this vehicle', Status.FORBIDDEN);
    }
  }

  requireRecord(
    await db.query.vehicleTable.findFirst({
      where: (vehicles, { eq }) => eq(vehicles.id, id),
      columns: { id: true }
    }),
    `No vehicle found for id : ${id}`
  );

  const processedData = serializeVehiclePayload(vehicleData);

  const [updatedVehicle] = await db
    .update(schema.vehicleTable)
    .set({ ...processedData, updatedBy: username || undefined })
    .where(eq(schema.vehicleTable.id, id))
    .returning();

  return parseVehicleRecord(updatedVehicle);
};

export const deleteVehicle = async (id: string, userId?: string) => {
  if (userId) {
    const role = await getUserRoleForVehicle(userId, id);
    if (role !== 'owner') {
      throw new AppError('Vehicle not found', Status.NOT_FOUND);
    }
  }
  return await performDelete(schema.vehicleTable, id, 'Vehicle');
};

// Get vehicles with minimal data for dropdown/selection purposes
export const getVehiclesMinimal = async (userId?: string) => {
  let accessibleIds: string[] | undefined;
  if (userId) {
    accessibleIds = await getAccessibleVehicleIds(userId);
  }
  const vehicles = await db.query.vehicleTable.findMany({
    columns: {
      id: true,
      make: true,
      model: true,
      year: true,
      licensePlate: true
    },
    ...(accessibleIds ? { where: (v, { inArray }) => inArray(v.id, accessibleIds) } : {})
  });
  return vehicles;
};

export const getVehicleSummary = async (id: string, userId?: string) => {
  const [vehicle, fuelLogsCount, maintenanceLogsCount] = await Promise.all([
    getVehicleById(id, userId),
    db.query.fuelLogTable.findMany({
      where: (log, { eq }) => eq(log.vehicleId, id),
      columns: { id: true }
    }),
    db.query.maintenanceLogTable.findMany({
      where: (log, { eq }) => eq(log.vehicleId, id),
      columns: { id: true }
    })
  ]);

  return {
    ...vehicle,
    totalFuelLogs: fuelLogsCount.length,
    totalMaintenanceLogs: maintenanceLogsCount.length
  };
};
