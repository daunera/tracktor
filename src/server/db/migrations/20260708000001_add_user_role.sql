PRAGMA foreign_keys = OFF;
--> statement-breakpoint
-- Migration: Add role column (admin/user) to users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
--> statement-breakpoint
PRAGMA foreign_keys = ON;
