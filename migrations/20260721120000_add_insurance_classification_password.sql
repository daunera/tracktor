PRAGMA foreign_keys = OFF;
--> statement-breakpoint
-- Migration: Add classification and policy document password to insurances
ALTER TABLE insurances ADD COLUMN classification TEXT;
--> statement-breakpoint
ALTER TABLE insurances ADD COLUMN policy_document_password TEXT;
--> statement-breakpoint
PRAGMA foreign_keys = ON;
