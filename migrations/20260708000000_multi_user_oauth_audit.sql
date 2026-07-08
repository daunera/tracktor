PRAGMA foreign_keys = OFF;
--> statement-breakpoint
-- Migration: Multi-user Google OAuth, audit fields, vehicle sharing, registration approval
-- Recreate users table with OAuth fields, status fields, nullable password_hash
CREATE TABLE IF NOT EXISTS users_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO users_v2 (id, username, password_hash, created_at, updated_at)
  SELECT id, username, password_hash, created_at, updated_at FROM users;
--> statement-breakpoint
DROP TABLE users;
--> statement-breakpoint
ALTER TABLE users_v2 RENAME TO users;
--> statement-breakpoint
ALTER TABLE fuel_logs ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE fuel_logs ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE maintenance_logs ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE maintenance_logs ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE insurances ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE insurances ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE pollution_certificates ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE pollution_certificates ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE reminders ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE reminders ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE vehicles ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE vehicles ADD COLUMN updated_by TEXT;
--> statement-breakpoint
ALTER TABLE vehicles ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS vehicle_shares (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
