import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';
import { vehicleTable } from './vehicle';
import { usersTable } from './auth';
import { timestamps } from './audit';

export const vehicleShareTable = table(
  'vehicle_shares',
  {
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    vehicleId: t
      .text()
      .notNull()
      .references(() => vehicleTable.id, { onDelete: 'cascade' }),
    userId: t
      .text()
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: t
      .text({ enum: ['viewer', 'editor'] })
      .notNull()
      .default('viewer'),
    ...timestamps
  },
  (table) => ({
    vehicleUserUnique: t
      .uniqueIndex('vehicle_shares_vehicleId_userId_unique')
      .on(table.vehicleId, table.userId)
  })
);
