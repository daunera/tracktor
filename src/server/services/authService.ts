import bcrypt from 'bcrypt';
import { AppError } from '../exceptions/AppError';
import { Status } from '../exceptions/AppError';
import * as schema from '../db/schema/index';
import { db } from '../db/index';
import { eq, and } from 'drizzle-orm';
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
import { hasPendingInvitations, applyInvitationsOnAuth } from './invitationService';

export const createUser = async (
  username: string,
  password: string,
  email: string
): Promise<ApiResponse> => {
  if (env.DISABLE_PASSWORD_LOGIN) {
    throw new AppError('Password login is disabled.', Status.BAD_REQUEST);
  }

  // Check if username or email already exists
  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.username, username), eq(users.email, email))
  });

  if (existingUser) {
    if (existingUser.username === username) {
      throw new AppError('Username already exists', Status.BAD_REQUEST);
    }
    throw new AppError('Email already exists', Status.BAD_REQUEST);
  }

  // Check if this email has any pending invitation (app or vehicle)
  const invited = email ? await hasPendingInvitations(email) : false;
  if (!invited) {
    throw new AppError(
      'An invitation is required to access the application. Please ask an administrator for an invitation.',
      Status.FORBIDDEN
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.usersTable).values({
    id: userId,
    username,
    passwordHash,
    email,
    authProvider: 'password',
    status: 'active',
    approvedBy: 'invitation',
    approvedAt: now
  });

  // Create a session so the user can log in directly
  const sessionToken = generateSessionToken();
  await createSession(sessionToken, userId);

  // Fulfill all pending invitations (both app and vehicle)
  if (email) {
    await applyInvitationsOnAuth(email, userId);
  }

  return createSuccessResponse({ userId, username, sessionToken }, 'User created successfully.');
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
    // This is a legacy pending user — no auto-approval, they need admin
    throw new AppError(
      'Your registration is pending approval. Please wait for an administrator to approve your account.',
      Status.FORBIDDEN
    );
  } else if (user.status === 'active' && user.email) {
    await applyInvitationsOnAuth(user.email, user.id);
  }

  if (user.status === 'rejected') {
    throw new AppError('Your account has been blocked.', Status.FORBIDDEN);
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
  data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }
): Promise<ApiResponse> => {
  const user = requireRecord(
    await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, userId)
    }),
    'User not found'
  );

  const updates: { name?: string | null; email?: string | null; passwordHash?: string } = {};

  // Handle name update (only for password users)
  if (data.name !== undefined && user.authProvider === 'password') {
    updates.name = data.name || null;
  }

  // Handle email update (only for password users)
  if (data.email !== undefined && user.authProvider === 'password') {
    // Check email uniqueness
    if (data.email) {
      const existingWithEmail = await db.query.usersTable.findFirst({
        where: (users, { eq, and, ne }) => and(eq(users.email, data.email!), ne(users.id, userId))
      });
      if (existingWithEmail) {
        throw new AppError('Email already in use', Status.BAD_REQUEST);
      }
    }
    updates.email = data.email || null;
  }

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
    { id: user.id, username: user.username, name: updates.name, email: updates.email },
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
  // Exact email match only — for sharing invitations
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(query)) {
    return createSuccessResponse([], 'Query must be a valid email address');
  }

  const users = await db
    .select({
      id: schema.usersTable.id,
      username: schema.usersTable.username,
      name: schema.usersTable.name,
      email: schema.usersTable.email
    })
    .from(schema.usersTable)
    .where(and(eq(schema.usersTable.email, query), eq(schema.usersTable.status, 'active')))
    .limit(1);

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
