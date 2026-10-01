/**
 * spec 098 — Las reglas puras del dinero de la rentadora. Todo en centavos
 * enteros; sin Nest, sin Prisma.
 */

export type AgreementStatus = 'RESERVED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

/** RN-1: un pago es mayor que cero y no supera el saldo vigente. */
export function paymentFits(amountCents: number, balanceCents: number): boolean {
  return amountCents > 0 && amountCents <= balanceCents;
}

/** Una renta cancelada no recibe pagos: no tiene nada que cobrar. */
export function acceptsPayments(status: AgreementStatus): boolean {
  return status !== 'CANCELLED';
}

/** Lo que hace falta de una renta para saber si guarda depósito. */
export interface DepositState {
  depositCents: number;
  /** `null` mientras no se devolvió. */
  returnedCents: number | null;
  /** La renta a la que pasó el depósito en un cambio de carro (096). */
  transferredToId: string | null;
}

/** RN-2: cuánto depósito está en custodia. 0 si no hay, ya se devolvió o se transfirió. */
export function depositHeldCents(state: DepositState): number {
  if (state.depositCents <= 0) return 0;
  if (state.returnedCents !== null) return 0;
  if (state.transferredToId !== null) return 0;

  return state.depositCents;
}

/** RN-2: se devuelve una sola vez y nunca más de lo que se guarda. */
export function depositReturnFits(state: DepositState, amountCents: number): boolean {
  const held = depositHeldCents(state);

  return held > 0 && amountCents >= 0 && amountCents <= held;
}

/** RN-3: cuenta por cobrar = en curso o finalizada con saldo de al menos un centavo. */
export function isReceivable(status: AgreementStatus, balanceCents: number): boolean {
  return (status === 'IN_PROGRESS' || status === 'FINISHED') && balanceCents >= 1;
}

/** Las fechas de una renta que dicen cuándo tuvo el carro el cliente. */
export interface OccupancySpan {
  status: AgreementStatus;
  plannedPickupAt: Date;
  plannedReturnAt: Date;
  actualPickupAt: Date | null;
  actualReturnAt: Date | null;
}

/**
 * RN-4: el intervalo en que el cliente tuvo el carro, o `null` si nunca lo
 * tuvo (reservada o cancelada). Una renta en curso que ya se pasó de la hora
 * lo sigue teniendo hasta ahora.
 */
export function heldInterval(span: OccupancySpan, now: Date): { from: Date; to: Date } | null {
  if (span.status !== 'IN_PROGRESS' && span.status !== 'FINISHED') return null;

  const from = span.actualPickupAt ?? span.plannedPickupAt;
  let to = span.actualReturnAt ?? span.plannedReturnAt;

  if (span.status === 'IN_PROGRESS' && span.actualReturnAt === null && to < now) to = now;

  return { from, to };
}

/**
 * RN-4: la renta que tenía el carro en `occurredAt` (bordes incluidos). Si dos
 * se tocan —el cambio de carro cierra una y abre otra en el mismo instante—,
 * gana la que empezó después.
 */
export function agreementHolding<T extends OccupancySpan>(
  spans: readonly T[],
  occurredAt: Date,
  now: Date,
): T | null {
  let best: { span: T; from: Date } | null = null;

  for (const span of spans) {
    const interval = heldInterval(span, now);

    if (interval === null) continue;
    if (occurredAt < interval.from || occurredAt > interval.to) continue;
    if (best === null || interval.from > best.from) best = { span, from: interval.from };
  }

  return best?.span ?? null;
}
