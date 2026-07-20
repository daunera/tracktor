import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '$lib/response';
import { createSuccessResponse, requireRecord } from './service-response.helper';
import { AppError, Status } from '$server/exceptions/AppError';

export const getSharesForVehicle = async (vehicleId: string): Promise<ApiResponse> => {
  const shares = await db
    .select({
      id: schema.vehicleShareTable.id,
      userId: schema.vehicleShareTable.userId,
      username: schema.usersTable.username,
      name: schema.usersTable.name,
      email: schema.usersTable.email,
      role: schema.vehicleShareTable.role,
      createdAt: schema.vehicleShareTable.created_at
    })
    .from(schema.vehicleShareTable)
    .innerJoin(schema.usersTable, eq(schema.vehicleShareTable.userId, schema.usersTable.id))
    .where(eq(schema.vehicleShareTable.vehicleId, vehicleId));

  return createSuccessResponse(shares, 'Shares retrieved successfully');
};

export const addShare = async (
  vehicleId: string,
  userId: string,
  role: 'viewer' | 'editor',
  currentUserId: string
): Promise<ApiResponse> => {
  // Verify the vehicle belongs to the current user
  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, vehicleId)
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', Status.NOT_FOUND);
  }

  if (vehicle.userId !== currentUserId) {
    throw new AppError('Only the vehicle owner can manage shares', Status.FORBIDDEN);
  }

  // Prevent self-sharing
  if (userId === currentUserId) {
    throw new AppError('Cannot share a vehicle with yourself', Status.BAD_REQUEST);
  }

  // Verify the target user exists and is active
  const targetUser = await db.query.usersTable.findFirst({
    where: (u, { eq }) => eq(u.id, userId)
  });

  if (!targetUser) {
    throw new AppError('User not found', Status.NOT_FOUND);
  }

  if (targetUser.status !== 'active') {
    throw new AppError('Cannot share with a user who is not active', Status.BAD_REQUEST);
  }

  // Check for duplicate shares
  const existingShare = await db.query.vehicleShareTable.findFirst({
    where: (s, { eq, and }) => and(eq(s.vehicleId, vehicleId), eq(s.userId, userId))
  });

  if (existingShare) {
    // Update role if share already exists
    const [updated] = await db
      .update(schema.vehicleShareTable)
      .set({ role })
      .where(eq(schema.vehicleShareTable.id, existingShare.id))
      .returning();

    return createSuccessResponse(updated, 'Share role updated successfully');
  }

  await db.insert(schema.vehicleShareTable).values({
    vehicleId,
    userId,
    role
  });

  return createSuccessResponse({ vehicleId, userId, role }, 'Vehicle shared successfully');
};

export const updateShareRole = async (
  shareId: string,
  newRole: 'viewer' | 'editor',
  currentUserId: string
): Promise<ApiResponse> => {
  const share = requireRecord(
    await db.query.vehicleShareTable.findFirst({
      where: (s, { eq }) => eq(s.id, shareId)
    }),
    'Share not found'
  );

  // Verify the current user owns the vehicle
  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, share.vehicleId)
  });

  if (!vehicle || vehicle.userId !== currentUserId) {
    throw new AppError('Only the vehicle owner can manage shares', Status.FORBIDDEN);
  }

  const [updated] = await db
    .update(schema.vehicleShareTable)
    .set({ role: newRole })
    .where(eq(schema.vehicleShareTable.id, shareId))
    .returning();

  return createSuccessResponse(updated, 'Share role updated successfully');
};

export const removeShare = async (shareId: string, currentUserId: string): Promise<ApiResponse> => {
  const share = requireRecord(
    await db.query.vehicleShareTable.findFirst({
      where: (s, { eq }) => eq(s.id, shareId)
    }),
    'Share not found'
  );

  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, share.vehicleId)
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', Status.NOT_FOUND);
  }

  const isOwner = vehicle.userId === currentUserId;
  const isSelf = share.userId === currentUserId;

  if (!isOwner && !isSelf) {
    throw new AppError('You are not allowed to remove this share', Status.FORBIDDEN);
  }

  await db.delete(schema.vehicleShareTable).where(eq(schema.vehicleShareTable.id, shareId));

  return createSuccessResponse(null, 'Share removed successfully');
};

export const getShareForUser = async (vehicleId: string, userId: string): Promise<ApiResponse> => {
  const share = await db.query.vehicleShareTable.findFirst({
    where: (s, { eq, and }) => and(eq(s.vehicleId, vehicleId), eq(s.userId, userId))
  });

  if (!share) {
    throw new AppError('Share not found', Status.NOT_FOUND);
  }

  return createSuccessResponse(
    {
      id: share.id,
      userId: share.userId,
      role: share.role,
      createdAt: share.created_at
    },
    'Share retrieved successfully'
  );
};

export const transferOwnership = async (
  vehicleId: string,
  newOwnerUserId: string,
  currentUserId: string
): Promise<ApiResponse> => {
  // Verify the vehicle exists and current user is the owner
  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, vehicleId)
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', Status.NOT_FOUND);
  }

  if (vehicle.userId !== currentUserId) {
    throw new AppError('Only the vehicle owner can transfer ownership', Status.FORBIDDEN);
  }

  // Prevent self-transfer
  if (newOwnerUserId === currentUserId) {
    throw new AppError('You already own this vehicle', Status.BAD_REQUEST);
  }

  // Verify the target user exists and is active
  const targetUser = await db.query.usersTable.findFirst({
    where: (u, { eq }) => eq(u.id, newOwnerUserId)
  });

  if (!targetUser) {
    throw new AppError('User not found', Status.NOT_FOUND);
  }

  if (targetUser.status !== 'active') {
    throw new AppError('Cannot transfer ownership to a user who is not active', Status.BAD_REQUEST);
  }

  await db.transaction(async (tx) => {
    // Remove any existing share for the new owner (they're now the owner)
    const existingShare = await tx.query.vehicleShareTable.findFirst({
      where: (s, { eq, and }) => and(eq(s.vehicleId, vehicleId), eq(s.userId, newOwnerUserId))
    });

    if (existingShare) {
      await tx
        .delete(schema.vehicleShareTable)
        .where(eq(schema.vehicleShareTable.id, existingShare.id));
    }

    // Transfer ownership
    await tx
      .update(schema.vehicleTable)
      .set({ userId: newOwnerUserId })
      .where(eq(schema.vehicleTable.id, vehicleId));

    // Add editor share for the old owner so they retain access
    await tx.insert(schema.vehicleShareTable).values({
      vehicleId,
      userId: currentUserId,
      role: 'editor'
    });
  });

  return createSuccessResponse(
    { vehicleId, newOwnerId: newOwnerUserId },
    'Ownership transferred successfully'
  );
};

export const getAccessibleVehicleIds = async (userId: string): Promise<string[]> => {
  // Get vehicles owned by the user
  const ownedVehicles = await db.query.vehicleTable.findMany({
    where: (v, { eq }) => eq(v.userId, userId),
    columns: { id: true }
  });

  // Get vehicles shared with the user
  const sharedVehicles = await db.query.vehicleShareTable.findMany({
    where: (s, { eq }) => eq(s.userId, userId),
    columns: { vehicleId: true }
  });

  const ownedIds = ownedVehicles.map((v) => v.id);
  const sharedIds = sharedVehicles.map((s) => s.vehicleId);

  return [...new Set([...ownedIds, ...sharedIds])];
};

export const getUserRoleForVehicle = async (
  userId: string,
  vehicleId: string
): Promise<'owner' | 'editor' | 'viewer' | null> => {
  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, vehicleId),
    columns: { userId: true }
  });

  if (!vehicle) return null;
  if (vehicle.userId === userId) return 'owner';

  const share = await db.query.vehicleShareTable.findFirst({
    where: (s, { eq, and }) => and(eq(s.vehicleId, vehicleId), eq(s.userId, userId)),
    columns: { role: true }
  });

  if (!share) return null;
  return share.role as 'editor' | 'viewer';
};
