/**
 * spec 095 — Las cuentas puras de una renta (RN-3, RN-4, RN-5).
 *
 * Las usan el API (096, 098, 100) y el web (formulario de renta, cobro). Todo
 * se calcula en **centavos enteros** y sale como cadena de dos decimales, igual
 * que viaja el dinero por el contrato: nunca se suma un `number` con decimales.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Desde cuántos días aplica la tarifa semanal y la mensual (RN-3). */
export const WEEKLY_RATE_FROM_DAYS = 7;
export const MONTHLY_RATE_FROM_DAYS = 30;

/** Centavos de un monto `"12.50"` (o `"-3"`). Lanza si el texto no es un monto. */
export function moneyToCents(amount: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());

  if (match === null) throw new Error(`Invalid money amount: ${amount}`);

  const [, sign = '', whole = '0', fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  return sign === '-' ? -cents : cents;
}

/** Centavos enteros a cadena de dos decimales: `1250` → `"12.50"`, `-5` → `"-0.05"`. */
export function centsToMoney(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);

  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/**
 * Días a cobrar (RN-4): `max(1, ceil((return − pickup − grace) / 24 h))`.
 *
 * Las horas de gracia salen de los ajustes (1 por defecto): devolver el carro
 * 40 minutos después de cumplir el día no cobra otro día entero.
 */
export function billableDays(
  pickup: Date | string,
  returnAt: Date | string,
  graceHours: number,
): number {
  const elapsed = toTime(returnAt) - toTime(pickup) - Math.max(0, graceHours) * HOUR_MS;

  return Math.max(1, Math.ceil(elapsed / DAY_MS));
}

/** Las tarifas de un carro, como las guarda la flota. */
export interface VehicleRates {
  dailyRate: string;
  /** Tarifa **por día** en rentas de 7 días o más. */
  weeklyRate?: string | null;
  /** Tarifa **por día** en rentas de 30 días o más. */
  monthlyRate?: string | null;
}

/** `true` si el monto existe y es mayor que cero: una tarifa en 0 no aplica. */
function positive(amount: string | null | undefined): amount is string {
  return (
    amount !== null && amount !== undefined && amount.trim() !== '' && moneyToCents(amount) > 0
  );
}

/**
 * La tarifa por día que corresponde a una renta de `days` días (RN-3): la
 * mensual desde 30, la semanal desde 7 y si no la diaria. Una tarifa vacía o en
 * cero se salta, como en el prototipo.
 */
export function rateForDays(rates: VehicleRates, days: number): string {
  if (days >= MONTHLY_RATE_FROM_DAYS && positive(rates.monthlyRate)) {
    return centsToMoney(moneyToCents(rates.monthlyRate));
  }
  if (days >= WEEKLY_RATE_FROM_DAYS && positive(rates.weeklyRate)) {
    return centsToMoney(moneyToCents(rates.weeklyRate));
  }

  return centsToMoney(moneyToCents(rates.dailyRate));
}

/** Lo que entra a la cuenta de una renta (RN-5). Montos como cadena. */
export interface AgreementTotalsInput {
  dailyRate: string;
  cdwPerDay: string;
  billableDays: number;
  extraCharges: string;
  extraKmCharge: string;
  /** Suma de las multas cargadas al cliente (`chargedToCustomer`). */
  finesCharged: string;
  discount: string;
  /** Los pagos de la renta; los anulados (`voidedAt`) no cuentan. */
  payments: readonly { amount: string; voidedAt?: string | Date | null }[];
}

export interface AgreementTotals {
  /** `(dailyRate + cdwPerDay) × billableDays`. */
  rental: string;
  /** `max(0, rental + extraCharges + extraKmCharge + finesCharged − discount)`. */
  total: string;
  /** Σ pagos no anulados. */
  paid: string;
  /** `total − paid`. Negativo si se cobró de más. */
  balance: string;
}

/** Total, pagado y saldo de una renta (RN-5). */
export function agreementTotals(input: AgreementTotalsInput): AgreementTotals {
  const days = Math.max(0, Math.trunc(input.billableDays));
  const rental = (moneyToCents(input.dailyRate) + moneyToCents(input.cdwPerDay)) * days;
  const total = Math.max(
    0,
    rental +
      moneyToCents(input.extraCharges) +
      moneyToCents(input.extraKmCharge) +
      moneyToCents(input.finesCharged) -
      moneyToCents(input.discount),
  );
  const paid = input.payments
    .filter((payment) => payment.voidedAt === null || payment.voidedAt === undefined)
    .reduce((sum, payment) => sum + moneyToCents(payment.amount), 0);

  return {
    rental: centsToMoney(rental),
    total: centsToMoney(total),
    paid: centsToMoney(paid),
    balance: centsToMoney(total - paid),
  };
}

/**
 * El neto sin IVA de un total (RN-5): si la renta incluye IVA y la tasa es
 * mayor que cero, `total / (1 + vatRate/100)`, redondeado al centavo; si no,
 * el total tal cual. `vatRate` es un porcentaje como cadena (`"13.00"`).
 */
export function netOf(total: string, vatRate: string, includesVat: boolean): string {
  const totalCents = moneyToCents(total);
  const basisPoints = moneyToCents(vatRate);

  if (!includesVat || basisPoints <= 0) return centsToMoney(totalCents);

  return centsToMoney(Math.round((totalCents * 10_000) / (10_000 + basisPoints)));
}
