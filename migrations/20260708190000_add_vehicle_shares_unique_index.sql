PRAGMA foreign_keys = OFF;
--> statement-breakpoint
-- Migration: Add unique index on (vehicle_id, user_id) to vehicle_shares table
-- Prevents duplicate shares for the same user-vehicle pair at the database level
CREATE UNIQUE INDEX `vehicle_shares_vehicleId_userId_unique` ON `vehicle_shares` (`vehicle_id`, `user_id`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
