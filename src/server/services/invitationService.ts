import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { AppError, Status } from '$server/exceptions/AppError';
import { sendInvitationEmail, type InvitationEmailLocale } from './invitationEmailService';
import { addShare } from './vehicleShareService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeInvitationEmail = (email: string): string => email.trim().toLowerCase();

const buildVehicleName = (vehicle: {
  make: string | null;
  model: string | null;
  licensePlate: string | null;
}): string | null =>
  vehicle.make && vehicle.model
    ? vehicle.licensePlate
      ? `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`
      : `${vehicle.make} ${vehicle.model}`
    : null;

const findUserByEmail = async (email: string) => {
  const normalizedEmail = normalizeInvitationEmail(email);

  return db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(sql`lower(${users.email})`, normalizedEmail)
  });
};

// ── Core invitation (both app and vehicle) ──

export const createInvitation = async (
  email: string,
  vehicleId: string | null,
  role: 'viewer' | 'editor' | null,
  inviterUserId: string,
  locale?: InvitationEmailLocale
) => {
  const normalizedEmail = normalizeInvitationEmail(email);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new AppError('Invalid email format', Status.BAD_REQUEST);
  }

  const inviter = await db.query.usersTable.findFirst({
    where: (u, { eq }) => eq(u.id, inviterUserId)
  });

  if (!inviter) {
    throw new AppError('Inviter not found', Status.NOT_FOUND);
  }

  // ── App invitation branch (vehicleId is null) ──
  if (vehicleId === null) {
    const existingInvite = await db.query.invitationTable.findFirst({
      where: (i, { eq, and }) =>
        and(
          eq(sql`lower(${i.email})`, normalizedEmail),
          isNull(i.vehicleId),
          eq(i.status, 'pending')
        )
    });

    if (existingInvite) {
      throw new AppError('An invitation has already been sent to this email', Status.BAD_REQUEST);
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser?.status === 'active') {
      throw new AppError('This user already has access to the application', Status.BAD_REQUEST);
    }

    await db.insert(schema.invitationTable).values({
      email: normalizedEmail,
      vehicleId: null,
      role: null,
      invitedBy: inviterUserId
    });

    const emailResult = await sendInvitationEmail({
      inviterName: inviter.name || '',
      inviterUsername: inviter.username,
      vehicleName: null,
      recipientEmail: normalizedEmail,
      locale
    });

    if (!emailResult.success) {
      console.error('Failed to send app invitation email:', emailResult.error);
    }

    return { email: normalizedEmail, type: 'app' };
  }

  // ── Vehicle sharing branch ──

  if (!role) {
    throw new AppError('Role is required for vehicle invitations', Status.BAD_REQUEST);
  }

  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, vehicleId)
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', Status.NOT_FOUND);
  }

  if (vehicle.userId !== inviterUserId) {
    throw new AppError('Only the vehicle owner can invite users', Status.FORBIDDEN);
  }

  if (inviter.email && normalizeInvitationEmail(inviter.email) === normalizedEmail) {
    throw new AppError('Cannot share a vehicle with yourself', Status.BAD_REQUEST);
  }

  const existingInvite = await db.query.invitationTable.findFirst({
    where: (i, { eq, and }) =>
      and(
        eq(sql`lower(${i.email})`, normalizedEmail),
        eq(i.vehicleId, vehicleId),
        eq(i.status, 'pending')
      )
  });

  if (existingInvite) {
    throw new AppError('An invitation has already been sent to this email', Status.BAD_REQUEST);
  }

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser?.status === 'active') {
    const existingShare = await db.query.vehicleShareTable.findFirst({
      where: (s, { eq, and }) => and(eq(s.vehicleId, vehicleId), eq(s.userId, existingUser.id))
    });

    if (existingShare) {
      throw new AppError(
        'This vehicle is already shared with this email address',
        Status.BAD_REQUEST
      );
    }

    await addShare(vehicleId, existingUser.id, role, inviterUserId);

    await sendInvitationEmail({
      inviterName: inviter.name || '',
      inviterUsername: inviter.username,
      vehicleName: buildVehicleName(vehicle),
      recipientEmail: normalizedEmail,
      locale
    });

    return { email: normalizedEmail, vehicleId, role, sharedImmediately: true };
  }

  await db.insert(schema.invitationTable).values({
    email: normalizedEmail,
    vehicleId,
    role,
    invitedBy: inviterUserId
  });

  await sendInvitationEmail({
    inviterName: inviter.name || '',
    inviterUsername: inviter.username,
    vehicleName: buildVehicleName(vehicle),
    recipientEmail: normalizedEmail,
    locale
  });

  return { email: normalizedEmail, vehicleId, role, sharedImmediately: false };
};

// ── Pending invitations lookup ──

export const getPendingInvitationsForEmail = async (
  email: string
): Promise<
  {
    id: string;
    vehicleId: string | null;
    role: 'viewer' | 'editor' | null;
    invitedBy: string;
    vehicleName?: string;
  }[]
> => {
  const normalizedEmail = normalizeInvitationEmail(email);

  const invitations = await db
    .select({
      id: schema.invitationTable.id,
      vehicleId: schema.invitationTable.vehicleId,
      role: schema.invitationTable.role,
      invitedBy: schema.invitationTable.invitedBy,
      make: schema.vehicleTable.make,
      model: schema.vehicleTable.model,
      licensePlate: schema.vehicleTable.licensePlate
    })
    .from(schema.invitationTable)
    .leftJoin(schema.vehicleTable, eq(schema.invitationTable.vehicleId, schema.vehicleTable.id))
    .where(
      and(
        eq(sql`lower(${schema.invitationTable.email})`, normalizedEmail),
        eq(schema.invitationTable.status, 'pending')
      )
    );

  return invitations.map((inv) => ({
    id: inv.id,
    vehicleId: inv.vehicleId,
    role: inv.role as 'viewer' | 'editor' | null,
    invitedBy: inv.invitedBy,
    vehicleName: inv.make
      ? (buildVehicleName({
          make: inv.make,
          model: inv.model,
          licensePlate: inv.licensePlate
        }) ?? undefined)
      : undefined
  }));
};

export const fulfillInvitationsForEmail = async (email: string, userId: string): Promise<void> => {
  const pendingInvitations = await getPendingInvitationsForEmail(email);

  if (pendingInvitations.length === 0) return;

  await db.transaction(async (tx) => {
    for (const invitation of pendingInvitations) {
      if (invitation.vehicleId && invitation.role) {
        const existingShare = await tx.query.vehicleShareTable.findFirst({
          where: (s, { eq, and }) =>
            and(eq(s.vehicleId, invitation.vehicleId!), eq(s.userId, userId))
        });

        if (!existingShare) {
          await tx.insert(schema.vehicleShareTable).values({
            vehicleId: invitation.vehicleId,
            userId,
            role: invitation.role
          });
        }
      }

      await tx
        .update(schema.invitationTable)
        .set({ status: 'fulfilled' })
        .where(eq(schema.invitationTable.id, invitation.id));
    }
  });
};

export const hasPendingInvitations = async (email: string): Promise<boolean> => {
  const normalizedEmail = normalizeInvitationEmail(email);
  const invitations = await db.query.invitationTable.findFirst({
    where: (i, { eq, and }) =>
      and(eq(sql`lower(${i.email})`, normalizedEmail), eq(i.status, 'pending'))
  });

  return !!invitations;
};

export const applyInvitationsOnAuth = async (email: string, userId: string): Promise<boolean> => {
  const normalizedEmail = normalizeInvitationEmail(email);
  const invited = await hasPendingInvitations(normalizedEmail);

  if (!invited) {
    return false;
  }

  const user = await db.query.usersTable.findFirst({
    where: (u, { eq }) => eq(u.id, userId)
  });

  if (!user) {
    return false;
  }

  if (user.status === 'pending') {
    const now = new Date().toISOString();
    await db
      .update(schema.usersTable)
      .set({
        status: 'active',
        approvedBy: 'invitation',
        approvedAt: now
      })
      .where(eq(schema.usersTable.id, userId));
  }

  await fulfillInvitationsForEmail(normalizedEmail, userId);
  return true;
};

export const getPendingInvitationsForVehicle = async (vehicleId: string, currentUserId: string) => {
  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, vehicleId)
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', Status.NOT_FOUND);
  }

  if (vehicle.userId !== currentUserId) {
    throw new AppError('Only the vehicle owner can view invitations', Status.FORBIDDEN);
  }

  const invitations = await db
    .select({
      id: schema.invitationTable.id,
      email: schema.invitationTable.email,
      role: schema.invitationTable.role,
      createdAt: schema.invitationTable.created_at,
      name: schema.usersTable.name,
      username: schema.usersTable.username
    })
    .from(schema.invitationTable)
    .leftJoin(
      schema.usersTable,
      eq(sql`lower(${schema.usersTable.email})`, sql`lower(${schema.invitationTable.email})`)
    )
    .where(
      and(
        eq(schema.invitationTable.vehicleId, vehicleId),
        eq(schema.invitationTable.status, 'pending')
      )
    );

  return invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    name: invitation.name,
    username: invitation.username,
    role: invitation.role as 'viewer' | 'editor',
    createdAt: invitation.createdAt
  }));
};

export const cancelInvitation = async (
  invitationId: string,
  vehicleId: string,
  currentUserId: string
) => {
  const vehicle = await db.query.vehicleTable.findFirst({
    where: (v, { eq }) => eq(v.id, vehicleId)
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', Status.NOT_FOUND);
  }

  if (vehicle.userId !== currentUserId) {
    throw new AppError('Only the vehicle owner can cancel invitations', Status.FORBIDDEN);
  }

  const invitation = await db.query.invitationTable.findFirst({
    where: (i, { eq, and }) =>
      and(eq(i.id, invitationId), eq(i.vehicleId, vehicleId), eq(i.status, 'pending'))
  });

  if (!invitation) {
    throw new AppError('Invitation not found', Status.NOT_FOUND);
  }

  await db.delete(schema.invitationTable).where(eq(schema.invitationTable.id, invitationId));

  return null;
};

// ── App (login) invitations ──

export interface PendingAppInvitation {
  id: string;
  email: string;
  invitedBy: string;
  invitedByName: string | null;
  invitedByUsername: string | null;
  createdAt: string;
}

export const getPendingAppInvitations = async (): Promise<PendingAppInvitation[]> => {
  const invitations = await db
    .select({
      id: schema.invitationTable.id,
      email: schema.invitationTable.email,
      invitedBy: schema.invitationTable.invitedBy,
      createdAt: schema.invitationTable.created_at,
      invitedByName: schema.usersTable.name,
      invitedByUsername: schema.usersTable.username
    })
    .from(schema.invitationTable)
    .leftJoin(schema.usersTable, eq(schema.invitationTable.invitedBy, schema.usersTable.id))
    .where(
      and(isNull(schema.invitationTable.vehicleId), eq(schema.invitationTable.status, 'pending'))
    )
    .orderBy(schema.invitationTable.created_at);

  return invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    invitedBy: inv.invitedBy,
    invitedByName: inv.invitedByName,
    invitedByUsername: inv.invitedByUsername,
    createdAt: inv.createdAt
  }));
};

export const cancelAppInvitation = async (invitationId: string, currentUserId: string) => {
  const invitation = await db.query.invitationTable.findFirst({
    where: (i, { eq, and }) =>
      and(eq(i.id, invitationId), isNull(i.vehicleId), eq(i.status, 'pending'))
  });

  if (!invitation) {
    throw new AppError('Invitation not found', Status.NOT_FOUND);
  }

  await db.delete(schema.invitationTable).where(eq(schema.invitationTable.id, invitationId));

  return null;
};
