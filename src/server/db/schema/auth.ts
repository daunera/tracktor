import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';
import { timestamps } from './audit';

// Users table for username/password authentication
export const usersTable = table('users', {
  id: t.text().primaryKey(),
  username: t.text().notNull().unique(),
  passwordHash: t.text(), // nullable — Google users have no password
  email: t.text().unique(), // nullable; required for Google users
  name: t.text(), // display name from Google
  avatarUrl: t.text(), // Google profile picture
  googleId: t.text().unique(), // Google account ID, nullable
  authProvider: t
    .text({ enum: ['password', 'google'] })
    .notNull()
    .default('password'),
  role: t
    .text({ enum: ['admin', 'user'] })
    .notNull()
    .default('user'),
  status: t
    .text({ enum: ['pending', 'active', 'rejected'] })
    .notNull()
    .default('pending'), // default pending for safety
  approvedBy: t.text(), // username of who approved (plain text)
  approvedAt: t.text(), // timestamp of approval
  ...timestamps
});

// Sessions table for session management
export const sessionsTable = table('sessions', {
  id: t.text().primaryKey(),
  userId: t
    .text()
    .notNull()
    .references(() => usersTable.id),
  expiresAt: t.integer().notNull(),
  ...timestamps
});

// Keep the old auth table for migration purposes (can be removed later)
export const authTable = table('auth', {
  id: t.integer().primaryKey(),
  hash: t.text().notNull(),
  ...timestamps
});
