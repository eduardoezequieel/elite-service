'use client';

import { Stamp } from '@/components/ui/stamp';
import { centsOf, formatMoney } from '../cash-format';

function labelOf(cents: number, amount: string): string {
  if (cents === 0) return 'Cuadra';
  if (cents > 0) return `Sobra ${formatMoney(amount)}`;

  return `Falta ${formatMoney(amount.replace('-', ''))}`;
}

export function CashDifferenceStamp({ difference }: { difference: string | null }) {
  if (difference === null) {
    return <Stamp tone="neutral" label="Abierto" />;
  }

  const cents = centsOf(difference) ?? 0;
  const tone = cents === 0 ? 'green' : cents > 0 ? 'amber' : 'red';

  return <Stamp tone={tone} label={labelOf(cents, difference)} />;
}

export function differenceToneClass(cents: number): string {
  if (cents === 0) return 'text-go-text';
  if (cents > 0) return 'text-warn-text';

  return 'text-danger-text';
}

export function differenceLiveLabel(cents: number): string {
  if (cents === 0) return 'Cuadra';

  const absolute = Math.abs(cents);
  const amount = `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;

  return cents > 0 ? `Sobra $${amount}` : `Falta $${amount}`;
}
