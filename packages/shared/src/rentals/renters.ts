import { z } from 'zod';

import { civilDateSchema, queryFlagSchema } from '../schemas';

/**
 * spec 095 — Clientes de renta: lo que devuelve `/api/renters`.
 *
 * Son otra tabla que los clientes del lavado (RN-1). Tienen lo que pide el
 * contrato: documento, licencia y su vencimiento, nacimiento y país. Se
 * desactivan o se bloquean («No rentar»), nunca se borran (RN-6).
 */

export interface Renter {
  id: string;
  fullName: string;
  /** DUI o pasaporte. */
  documentId: string | null;
  licenseNumber: string | null;
  /** Fecha civil `YYYY-MM-DD`. */
  licenseExpiresAt: string | null;
  birthDate: string | null;
  country: string | null;
  mobilePhone: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  occupation: string | null;
  workplace: string | null;
  permanentAddress: string | null;
  permanentPhone: string | null;
  representative: string | null;
  isActive: boolean;
  /** «No rentar»: la 096 rechaza una renta nueva con `RENTER_BLOCKED` (RN-6). */
  isBlocked: boolean;
  blockReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} no puede pasar de ${max} caracteres.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const optionalEmail = z
  .union([z.literal(''), z.email({ message: 'Escribí un correo válido.' }).trim().toLowerCase()])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const optionalDate = civilDateSchema.nullable().optional();

const renterShape = {
  fullName: z
    .string()
    .trim()
    .min(1, { message: 'Escribí el nombre.' })
    .max(120, { message: 'El nombre no puede pasar de 120 caracteres.' }),
  documentId: optionalText(30, 'El documento'),
  licenseNumber: optionalText(30, 'La licencia'),
  licenseExpiresAt: optionalDate,
  birthDate: optionalDate,
  country: optionalText(60, 'El país'),
  mobilePhone: optionalText(30, 'El celular'),
  phone: optionalText(30, 'El teléfono'),
  email: optionalEmail,
  address: optionalText(300, 'La dirección'),
  occupation: optionalText(80, 'La ocupación'),
  workplace: optionalText(120, 'El lugar de trabajo'),
  permanentAddress: optionalText(300, 'La dirección permanente'),
  permanentPhone: optionalText(30, 'El teléfono permanente'),
  representative: optionalText(120, 'El representante'),
  isBlocked: z.boolean(),
  blockReason: optionalText(300, 'El motivo'),
  notes: optionalText(1000, 'La nota'),
};

export const createRenterSchema = z.object({
  ...renterShape,
  isBlocked: renterShape.isBlocked.default(false),
});
export type CreateRenterInput = z.infer<typeof createRenterSchema>;

/** `PATCH /renters/:id`. Lo que no viene no se toca; `null` borra el dato. */
export const updateRenterSchema = z.object({ ...renterShape, isActive: z.boolean() }).partial();
export type UpdateRenterInput = z.infer<typeof updateRenterSchema>;

/** `GET /renters?q&blocked&active`. `q` busca en nombre, documento, licencia y teléfonos. */
export const rentersQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  blocked: queryFlagSchema.optional(),
  active: queryFlagSchema.optional(),
});
export type RentersQuery = z.infer<typeof rentersQuerySchema>;

/** Tope de filas de una importación: un Excel de clientes, no una base entera. */
export const RENTER_IMPORT_MAX_ROWS = 2000;

/**
 * `POST /renters/import` (RN-9): el web parsea el CSV y manda cada fila como
 * `{ encabezado: valor }`. El API reconoce las columnas por nombre flexible.
 */
export const importRentersSchema = z.object({
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, { message: 'El archivo no trae filas.' })
    .max(RENTER_IMPORT_MAX_ROWS, {
      message: `No más de ${RENTER_IMPORT_MAX_ROWS} filas por importación.`,
    }),
});
export type ImportRentersInput = z.infer<typeof importRentersSchema>;

export interface RenterImportSkip {
  /** La fila del archivo, contando el encabezado como la 1: la primera de datos es la 2. */
  row: number;
  reason: string;
}

export interface RenterImportResult {
  created: number;
  skipped: RenterImportSkip[];
}

/** Las columnas que se reconocen al importar. */
export type RenterImportField =
  | 'fullName'
  | 'documentId'
  | 'licenseNumber'
  | 'licenseExpiresAt'
  | 'mobilePhone'
  | 'phone'
  | 'email'
  | 'address'
  | 'birthDate'
  | 'country'
  | 'notes';

/** Nombres aceptados por columna, ya normalizados (minúsculas, sin tildes ni signos). */
const IMPORT_ALIASES: Record<RenterImportField, readonly string[]> = {
  fullName: ['nombre', 'nombres', 'nombrecompleto', 'cliente', 'fullname', 'name'],
  documentId: ['dui', 'documento', 'nodocumento', 'pasaporte', 'documentid', 'nit'],
  licenseNumber: ['licencia', 'nolicencia', 'numerolicencia', 'numerodelicencia', 'license'],
  licenseExpiresAt: [
    'vencimientolicencia',
    'vencimientodelicencia',
    'licenciavence',
    'vencelicencia',
    'vencimiento',
  ],
  mobilePhone: ['celular', 'movil', 'whatsapp', 'mobile', 'cel'],
  phone: ['telefono', 'tel', 'phone', 'telefonofijo'],
  email: ['email', 'correo', 'correoelectronico', 'mail', 'email1'],
  address: ['direccion', 'domicilio', 'address'],
  birthDate: ['nacimiento', 'fechanacimiento', 'fechadenacimiento', 'birthdate'],
  country: ['pais', 'nacionalidad', 'country'],
  notes: ['notas', 'nota', 'observaciones', 'comentarios'],
};

/** `"Fecha de nacimiento"` → `"fechadenacimiento"`. */
export function normalizeImportHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** La columna que reconoce un encabezado, o `null` si no es ninguna. */
export function renterImportFieldOf(header: string): RenterImportField | null {
  const normalized = normalizeImportHeader(header);
  const fields = Object.keys(IMPORT_ALIASES) as RenterImportField[];

  return fields.find((field) => IMPORT_ALIASES[field].includes(normalized)) ?? null;
}

/**
 * Una fecha de planilla a `YYYY-MM-DD`: acepta `2026-03-05`, `05/03/2026` y
 * `5-3-2026` (día primero, como se escribe acá). Vacía o ilegible, `null`.
 */
export function importDateOf(value: string): string | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;

  if (parts === null) return null;

  const [year = '', month = '', day = ''] = parts;
  const civil = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${civil}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === civil ? civil : null;
}

const DATE_FIELDS: readonly RenterImportField[] = ['birthDate', 'licenseExpiresAt'];

/**
 * Una fila de la planilla convertida en alta, o el motivo por el que se
 * omite (RN-9). Sin nombre, se omite. Una fecha ilegible se omite la fila: es
 * mejor que la persona la corrija a que el cliente quede con un dato falso.
 */
export function renterFromImportRow(
  row: Record<string, string>,
): { input: CreateRenterInput } | { reason: string } {
  const draft: Partial<Record<RenterImportField, string>> = {};

  for (const [header, value] of Object.entries(row)) {
    const field = renterImportFieldOf(header);
    const text = value.trim();

    if (field === null || text === '' || draft[field] !== undefined) continue;

    if (DATE_FIELDS.includes(field)) {
      const civil = importDateOf(text);
      if (civil === null) return { reason: `La fecha «${text}» no se entiende.` };
      draft[field] = civil;
    } else {
      draft[field] = text;
    }
  }

  if (draft.fullName === undefined) return { reason: 'Sin nombre.' };

  const parsed = createRenterSchema.safeParse(draft);

  if (!parsed.success) return { reason: parsed.error.issues[0]?.message ?? 'Fila inválida.' };

  return { input: parsed.data };
}
