import type { InventoryMovement, InventoryMovementType } from '@elite/shared';

import { formatCents, formatMoney, toCents } from '@/lib/money';
import { formatQuantity, formatSignedQuantity, quantityMilli } from '@/lib/quantity';

/**
 * Una fila del kardex (spec 065 RN-2), ya lista para pintar.
 *
 * La tabla no decide nada: qué palabra lleva el sello, de qué color, con qué
 * signo va la cantidad, quién la registró, a quién se despachó y de qué lavado
 * o venta sale. Todo eso sale de acá y se prueba acá.
 */

/** Tonos del chip que usa el kardex. Son un subconjunto de los de `Stamp`. */
export type MovementTone = 'green' | 'blue' | 'amber' | 'neutral';

export interface MovementTypeMeta {
  label: string;
  tone: MovementTone;
  /**
   * Color de texto que pisa al del tono. `Stamp` no tiene un azul propio
   * (`blue` es el acero de `--text-dim`), así que la venta toma el azul
   * informativo del sistema y el ajuste baja al gris tenue.
   */
  colorClass?: string;
}

/**
 * Entrada verde, venta azul, devolución azul claro, despacho ámbar y ajuste
 * gris (065 UI); consumo morado y su anulación gris claro (070). El color nunca
 * va solo: el sello siempre lleva la palabra.
 */
export const MOVEMENT_TYPE_META: Record<InventoryMovementType, MovementTypeMeta> = {
  ENTRY: { label: 'Entrada', tone: 'green' },
  SALE: { label: 'Venta', tone: 'blue', colorClass: 'text-info-text' },
  SALE_RETURN: { label: 'Devolución', tone: 'blue' },
  DISPATCH: { label: 'Despacho', tone: 'amber' },
  ADJUSTMENT: { label: 'Ajuste', tone: 'neutral', colorClass: 'text-text-faint' },
  CONSUMPTION: { label: 'Consumo', tone: 'neutral', colorClass: 'text-consume-text' },
  CONSUMPTION_RETURN: { label: 'Consumo anulado', tone: 'neutral' },
};

/** Los tipos que sacan o devuelven algo a nombre de un empleado: «a quién» lo dice. */
const EMPLOYEE_MOVEMENT_TYPES: readonly InventoryMovementType[] = [
  'DISPATCH',
  'CONSUMPTION',
  'CONSUMPTION_RETURN',
];

/** De dónde sale una venta o una devolución: un lavado o una venta suelta, nunca los dos. */
export interface MovementOrigin {
  kind: 'ticket' | 'sale';
  href: string;
  /** «#14» para el lavado, «V-0003» para la venta. */
  label: string;
  /** Para el lector de pantalla: «Abrir el lavado #14». */
  ariaLabel: string;
}

export interface KardexRow {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  type: InventoryMovementType;
  meta: MovementTypeMeta;
  createdAt: string;
  /** `"+10"`, `"−2"`. */
  quantity: string;
  /** `true` si entra, `false` si sale. */
  isIncoming: boolean;
  /** Saldo después, sin ceros de más. */
  balance: string;
  /** Quien registró el movimiento, o `null` si no se pudo atribuir. */
  who: string | null;
  /** `true` si lo registró un empleado desde la tablet (una venta en el lavado). */
  whoIsFloor: boolean;
  /** En un despacho, quien recibió; en un consumo o su anulación, quien lo tomó (070). */
  toWhom: string | null;
  /** Solo en una venta o devolución. */
  origin: MovementOrigin | null;
  /**
   * El porqué: el motivo de un ajuste o de la anulación de un consumo, la nota
   * de un despacho, en una entrada el costo y la factura, y en un consumo el
   * precio congelado y la nota.
   */
  reason: string | null;
  /** La frase de la columna «Detalle» (091). */
  detail: KardexDetail;
}

/**
 * La columna «Detalle» del kardex (091): una frase en vez de cuatro columnas
 * llenas de guiones. `lead` es lo que se lee primero —la factura, el lavado,
 * quién recibió o tomó, el motivo—; `notes` va debajo, tenue.
 */
export interface KardexDetail {
  lead:
    | { kind: 'text'; text: string; muted?: boolean }
    | { kind: 'origin'; prefix?: string; origin: MovementOrigin }
    | { kind: 'person'; prefix: string; name: string; suffix?: string };
  notes: string[];
}

/** El folio del lavado como se grita en la bahía: `CW-0014` → `#14`. */
export function ticketLabel(ticketNumber: string): string {
  const sequence = Number(ticketNumber.slice(ticketNumber.indexOf('-') + 1));

  return Number.isFinite(sequence) && sequence > 0 ? `#${sequence}` : ticketNumber;
}

function originOf(movement: InventoryMovement): MovementOrigin | null {
  if (movement.counterSaleId !== null) {
    const label = movement.saleNumber ?? 'Venta';

    return {
      kind: 'sale',
      href: `/sales/${movement.counterSaleId}`,
      label,
      ariaLabel: `Abrir la venta ${label}`,
    };
  }

  if (movement.workOrderId !== null) {
    const label = movement.ticketNumber === null ? 'Lavado' : ticketLabel(movement.ticketNumber);

    return {
      kind: 'ticket',
      href: `/carwash/${movement.workOrderId}`,
      label,
      ariaLabel: `Abrir el lavado ${label}`,
    };
  }

  return null;
}

function reasonOf(movement: InventoryMovement): string | null {
  if (movement.type === 'ENTRY') {
    const parts = [
      movement.unitCost === null ? null : `${formatMoney(movement.unitCost)} c/u`,
      movement.reference?.trim() || null,
      movement.reason?.trim() || null,
    ].filter((part): part is string => part !== null);

    return parts.length === 0 ? null : parts.join(' · ');
  }

  if (movement.type === 'CONSUMPTION') {
    const parts = [
      movement.unitPrice === null ? null : `${formatMoney(movement.unitPrice)} c/u`,
      movement.reason?.trim() || null,
    ].filter((part): part is string => part !== null);

    return parts.length === 0 ? null : parts.join(' · ');
  }

  return movement.reason?.trim() || null;
}

function notesOf(...parts: (string | null | undefined)[]): string[] {
  return parts.map((part) => part?.trim() ?? '').filter((part) => part !== '');
}

/** Lo que vale un consumo a su precio congelado, con la cantidad sin signo. */
function consumptionValue(movement: InventoryMovement): string | undefined {
  const cents = movement.unitPrice === null ? null : toCents(movement.unitPrice);
  if (cents === null) return undefined;
  const milli = Math.abs(quantityMilli(movement.quantity) ?? 0);

  return formatCents(Math.round((milli * cents) / 1000));
}

/** La frase del «Detalle»: qué fue, con quién y quién lo registró (091). */
export function detailOf(movement: InventoryMovement): KardexDetail {
  const who = movement.createdBy?.fullName ?? null;
  const person = movement.employee?.fullName ?? 'Sin nombre';
  const by = (verb: string) => (who === null ? null : `${verb} ${who}`);

  switch (movement.type) {
    case 'ENTRY': {
      const reference = movement.reference?.trim() ?? '';

      return {
        lead:
          reference === ''
            ? { kind: 'text', text: 'Sin referencia', muted: true }
            : { kind: 'text', text: reference },
        notes: notesOf(
          movement.unitCost === null
            ? 'sin costo'
            : `te costó ${formatMoney(movement.unitCost)} c/u`,
          by('registró'),
          movement.reason,
        ),
      };
    }
    case 'SALE':
    case 'SALE_RETURN': {
      const origin = originOf(movement);
      const isSale = movement.type === 'SALE';
      const seller = by(isSale ? 'vendió' : 'devolvió');
      const floor = movement.createdBy?.kind === 'employee' ? ' · pista' : '';

      return {
        lead:
          origin === null
            ? { kind: 'text', text: isSale ? 'Venta' : 'Devolución' }
            : { kind: 'origin', prefix: isSale ? undefined : 'Devuelto de', origin },
        notes: notesOf(seller === null ? null : `${seller}${floor}`, movement.reason),
      };
    }
    case 'DISPATCH':
      return {
        lead: { kind: 'person', prefix: 'Recibió', name: person },
        notes: notesOf(by('entregó'), movement.reason),
      };
    case 'CONSUMPTION':
      return {
        lead: { kind: 'person', prefix: 'Tomó', name: person, suffix: consumptionValue(movement) },
        notes: notesOf(by('anotó'), movement.reason),
      };
    case 'CONSUMPTION_RETURN':
      return {
        lead: { kind: 'person', prefix: 'Anulado el consumo de', name: person },
        notes: notesOf(movement.reason, by('anuló')),
      };
    case 'ADJUSTMENT': {
      const reason = movement.reason?.trim() ?? '';

      return {
        lead:
          reason === ''
            ? { kind: 'text', text: 'Ajuste', muted: true }
            : { kind: 'text', text: reason },
        notes: notesOf(by('ajustó')),
      };
    }
  }
}

export function toKardexRow(movement: InventoryMovement): KardexRow {
  const milli = quantityMilli(movement.quantity) ?? 0;

  return {
    id: movement.id,
    itemId: movement.itemId,
    itemCode: movement.itemCode,
    itemName: movement.itemName,
    unit: movement.itemUnit,
    type: movement.type,
    meta: MOVEMENT_TYPE_META[movement.type],
    createdAt: movement.createdAt,
    quantity: formatSignedQuantity(movement.quantity),
    isIncoming: milli > 0,
    balance: formatQuantity(movement.balanceAfter),
    who: movement.createdBy?.fullName ?? null,
    whoIsFloor: movement.createdBy?.kind === 'employee',
    toWhom: EMPLOYEE_MOVEMENT_TYPES.includes(movement.type)
      ? (movement.employee?.fullName ?? null)
      : null,
    origin: originOf(movement),
    reason: reasonOf(movement),
    detail: detailOf(movement),
  };
}
