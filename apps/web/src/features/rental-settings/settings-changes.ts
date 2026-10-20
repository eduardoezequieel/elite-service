import type { RentalSettingsFormValues } from './settings-form';

/**
 * Qué cambió en Ajustes de la renta (120): los campos distintos a lo guardado,
 * la pestaña donde vive cada uno y el texto de la barra de guardar.
 */

export const SETTINGS_SECTIONS = [
  'company',
  'rules',
  'contract',
  'accessories',
  'service',
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** Los campos que se editan a la vista; los avisos del plan, en Servicio (123). */
export type TrackedField = keyof RentalSettingsFormValues;

export const FIELD_LABELS: Record<TrackedField, string> = {
  logoFileId: 'Logo',
  companyName: 'Nombre',
  lessorName: 'Arrendante',
  taxId: 'NIT',
  nrc: 'NRC',
  phones: 'Teléfonos',
  email: 'Correo',
  address: 'Dirección',
  city: 'Ciudad',
  defaultCdwPerDay: 'CDW',
  defaultDeductible: 'Deducible',
  vatRate: 'IVA',
  interestRate: 'Interés',
  lateInterestRate: 'Interés por atraso',
  graceHours: 'Horas de gracia',
  bufferHours: 'Margen entre rentas',
  minDriverAge: 'Edad mínima',
  contractStartNumber: 'Primer contrato',
  contractIntro: 'Introducción',
  clauses: 'Cláusulas',
  accessories: 'Accesorios',
  kmAlert: 'Aviso en km',
  daysAlert: 'Aviso en días',
};

export const SECTION_FIELDS: Record<SettingsSection, readonly TrackedField[]> = {
  company: [
    'logoFileId',
    'companyName',
    'lessorName',
    'taxId',
    'nrc',
    'phones',
    'email',
    'address',
    'city',
  ],
  rules: [
    'defaultCdwPerDay',
    'defaultDeductible',
    'vatRate',
    'interestRate',
    'lateInterestRate',
    'graceHours',
    'bufferHours',
    'minDriverAge',
    'contractStartNumber',
  ],
  contract: ['contractIntro', 'clauses'],
  accessories: ['accessories'],
  service: ['kmAlert', 'daysAlert'],
};

const FIELD_ORDER: readonly TrackedField[] = SETTINGS_SECTIONS.flatMap(
  (section) => SECTION_FIELDS[section],
);

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }

  return a === b;
}

/** Los campos que difieren de lo guardado, en el orden de las pestañas. */
export function changedFields(
  current: RentalSettingsFormValues,
  saved: RentalSettingsFormValues,
): TrackedField[] {
  return FIELD_ORDER.filter((field) => !sameValue(current[field], saved[field]));
}

/** La pestaña de un campo. Acepta rutas de error (`clauses.3`); fuera de la lista, `null`. */
export function sectionOf(field: string): SettingsSection | null {
  const root = field.split('.')[0];

  return (
    SETTINGS_SECTIONS.find((section) => SECTION_FIELDS[section].some((name) => name === root)) ??
    null
  );
}

/** Si alguno de los campos cambiados cae en la pestaña. */
export function sectionHasChanges(
  section: SettingsSection,
  changed: readonly TrackedField[],
): boolean {
  return SECTION_FIELDS[section].some((field) => changed.includes(field));
}

/** Los rótulos, en orden, de los campos que se pueden nombrar. */
function labelsOf(fields: readonly string[]): string[] {
  return FIELD_ORDER.filter((field) => fields.some((name) => name.split('.')[0] === field)).map(
    (field) => FIELD_LABELS[field],
  );
}

export interface BarSummary {
  /** «3 cambios», «Revise 1 campo». */
  title: string;
  /** Los primeros rótulos: «Nombre, NIT, IVA…». */
  detail: string;
}

function listed(labels: readonly string[], max: number): string {
  return labels.slice(0, max).join(', ') + (labels.length > max ? '…' : '');
}

/** El texto de la barra con cambios y sin errores. */
export function changeSummary(changed: readonly TrackedField[]): BarSummary {
  const labels = labelsOf(changed);

  return {
    title: labels.length === 1 ? '1 cambio' : `${labels.length} cambios`,
    detail: listed(labels, 3),
  };
}

/** El texto de la barra con errores: los campos que hay que revisar. */
export function errorSummary(errorFields: readonly string[]): BarSummary {
  const labels = labelsOf(errorFields);
  const count = labels.length;

  return {
    title: count === 1 ? 'Revise 1 campo' : `Revise ${count} campos`,
    detail: listed(labels, 2),
  };
}
