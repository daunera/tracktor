import { parseDate } from '$lib/helper/format.helper';
import { z } from 'zod';

export const INSURANCE_RECURRENCE_TYPES = {
  none: 'none',
  yearly: 'yearly',
  monthly: 'monthly',
  no_end: 'no_end'
} as const;

export const BONUS_MALUS_TYPES = [
  'B10',
  'B09',
  'B08',
  'B07',
  'B06',
  'B05',
  'B04',
  'B03',
  'B02',
  'B01',
  'A00',
  'M01',
  'M02',
  'M03',
  'M04'
] as const;

export type BonusMalusType = (typeof BONUS_MALUS_TYPES)[number];

/**
 * Returns the next (improved) bonus-malus level for a new insurance policy.
 * - `'A00'` is returned when there's no previous classification.
 * - The level improves by one step toward `'B10'` (best).
 * - Already at `'B10'` stays at `'B10'`.
 */
export function getNextBonusMalus(current: BonusMalusType | null): BonusMalusType {
  if (!current) return 'A00';
  const index = BONUS_MALUS_TYPES.indexOf(current);
  if (index <= 0) return BONUS_MALUS_TYPES[0]; // already at best (B10)
  return BONUS_MALUS_TYPES[index - 1]; // improve by one level
}

// Helper function to get localized insurance recurrence type label
export function getInsuranceRecurrenceTypeLabel(type: string, m: any): string {
  switch (type) {
    case 'none':
      return m.insurance_recurrence_type_fixed();
    case 'yearly':
      return m.insurance_recurrence_type_yearly();
    case 'monthly':
      return m.insurance_recurrence_type_monthly();
    case 'no_end':
      return m.insurance_recurrence_type_no_end();
    default:
      return m.insurance_recurrence_type_fixed();
  }
}

export interface Insurance {
  id: string | null;
  vehicleId: string;
  provider: string;
  policyNumber: string;
  startDate: Date;
  endDate: Date | null;
  recurrenceType: keyof typeof INSURANCE_RECURRENCE_TYPES;
  recurrenceInterval: number;
  cost: number;
  notes: string | null;
  attachment: string | null;
  classification: BonusMalusType | null;
  attachmentPassword: string | null;
}

const insuranceRecurrenceOptions = Object.keys(
  INSURANCE_RECURRENCE_TYPES
) as (keyof typeof INSURANCE_RECURRENCE_TYPES)[];

export const insuranceSchema = z.object({
  id: z.string().nullable(),
  vehicleId: z.uuid(),
  provider: z
    .string()
    .min(2, 'It must be more than 1 character.')
    .max(100, 'It must be less than 100 characters.'),
  policyNumber: z
    .string()
    .min(2, 'It must be more than 1 character.')
    .max(50, 'It must be less than 50 characters.'),
  startDate: z.string().refine((val) => {
    try {
      parseDate(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid date format'),
  endDate: z.string().nullable().optional(),
  recurrenceType: z
    .enum(
      insuranceRecurrenceOptions as [
        keyof typeof INSURANCE_RECURRENCE_TYPES,
        ...Array<keyof typeof INSURANCE_RECURRENCE_TYPES>
      ]
    )
    .default('no_end'),
  recurrenceInterval: z.number().int().positive().default(1),
  cost: z.float32().positive(),
  notes: z.string().nullable(),
  attachment: z.string().nullable(),
  classification: z
    .enum([...BONUS_MALUS_TYPES] as [BonusMalusType, ...BonusMalusType[]])
    .nullable(),
  attachmentPassword: z.string().nullable()
});

export type InsuranceSchema = typeof insuranceSchema;
