import {
  agreementTotals,
  centsToMoney,
  depositHeldOf,
  derivedStatus,
  intervalsClash,
  moneyToCents,
  occupiedInterval,
} from '@elite/shared';
import type {
  AgreementSlot,
  AgreementStatus,
  Interval,
  PaymentMethod,
  RentalAgreement,
} from '@elite/shared';

/**
 * spec 096 — Las reglas de una renta que no dependen de dónde se guarda: qué
 * acción vale en qué estado (RN-1), el choque de fechas (RN-2) y el número de
 * contrato (RN-3). Sin Nest ni Prisma.
 */

/** Una renta tal como la guarda el repositorio: el DTO sin lo que se calcula. */
export type AgreementRecord = Omit<RentalAgreement, 'derivedStatus' | 'totals' | 'depositHeld'>;

/** Lo que se le puede hacer a una renta. */
export type AgreementAction =
  'update' | 'checkout' | 'checkin' | 'extend' | 'swap' | 'reassign' | 'cancel';

/** Por qué una acción no vale en el estado de la renta. */
export type TransitionBlock = 'CLOSED' | 'NOT_RESERVED' | 'NOT_IN_PROGRESS';

const ONLY_RESERVED: readonly AgreementAction[] = ['checkout', 'reassign'];
const ONLY_IN_PROGRESS: readonly AgreementAction[] = ['checkin', 'extend', 'swap'];

/**
 * RN-1: `RESERVED → IN_PROGRESS → FINISHED`, `RESERVED → CANCELLED` e
 * `IN_PROGRESS → CANCELLED` (sin pagos, lo mira el caso de uso). Una renta
 * cerrada no acepta nada.
 */
export function transitionBlock(
  status: AgreementStatus,
  action: AgreementAction,
): TransitionBlock | null {
  if (status === 'FINISHED' || status === 'CANCELLED') return 'CLOSED';
  if (status === 'IN_PROGRESS' && ONLY_RESERVED.includes(action)) return 'NOT_RESERVED';
  if (status === 'RESERVED' && ONLY_IN_PROGRESS.includes(action)) return 'NOT_IN_PROGRESS';
  return null;
}

/** RN-3: el siguiente número de contrato, nunca menor que el inicial de ajustes. */
export function nextContractNumber(currentMax: number | null, startNumber: number): number {
  return currentMax === null ? startNumber : Math.max(currentMax + 1, startNumber);
}

/** La primera renta que choca con `candidate` (RN-2), o `null`. */
export function findClash(
  candidate: Interval,
  occupying: readonly AgreementRecord[],
  bufferMs: number,
  now: Date,
): AgreementRecord | null {
  return (
    occupying.find(
      (agreement) =>
        (agreement.status === 'RESERVED' || agreement.status === 'IN_PROGRESS') &&
        intervalsClash(occupiedInterval(agreement, now), candidate, bufferMs),
    ) ?? null
  );
}

/** `true` si la renta tiene algún pago sin anular. */
export function hasLivePayments(record: Pick<AgreementRecord, 'payments'>): boolean {
  return record.payments.some((payment) => payment.voidedAt === null);
}

/** El DTO completo: estado derivado, totales (RN-10) y depósito retenido. */
export function toRentalAgreement(record: AgreementRecord, now: Date): RentalAgreement {
  const finesCharged = record.fines
    .filter((fine) => fine.chargedToCustomer)
    .reduce((sum, fine) => sum + moneyToCents(fine.amount), 0);

  return {
    ...record,
    derivedStatus: derivedStatus(record, now),
    totals: agreementTotals({
      dailyRate: record.dailyRate,
      cdwPerDay: record.cdwPerDay,
      billableDays: record.billableDays,
      extraCharges: record.extraCharges,
      extraKmCharge: record.extraKmCharge,
      finesCharged: centsToMoney(finesCharged),
      discount: record.discount,
      payments: record.payments,
    }),
    depositHeld: depositHeldOf(record),
  };
}

/** El resumen que pintan el calendario y la disponibilidad. */
export function toSlot(record: AgreementRecord, now: Date): AgreementSlot {
  const interval = occupiedInterval(record, now);

  return {
    id: record.id,
    contractNumber: record.contractNumber,
    status: record.status,
    derivedStatus: derivedStatus(record, now),
    customerName: record.customer.fullName,
    plannedPickupAt: record.plannedPickupAt,
    plannedReturnAt: record.plannedReturnAt,
    actualPickupAt: record.actualPickupAt,
    actualReturnAt: record.actualReturnAt,
    start: interval.start.toISOString(),
    end: interval.end.toISOString(),
  };
}

/**
 * El inicio de un día civil en la hora del taller. El Salvador está en
 * UTC−6 todo el año (no cambia de hora), así que el desfase es fijo.
 */
export function civilDayStart(civil: string): Date {
  return new Date(`${civil}T00:00:00-06:00`);
}

/** El inicio del día siguiente: el fin, excluido, de un rango de días civiles. */
export function civilDayEnd(civil: string): Date {
  return new Date(civilDayStart(civil).getTime() + 24 * 60 * 60 * 1000);
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

/**
 * La nota de la devolución del depósito. El schema no tiene columna para el
 * método de la devolución, así que viaja escrito al frente de la nota.
 */
export function depositReturnNoteOf(
  method: PaymentMethod | null | undefined,
  note: string | null | undefined,
): string | null {
  const parts = [
    method ? `Devuelto en ${METHOD_LABELS[method].toLowerCase()}` : null,
    note ?? null,
  ];
  const text = parts.filter((part): part is string => part !== null && part !== '').join(' · ');

  return text === '' ? null : text;
}

/**
 * Las notas de la renta tras la recepción. Si se sobreescribieron los días
 * (RN-4), la nota de ese cambio queda anotada: el schema no tiene columna
 * propia para ella.
 */
export function checkinNotesOf(input: {
  current: string | null;
  notes: string | null | undefined;
  overriddenDays: number | null;
  daysNote: string | null | undefined;
}): string | null {
  const base = input.notes === undefined ? input.current : input.notes;

  if (input.overriddenDays === null) return base;

  const line = `Días a cobrar ajustados a ${input.overriddenDays}${
    input.daysNote ? `: ${input.daysNote}` : '.'
  }`;

  return base === null || base === '' ? line : `${base}\n${line}`;
}

/**
 * El repositorio la lanza cuando, ya dentro de la transacción y con la fila
 * bloqueada, la renta no está en el estado del que partió el caso de uso:
 * otra persona la entregó, la recibió o la canceló entre la lectura y la
 * escritura.
 */
export class AgreementStatusChangedError extends Error {
  constructor(readonly agreementId: string) {
    super(`Agreement ${agreementId} changed status`);
    this.name = 'AgreementStatusChangedError';
  }
}
