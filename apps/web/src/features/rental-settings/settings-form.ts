import { rentalSettingsSchema } from '@elite/shared';
import type { RentalSettings } from '@elite/shared';
import { z } from 'zod';

import { moneyOrNull, textOrNull, wholeOrNull } from '../rentals/form-draft';

/**
 * El formulario de Ajustes de la rentadora (095). Los números y los montos se
 * escriben como texto; las cláusulas y los accesorios son listas editables.
 * El cuerpo es la fila entera (RN-8): siempre viajan todos los campos.
 */
export interface RentalSettingsFormValues {
  companyName: string;
  taxId: string;
  nrc: string;
  address: string;
  phones: string;
  email: string;
  lessorName: string;
  city: string;
  contractStartNumber: string;
  vatRate: string;
  defaultCdwPerDay: string;
  defaultDeductible: string;
  bufferHours: string;
  graceHours: string;
  minDriverAge: string;
  kmAlert: string;
  daysAlert: string;
  interestRate: string;
  lateInterestRate: string;
  contractIntro: string;
  clauses: string[];
  accessories: string[];
  logoFileId: string | null;
}

const WHOLE_FIELDS = [
  'contractStartNumber',
  'bufferHours',
  'graceHours',
  'minDriverAge',
  'kmAlert',
  'daysAlert',
] as const;

const TEXT_FIELDS = ['taxId', 'nrc', 'address', 'phones', 'email'] as const;

export function settingsFormValuesOf(settings: RentalSettings): RentalSettingsFormValues {
  return {
    companyName: settings.companyName,
    taxId: settings.taxId ?? '',
    nrc: settings.nrc ?? '',
    address: settings.address ?? '',
    phones: settings.phones ?? '',
    email: settings.email ?? '',
    lessorName: settings.lessorName,
    city: settings.city,
    contractStartNumber: String(settings.contractStartNumber),
    vatRate: settings.vatRate,
    defaultCdwPerDay: settings.defaultCdwPerDay ?? '',
    defaultDeductible: settings.defaultDeductible ?? '',
    bufferHours: String(settings.bufferHours),
    graceHours: String(settings.graceHours),
    minDriverAge: String(settings.minDriverAge),
    kmAlert: String(settings.kmAlert),
    daysAlert: String(settings.daysAlert),
    interestRate: settings.interestRate ?? '',
    lateInterestRate: settings.lateInterestRate ?? '',
    contractIntro: settings.contractIntro,
    clauses: [...settings.clauses],
    accessories: [...settings.accessories],
    logoFileId: settings.logoFileId,
  };
}

/** El cuerpo del `PUT`. Las cláusulas y accesorios en blanco se descartan. */
export function settingsDraft(values: RentalSettingsFormValues): Record<string, unknown> {
  const draft: Record<string, unknown> = {
    companyName: values.companyName,
    lessorName: values.lessorName,
    city: values.city,
    vatRate: values.vatRate.trim().replace(',', '.') || '0',
    defaultCdwPerDay: moneyOrNull(values.defaultCdwPerDay),
    defaultDeductible: moneyOrNull(values.defaultDeductible),
    interestRate: moneyOrNull(values.interestRate),
    lateInterestRate: moneyOrNull(values.lateInterestRate),
    contractIntro: values.contractIntro,
    clauses: values.clauses.map((clause) => clause.trim()).filter((clause) => clause !== ''),
    accessories: values.accessories.map((item) => item.trim()).filter((item) => item !== ''),
    logoFileId: values.logoFileId,
  };

  for (const field of TEXT_FIELDS) draft[field] = textOrNull(values[field]);
  for (const field of WHOLE_FIELDS) draft[field] = wholeOrNull(values[field]) ?? undefined;

  return draft;
}

export const rentalSettingsFormSchema = z
  .custom<RentalSettingsFormValues>()
  .transform(settingsDraft)
  .pipe(rentalSettingsSchema);

/** Mueve un elemento de la lista una posición; fuera de rango, la lista igual. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from < 0 || from >= items.length) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);

  return next;
}
