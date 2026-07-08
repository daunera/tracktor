import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';
import { usersTable } from './auth';
import { timestamps, auditUser } from './audit';

export const vehicleTable = table('vehicles', {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  make: t.text().notNull(),
  model: t.text().notNull(),
  year: t.integer().notNull(),
  licensePlate: t.text(),
  vin: t.text(),
  color: t.text(),
  odometer: t.integer(),
  image: t.text(),
  fuelType: t
    .text({
      enum: ['petrol', 'diesel', 'electric', 'lpg', 'cng']
    })
    .notNull()
    .default('petrol'),
  customFields: t.text(),
  userId: t
    .text()
    .notNull()
    .references(() => usersTable.id),
  ...timestamps,
  ...auditUser
});
