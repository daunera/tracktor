import bcrypt from 'bcrypt';
import { AppError } from '../exceptions/AppError';
import { Status } from '../exceptions/AppError';
import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { eq, sql } from 'drizzle-orm';
import { type ApiResponse } from '$lib/response';
import {
  generateSessionToken,
  createSession,
  validateSessionToken,
  invalidateSession,
  type User
} from '../utils/session';
import { createSuccessResponse, requireRecord } from './service-response.helper';
import { env } from '$lib/config/env.server';

export const createUser = async (username: string, password: string): Promise<ApiResponse> => {
  if (env.DISABLE_PASSWORD_LOGIN) {
    throw new AppError('Password login is disabled.', Status.BAD_REQUEST);
  }

  // Check if user already exists
  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(users.username, username)
  });

  if (existingUser) {
    throw new AppError('Username already exists', Status.BAD_REQUEST);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  // Password users always start as pending (superadmin auto-approval is for Google/email users only)
  await db.insert(schema.usersTable).values({
    id: userId,
    username,
    passwordHash,
    authProvider: 'password',
    status: 'pending'
  });

  // Create a session so the pending page can identify the user
  const sessionToken = generateSessionToken();
  await createSession(sessionToken, userId);

  return createSuccessResponse(
    { userId, username, sessionToken },
    'User created successfully. Pending approval.'
  );
};

export const createOrUpdateUser = async (
  username: string,
  password: string
): Promise<string | undefined> => {
  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(users.username, username)
  });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.insert(schema.usersTable).values({
      id: userId,
      username: username,
      passwordHash,
      authProvider: 'password',
      status: 'active'
    });
    return userId;
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(schema.usersTable)
      .set({ passwordHash })
      .where(eq(schema.usersTable.username, username));
    return existingUser.id;
  }
};

export const loginUser = async (username: string, password: string): Promise<ApiResponse> => {
  if (env.DISABLE_PASSWORD_LOGIN) {
    throw new AppError('Password login is disabled.', Status.BAD_REQUEST);
  }

  const user = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.username, username)
    }),
    'Invalid username or password',
    Status.UNAUTHORIZED
  );

  // Check if this is a Google-only user (no password set)
  if (!user.passwordHash) {
    throw new AppError(
      'This account uses Google login. Please sign in with Google.',
      Status.UNAUTHORIZED
    );
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError('Invalid username or password', Status.UNAUTHORIZED);
  }

  // Check user status
  if (user.status === 'pending') {
    throw new AppError(
      'Your registration is pending approval. Please wait for an administrator to approve your account.',
      Status.FORBIDDEN
    );
  }

  if (user.status === 'rejected') {
    throw new AppError(
      'Your registration has been rejected by an administrator.',
      Status.FORBIDDEN
    );
  }

  // Sync superadmin role on every login
  const role = await syncSuperadminRole(user);

  const sessionToken = generateSessionToken();
  const session = await createSession(sessionToken, user.id);

  return createSuccessResponse(
    {
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider,
        status: user.status,
        role
      }
    },
    'Login successful'
  );
};

export const logoutUser = async (sessionId: string): Promise<ApiResponse> => {
  await invalidateSession(sessionId);
  return createSuccessResponse(undefined, 'Logout successful');
};

export const validateSession = async (sessionToken: string): Promise<{ user: User | null }> => {
  const result = await validateSessionToken(sessionToken);
  return { user: result.user };
};

export const getUsersCount = async (): Promise<ApiResponse> => {
  const users = await db.select().from(schema.usersTable);
  return createSuccessResponse({
    count: users.length,
    hasUsers: users.length > 0
  });
};

export const updateUserProfile = async (
  userId: string,
  data: { currentPassword?: string; newPassword?: string }
): Promise<ApiResponse> => {
  const user = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, userId)
    }),
    'User not found'
  );

  const updates: { passwordHash?: string } = {};

  // Handle password update
  if (data.newPassword) {
    // Google users (no passwordHash) can set a password without current password
    if (user.passwordHash) {
      // Existing password user: require current password
      if (!data.currentPassword) {
        throw new AppError('Current password is required to change password', Status.BAD_REQUEST);
      }

      const match = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!match) {
        throw new AppError('Current password is incorrect', Status.UNAUTHORIZED);
      }
    }

    updates.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    return createSuccessResponse({ id: user.id, username: user.username }, 'No changes to update');
  }

  await db.update(schema.usersTable).set(updates).where(eq(schema.usersTable.id, userId));

  return createSuccessResponse(
    { id: user.id, username: user.username },
    'Profile updated successfully'
  );
};

// --- Registration approval ---

export const isSuperadmin = (user: { email?: string | null; username: string }): boolean => {
  // Check by email (for Google OAuth users)
  const superadminEmails = env.SUPERADMIN_EMAILS || '';
  if (user.email && superadminEmails) {
    if (
      superadminEmails
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .includes(user.email.toLowerCase())
    ) {
      return true;
    }
  }
  // Check by username (for password users)
  const superadminUsernames = env.SUPERADMIN_USERNAMES || '';
  if (superadminUsernames) {
    return superadminUsernames
      .split(',')
      .map((u) => u.trim())
      .includes(user.username);
  }
  return false;
};

export const syncSuperadminRole = async (user: {
  id: string;
  role?: string | null;
  email?: string | null;
  username: string;
}): Promise<'admin' | 'user'> => {
  if (isSuperadmin(user) && user.role !== 'admin') {
    await db
      .update(schema.usersTable)
      .set({ role: 'admin' })
      .where(eq(schema.usersTable.id, user.id));
    return 'admin';
  }
  return (user.role as 'admin' | 'user') || 'user';
};

export const getEffectiveRole = (user: {
  role?: string | null;
  email?: string | null;
  username: string;
}): 'admin' | 'user' => {
  if (user.role === 'admin' || isSuperadmin(user)) {
    return 'admin';
  }
  return 'user';
};

export const getUsers = async (statusFilter?: string): Promise<ApiResponse> => {
  let users;
  if (statusFilter) {
    users = await db
      .select({
        id: schema.usersTable.id,
        username: schema.usersTable.username,
        email: schema.usersTable.email,
        name: schema.usersTable.name,
        authProvider: schema.usersTable.authProvider,
        status: schema.usersTable.status,
        role: schema.usersTable.role,
        createdAt: schema.usersTable.created_at
      })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.status, statusFilter as 'pending' | 'active' | 'rejected'))
      .orderBy(schema.usersTable.created_at);
  } else {
    users = await db
      .select({
        id: schema.usersTable.id,
        username: schema.usersTable.username,
        email: schema.usersTable.email,
        name: schema.usersTable.name,
        authProvider: schema.usersTable.authProvider,
        status: schema.usersTable.status,
        role: schema.usersTable.role,
        createdAt: schema.usersTable.created_at
      })
      .from(schema.usersTable)
      .orderBy(schema.usersTable.created_at);
  }

  // Add isSuperadmin flag computed server-side
  const usersWithMeta = users.map((u) => ({
    ...u,
    isSuperadmin: isSuperadmin(u)
  }));

  return createSuccessResponse(usersWithMeta, 'Users retrieved successfully');
};

export const approveUser = async (
  userId: string,
  approverUsername: string,
  approverUserId: string
): Promise<ApiResponse> => {
  const user = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, userId)
    }),
    'User not found'
  );

  const now = new Date().toISOString();
  await db
    .update(schema.usersTable)
    .set({
      status: 'active',
      approvedBy: approverUsername,
      approvedAt: now
    })
    .where(eq(schema.usersTable.id, userId));

  return createSuccessResponse(
    { id: userId, username: user.username, status: 'active' },
    'User approved successfully'
  );
};

export const rejectUser = async (
  userId: string,
  rejectorUsername: string,
  rejectorUserId: string
): Promise<ApiResponse> => {
  // Cannot block yourself
  if (userId === rejectorUserId) {
    throw new AppError('You cannot block yourself', Status.FORBIDDEN);
  }

  const user = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, userId)
    }),
    'User not found'
  );

  // Cannot block a superadmin
  if (isSuperadmin(user)) {
    throw new AppError('Cannot block a superadmin', Status.FORBIDDEN);
  }

  const now = new Date().toISOString();
  await db
    .update(schema.usersTable)
    .set({
      status: 'rejected',
      approvedBy: rejectorUsername,
      approvedAt: now
    })
    .where(eq(schema.usersTable.id, userId));

  return createSuccessResponse(
    { id: userId, username: user.username, status: 'rejected' },
    'User rejected'
  );
};

export const unblockUser = async (
  userId: string,
  unblockerUsername: string,
  unblockerUserId: string
): Promise<ApiResponse> => {
  // Cannot unblock yourself (no-op guard, unblocking self doesn't make sense)
  if (userId === unblockerUserId) {
    throw new AppError('You cannot unblock yourself', Status.FORBIDDEN);
  }

  const user = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, userId)
    }),
    'User not found'
  );

  // Cannot unblock a superadmin (they shouldn't be blocked, but guard anyway)
  if (isSuperadmin(user)) {
    throw new AppError('Cannot unblock a superadmin', Status.FORBIDDEN);
  }

  const now = new Date().toISOString();
  await db
    .update(schema.usersTable)
    .set({
      status: 'active',
      approvedBy: unblockerUsername,
      approvedAt: now
    })
    .where(eq(schema.usersTable.id, userId));

  return createSuccessResponse(
    { id: userId, username: user.username, status: 'active' },
    'User unblocked successfully'
  );
};

export const searchUsers = async (query: string): Promise<ApiResponse> => {
  const users = await db
    .select({
      id: schema.usersTable.id,
      username: schema.usersTable.username,
      name: schema.usersTable.name
    })
    .from(schema.usersTable)
    .where(
      sql`(${schema.usersTable.username} LIKE ${`%${query}%`} OR ${schema.usersTable.name} LIKE ${`%${query}%`}) AND ${schema.usersTable.status} = 'active'`
    )
    .limit(20);

  return createSuccessResponse(users, 'Users retrieved successfully');
};

// --- Role management ---

export const changeUserRole = async (
  targetUserId: string,
  newRole: 'admin' | 'user',
  currentUserId: string
): Promise<ApiResponse> => {
  // Fetch the target user
  const targetUser = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, targetUserId)
    }),
    'User not found'
  );

  // Cannot change own role
  if (targetUserId === currentUserId) {
    throw new AppError('You cannot change your own role', Status.FORBIDDEN);
  }

  // Cannot change superadmins
  if (isSuperadmin(targetUser)) {
    throw new AppError('Cannot change the role of a superadmin', Status.FORBIDDEN);
  }

  // No-op if role is already the target
  if (targetUser.role === newRole) {
    throw new AppError(
      `User is already a${newRole === 'admin' ? 'n' : ''} ${newRole}`,
      Status.BAD_REQUEST
    );
  }

  await db
    .update(schema.usersTable)
    .set({ role: newRole })
    .where(eq(schema.usersTable.id, targetUserId));

  const action = newRole === 'admin' ? 'promoted to admin' : 'demoted to user';
  return createSuccessResponse(
    { id: targetUserId, username: targetUser.username, role: newRole },
    `User ${action} successfully`
  );
};
