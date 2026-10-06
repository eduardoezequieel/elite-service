import type { PaymentMethod, PaymentMethodDetails } from '@elite/shared';

import { bankAccountShortLabel } from '@/features/banking/bank-account-format';

const TIME_ZONE = 'America/El_Salvador';

const WHEN = new Intl.DateTimeFormat('es-SV', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Tono del sello: efectivo en el cajón, tarjeta informativa, transferencia no
 * se cuenta, y «Otro» (069) neutro: no es ninguno de los tres.
 */
export type PaymentMethodTone = 'green' | 'blue' | 'amber' | 'neutral';

export const METHOD_STAMP: Record<PaymentMethod, { label: string; tone: PaymentMethodTone }> = {
  CASH: { label: 'Efectivo', tone: 'green' },
  CARD: { label: 'Tarjeta', tone: 'blue' },
  TRANSFER: { label: 'Transferencia', tone: 'amber' },
  OTHER: { label: 'Otro', tone: 'neutral' },
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: METHOD_STAMP.CASH.label,
  CARD: METHOD_STAMP.CARD.label,
  TRANSFER: METHOD_STAMP.TRANSFER.label,
  OTHER: METHOD_STAMP.OTHER.label,
};

/** Un pago guardado, con lo que su método trae (069). */
export type PaymentWithDetails = { method: PaymentMethod } & Partial<PaymentMethodDetails>;

/**
 * Lo que un pago dice además de su método (069): «Agrícola ···5678 · Ref
 * 998877» en una transferencia, «cheque» en «Otro». `null` si no hay nada que
 * agregar: efectivo, tarjeta y las transferencias anteriores a la 069, que no
 * tienen cuenta ni referencia.
 */
export function paymentDetailText(payment: PaymentWithDetails): string | null {
  if (payment.method === 'TRANSFER') {
    const parts = [
      payment.bankAccount ? bankAccountShortLabel(payment.bankAccount) : null,
      payment.reference ? `Ref ${payment.reference}` : null,
    ].filter((part): part is string => part !== null);

    return parts.length === 0 ? null : parts.join(' · ');
  }

  if (payment.method === 'OTHER') {
    const description = payment.description?.trim() ?? '';

    return description === '' ? null : description;
  }

  return null;
}

/**
 * El pago en una línea: «Transferencia · Agrícola ···5678 · Ref 998877»,
 * «Otro · cheque», «Efectivo». La transferencia vieja, sin cuenta, queda en
 * «Transferencia».
 */
export function paymentDetailLabel(payment: PaymentWithDetails): string {
  const detail = paymentDetailText(payment);
  const label = METHOD_LABELS[payment.method];

  return detail === null ? label : `${label} · ${detail}`;
}

/** Un pago «Otro» del turno, como va en su lista (069 RN-7). */
export interface OtherPaymentLine {
  id: string;
  description: string;
  amount: string;
}

/**
 * La lista de «Otro» del turno: qué fue cada uno y cuánto, en el orden de los
 * cobros. Un «Otro» sin descripción (no debería existir: el API la pide) sale
 * como «Sin descripción» para que la suma se siga pudiendo cuadrar a ojo.
 */
export function otherPaymentLines(
  payments: readonly ({ id: string; amount: string } & PaymentWithDetails)[],
): OtherPaymentLine[] {
  return payments
    .filter((payment) => payment.method === 'OTHER')
    .map((payment) => ({
      id: payment.id,
      description: payment.description?.trim() || 'Sin descripción',
      amount: payment.amount,
    }));
}

/** Instant in the shop timezone. Never sliced as a UTC date. */
export function formatWhen(iso: string): string {
  const text = WHEN.format(new Date(iso))
    .replaceAll(/[\u202f\u00a0]/gu, ' ')
    .replace('a. m.', 'a.m.')
    .replace('p. m.', 'p.m.');

  return text;
}

export function formatSessionSpan(openedAt: string, closedAt: string | null): string {
  const opened = formatWhen(openedAt);

  if (closedAt === null) return opened;

  return `${opened} → ${formatWhen(closedAt)}`;
}
