import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';
import { vehicleTable } from './vehicle';
import { usersTable } from './auth';
import { timestamps } from './audit';

export const invitationTable = table('invitations', {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: t.text().notNull(),
  invitedBy: t
    .text()
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  vehicleId: t.text().references(() => vehicleTable.id, { onDelete: 'cascade' }),
  role: t.text({ enum: ['viewer', 'editor'] }).default('editor'),
  status: t
    .text({ enum: ['pending', 'fulfilled', 'expired'] })
    .notNull()
    .default('pending'),
  ...timestamps
});
