import { formatContractNumber } from '@/features/rental-documents/print-layout';
import { parseCents } from '@/lib/money';
import type { RentalSettingsFormValues } from './settings-form';

/**
 * El ejemplo de cobro de «Cobros y reglas» (120): 3 días a $35 con el CDW y el
 * IVA que se están escribiendo. El IVA va **incluido** en el precio, como en
 * el sistema de Riveras (`T − T/(1+iva)`) y en el anverso del contrato (097):
 * no se suma, se separa del total.
 */

export const EXAMPLE_DAYS = 3;
export const EXAMPLE_RATE_CENTS = 3500;

export interface ChargeExample {
  days: number;
  rateCents: number;
  rentalCents: number;
  cdwPerDayCents: number;
  cdwCents: number;
  /** El porcentaje leído; 0 si está vacío o no es un número. */
  vatRate: number;
  /** La parte del total que es IVA. */
  vatCents: number;
  totalCents: number;
  graceHours: number;
  bufferHours: number;
  /** El número del siguiente contrato, con ceros: `"0733"`. */
  nextContract: string;
}

function percentOf(text: string): number {
  const value = Number(text.trim().replace(',', '.'));

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function wholeOf(text: string): number {
  const value = Number.parseInt(text.trim(), 10);

  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function chargeExample(
  values: Pick<
    RentalSettingsFormValues,
    'defaultCdwPerDay' | 'vatRate' | 'graceHours' | 'bufferHours' | 'contractStartNumber'
  >,
): ChargeExample {
  const days = EXAMPLE_DAYS;
  const rentalCents = days * EXAMPLE_RATE_CENTS;
  const cdwPerDayCents = Math.max(0, parseCents(values.defaultCdwPerDay));
  const cdwCents = days * cdwPerDayCents;
  const totalCents = rentalCents + cdwCents;
  const vatRate = percentOf(values.vatRate);
  const vatCents = vatRate > 0 ? totalCents - Math.round(totalCents / (1 + vatRate / 100)) : 0;
  const start = wholeOf(values.contractStartNumber);

  return {
    days,
    rateCents: EXAMPLE_RATE_CENTS,
    rentalCents,
    cdwPerDayCents,
    cdwCents,
    vatRate,
    vatCents,
    totalCents,
    graceHours: wholeOf(values.graceHours),
    bufferHours: wholeOf(values.bufferHours),
    nextContract: formatContractNumber(start === 0 ? null : start),
  };
}
