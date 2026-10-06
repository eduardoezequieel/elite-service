import { INSPECTION_ZONES } from '@elite/shared';
import type { InspectionZone, RentalAgreement, RentalInspection } from '@elite/shared';

import { instantToCivil, instantToField } from '@/features/rentals/datetime';
import { formatCivil, isCivil } from '@/lib/civil-date';
import { toCents } from '@/lib/money';

/**
 * Lo puro de los documentos impresos de una renta (097): número de contrato,
 * orden de las páginas, fechas del papel y la cuenta del anverso.
 */

// ---------------------------------------------------------------------------
// Número de contrato (RN-2)
// ---------------------------------------------------------------------------

/** `733` → `"0733"`; sin número, vacío (la línea queda para escribir a mano). */
export function formatContractNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';

  return String(Math.trunc(value)).padStart(4, '0');
}

// ---------------------------------------------------------------------------
// Opciones de impresión y orden de páginas
// ---------------------------------------------------------------------------

export const PRINT_SETS = ['both', 'original'] as const;
export type PrintSets = (typeof PRINT_SETS)[number];

export interface PrintOptions {
  /** Original y copia, o solo el original. */
  sets: PrintSets;
  /** La impresora da vuelta la hoja: el reverso cae al dorso del anverso. */
  duplex: boolean;
  /** Agregar la hoja de inspección a cada juego. */
  includeInspection: boolean;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  sets: 'both',
  duplex: false,
  includeInspection: true,
};

/** La clave de `localStorage` donde el navegador recuerda las opciones (RN-4). */
export const PRINT_OPTIONS_STORAGE_KEY = 'elite.rental-documents.print-options';

/** Lo guardado en `localStorage` → opciones válidas; lo roto cae al valor por defecto. */
export function parsePrintOptions(raw: string | null | undefined): PrintOptions {
  if (raw === null || raw === undefined || raw === '') return { ...DEFAULT_PRINT_OPTIONS };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PRINT_OPTIONS };
  }
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PRINT_OPTIONS };

  const record = value as Record<string, unknown>;
  const sets = PRINT_SETS.find((option) => option === record.sets);

  return {
    sets: sets ?? DEFAULT_PRINT_OPTIONS.sets,
    duplex: typeof record.duplex === 'boolean' ? record.duplex : DEFAULT_PRINT_OPTIONS.duplex,
    includeInspection:
      typeof record.includeInspection === 'boolean'
        ? record.includeInspection
        : DEFAULT_PRINT_OPTIONS.includeInspection,
  };
}

export type DocumentCopy = 'original' | 'copy';

export const COPY_LABELS: Record<DocumentCopy, string> = {
  original: 'ORIGINAL · Arrendante',
  copy: 'COPIA · Arrendatario',
};

export type PageKind = 'contract-front' | 'contract-back' | 'inspection' | 'blank';

export interface PrintPage {
  kind: PageKind;
  copy: DocumentCopy;
}

/**
 * Las caras a imprimir, en orden. Cada juego es anverso → reverso → hoja de
 * inspección. A doble cara el reverso ya cae al dorso del anverso; si el juego
 * queda con un número impar de caras, una en blanco hace que el juego
 * siguiente empiece en una hoja nueva (y la inspección no quede al dorso de
 * otro contrato). A una cara, todas en secuencia.
 */
export function pageOrder(options: PrintOptions, sheet: 'all' | 'inspection' = 'all'): PrintPage[] {
  const copies: DocumentCopy[] = options.sets === 'both' ? ['original', 'copy'] : ['original'];

  if (sheet === 'inspection') {
    return copies.map((copy) => ({ kind: 'inspection', copy }));
  }

  const pages: PrintPage[] = [];

  copies.forEach((copy, index) => {
    const set: PrintPage[] = [
      { kind: 'contract-front', copy },
      { kind: 'contract-back', copy },
    ];
    if (options.includeInspection) set.push({ kind: 'inspection', copy });

    const isLast = index === copies.length - 1;
    if (options.duplex && set.length % 2 === 1 && !isLast) set.push({ kind: 'blank', copy });

    pages.push(...set);
  });

  return pages;
}

/** Hojas de papel que salen: a doble cara, dos caras por hoja. */
export function sheetCount(options: PrintOptions): number {
  const faces = pageOrder(options).length;

  return options.duplex ? Math.ceil(faces / 2) : faces;
}

// ---------------------------------------------------------------------------
// Fechas del papel (RN-3): dd/mm/aaaa y h:mm a. m., en la hora del taller
// ---------------------------------------------------------------------------

/** Un día civil o un instante ISO → `dd/mm/aaaa`. Vacío si no hay. */
export function paperDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (isCivil(value)) return formatCivil(value);
  if (Number.isNaN(Date.parse(value))) return '';

  return formatCivil(instantToCivil(value));
}

/** Un instante ISO → `h:mm a. m.` / `h:mm p. m.` en El Salvador. */
export function paperTime(iso: string | null | undefined): string {
  const field = instantToField(iso);
  if (field === '') return '';

  const hours = Number(field.slice(11, 13));
  const minutes = field.slice(14, 16);

  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'p. m.' : 'a. m.'}`;
}

const MONTH_NAME = new Intl.DateTimeFormat('es-SV', { month: 'long', timeZone: 'UTC' });

/** El día, el mes en letras y el año de un instante, para el pie del pagaré. */
export function paperDateParts(iso: string): { day: string; month: string; year: string } {
  const civil = instantToCivil(iso);
  const [year = '', month = '1', day = ''] = civil.split('-');

  return {
    day: String(Number(day)),
    month: MONTH_NAME.format(Date.UTC(Number(year), Number(month) - 1, 1)),
    year,
  };
}

/** La introducción del contrato con el arrendante puesto en `{ARRENDANTE}`. */
export function contractIntro(intro: string, lessorName: string): string {
  return intro.replaceAll('{ARRENDANTE}', lessorName);
}

// ---------------------------------------------------------------------------
// La cuenta del anverso
// ---------------------------------------------------------------------------

export interface ContractMoney {
  rentalCents: number;
  cdwCents: number;
  /** Combustible, daños, km extra, multas cargadas y otros: lo que cierra el total. */
  otherChargesCents: number;
  discountCents: number;
  /** Con IVA incluido, la base y el impuesto; sin IVA, `vatCents` es 0. */
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
}

const cents = (amount: string | null | undefined) =>
  amount === null || amount === undefined ? 0 : (toCents(amount) ?? 0);

/**
 * La cuenta tal como la lee el papel. «Otros cargos» se deduce del total del
 * API (que ya suma cargos, km extra y multas) para que las filas cierren con
 * él. Si el precio incluye IVA, el total se parte en base e impuesto.
 */
export function contractMoney(
  agreement: Pick<
    RentalAgreement,
    'dailyRate' | 'cdwPerDay' | 'billableDays' | 'discount' | 'includesVat' | 'totals'
  >,
  vatRate: string,
): ContractMoney {
  const days = Math.max(0, Math.trunc(agreement.billableDays));
  const rentalCents = cents(agreement.dailyRate) * days;
  const cdwCents = cents(agreement.cdwPerDay) * days;
  const discountCents = cents(agreement.discount);
  const totalCents = cents(agreement.totals.total);
  const paidCents = cents(agreement.totals.paid);
  const otherChargesCents = Math.max(0, totalCents - rentalCents - cdwCents + discountCents);
  const rate = Number(vatRate);
  const vatCents =
    agreement.includesVat && Number.isFinite(rate) && rate > 0
      ? totalCents - Math.round(totalCents / (1 + rate / 100))
      : 0;

  return {
    rentalCents,
    cdwCents,
    otherChargesCents,
    discountCents,
    subtotalCents: totalCents - vatCents,
    vatCents,
    totalCents,
    paidCents,
    pendingCents: Math.max(0, totalCents - paidCents),
  };
}

// ---------------------------------------------------------------------------
// Daños de la hoja de inspección
// ---------------------------------------------------------------------------

export interface DamageRow {
  number: number;
  zone: InspectionZone;
  /** Lo anotado al salir, `null` si la zona salió sana. */
  atPickup: string | null;
  /** Lo anotado al regresar, `null` si no se marcó (o no hubo regreso). */
  atReturn: string | null;
  /** Marcado al regresar en una zona que salió sana. */
  isNew: boolean;
}

/**
 * Las zonas con daño en la salida o en el regreso, numeradas en el orden fijo
 * de las zonas (el mismo número en el diagrama y en la lista).
 */
export function damageRows(
  pickup: Pick<RentalInspection, 'damages'> | null,
  returned: Pick<RentalInspection, 'damages'> | null,
): DamageRow[] {
  const before = new Map((pickup?.damages ?? []).map((damage) => [damage.zone, damage]));
  const after = new Map((returned?.damages ?? []).map((damage) => [damage.zone, damage]));

  return INSPECTION_ZONES.filter((zone) => before.has(zone) || after.has(zone)).map(
    (zone, index) => {
      const out = before.get(zone);
      const back = after.get(zone);

      return {
        number: index + 1,
        zone,
        atPickup: out === undefined ? null : out.description || 'Sí',
        atReturn:
          back === undefined
            ? null
            : out !== undefined
              ? back.description && back.description !== out.description
                ? back.description
                : 'Igual'
              : back.description || 'Nuevo',
        isNew: back !== undefined && out === undefined,
      };
    },
  );
}
