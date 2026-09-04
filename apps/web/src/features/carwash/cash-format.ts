import type { PaymentMethod } from '@elite/shared';

const TIME_ZONE = 'America/El_Salvador';

const WHEN = new Intl.DateTimeFormat('es-SV', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
};

export function formatMoney(amount: string): string {
  return `$${amount}`;
}

export function centsOf(amount: string): number | null {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());

  if (match === null) return null;

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  return sign === '-' ? -cents : cents;
}

export function moneyParts(amount: string): { whole: string; fraction: string } {
  const [whole = '0', fraction = '00'] = amount.split('.');

  return { whole: `$${whole}`, fraction: `.${fraction.padEnd(2, '0')}` };
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
