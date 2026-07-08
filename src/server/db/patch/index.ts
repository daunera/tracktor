import { logger } from '$server/config/index';
import { db } from '$server/db/index';
import { sql } from 'drizzle-orm';

/**
 * Database patch to add missing columns to fuel_logs table
 * Adds 'filled' and 'missed_last' columns if they don't exist
 */
export async function applyPatches(): Promise<void> {
  try {
    await addFuelLogColumns();
    await backfillExistingVehicles();
    await setExistingUsersActive();
  } catch (error) {
    logger.error('Error while applying database patches : ', error);
    throw error;
  }
}

/**
 * Add filled and missed_last columns to fuel_logs table if they don't exist
 */
async function addFuelLogColumns(): Promise<void> {
  // First check if the fuel_logs table exists
  const tableExists = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name='fuel_logs'`
  );

  if (tableExists.length === 0) {
    return;
  }

  // Check if columns exist by querying table info
  const tableInfo = await db.all(sql`PRAGMA table_info(fuel_logs)`);

  const existingColumns = tableInfo.map((col: any) => col.name);
  const hasFilledColumn = existingColumns.includes('filled');
  const hasMissedLastColumn = existingColumns.includes('missed_last');

  if (!hasFilledColumn) {
    logger.info("Adding 'filled' column to fuel_logs table...");
    await db.run(sql`ALTER TABLE fuel_logs ADD COLUMN filled INTEGER DEFAULT 1 NOT NULL`);
    logger.info("Successfully added 'filled' column");
  }

  if (!hasMissedLastColumn) {
    logger.info("Adding 'missed_last' column to fuel_logs table...");
    await db.run(sql`ALTER TABLE fuel_logs ADD COLUMN missed_last INTEGER DEFAULT 0 NOT NULL`);
    logger.info("Successfully added 'missed_last' column");
  }
}

/**
 * Backfill existing vehicles with the first user's ID
 * Only runs if there are vehicles with user_id = 'legacy' (the temporary default)
 */
async function backfillExistingVehicles(): Promise<void> {
  const tableInfo = await db.all(sql`PRAGMA table_info(vehicles)`);
  const columns = tableInfo.map((col: any) => col.name);

  if (!columns.includes('user_id')) {
    return;
  }

  // Check if any legacy vehicles exist
  const legacyVehicles = (await db.all(
    sql`SELECT COUNT(*) as count FROM vehicles WHERE user_id = 'legacy'`
  )) as { count: number }[];

  if (legacyVehicles[0].count === 0) {
    return;
  }

  // Find the first user in the database
  const users = (await db.all(sql`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`)) as {
    id: string;
  }[];

  if (users.length === 0) {
    logger.warn('No users found to backfill vehicles. Skipping vehicle backfill.');
    return;
  }

  const firstUserId = users[0].id;
  logger.info(`Backfilling ${legacyVehicles[0].count} vehicles with user_id = ${firstUserId}...`);

  await db.run(sql`UPDATE vehicles SET user_id = ${firstUserId} WHERE user_id = 'legacy'`);
  logger.info('Vehicle backfill completed.');
}

/**
 * Set all existing users to status = 'active' if they have the default 'pending' status
 */
async function setExistingUsersActive(): Promise<void> {
  const tableInfo = await db.all(sql`PRAGMA table_info(users)`);
  const columns = tableInfo.map((col: any) => col.name);

  if (!columns.includes('status')) {
    return;
  }

  const result = await db.run(sql`UPDATE users SET status = 'active' WHERE status = 'pending'`);
  logger.info(`Set existing users to active status.`);
}
