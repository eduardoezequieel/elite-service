import { z } from 'zod';

import type { Page } from '../contracts';
import { civilDateSchema, pageQueryShape } from '../schemas';
import type { AgreementStatus } from './agreements';
import { occupiedInterval } from './agreements';
import type { FleetVehicle } from './fleet';
import type { DocumentStatus, MaintenanceAlerts, VehicleDocumentKind } from './maintenance';
import { documentStatus, taskStatus } from './maintenance';
import { agreementTotals, centsToMoney, moneyToCents, netOf } from './money';
import type { AgreementTotalsInput } from './money';

/**
 * spec 100 — El inicio de la rentadora y la rentabilidad por carro.
 *
 * Las fórmulas son las del prototipo (`profitOne`, `fixedCost`, `lifetime`,
 * `monthsFrac`, `verdict`) y se replican tal cual: el ingreso de una renta se
 * reparte por el solapamiento de su tramo con el periodo, los fijos y la cuota
 * se cargan por fracción de mes. Todo en **centavos** con coma flotante por
 * dentro y redondeado al centavo solo al salir, como cadena.
 *
 * Fechas y meses en `America/El_Salvador`, que es UTC−6 todo el año (no cambia
 * de hora): por eso el corrimiento es fijo y no depende de la zona del proceso.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** El Salvador: UTC−6 fijo. */
const SV_OFFSET_MS = -6 * HOUR_MS;
/** `BOOKED`: libre ahora con una reserva que sale en menos de esto. */
export const BOOKED_WINDOW_HOURS = 48;

// ===================== Estados y veredictos =====================

export const VERDICTS = ['GAIN', 'EVEN', 'LOSS', 'NONE'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  GAIN: 'Ganancia',
  EVEN: 'Cubrió su costo',
  LOSS: 'Pérdida',
  NONE: 'Sin uso',
};

export const FLEET_BOARD_STATES = ['FREE', 'OUT', 'LATE', 'BOOKED', 'IN_SHOP'] as const;
export type FleetBoardState = (typeof FLEET_BOARD_STATES)[number];

export const FLEET_BOARD_STATE_LABELS: Record<FleetBoardState, string> = {
  FREE: 'Disponible',
  OUT: 'Rentado',
  LATE: 'Atrasado',
  BOOKED: 'Reservado',
  IN_SHOP: 'En taller',
};

// ===================== Entradas de las cuentas =====================

/** Lo que las cuentas necesitan de un carro de la flota. */
export type ReportVehicle = Pick<
  FleetVehicle,
  | 'id'
  | 'plate'
  | 'make'
  | 'model'
  | 'year'
  | 'category'
  | 'status'
  | 'dailyRate'
  | 'odometerKm'
  | 'purchasePrice'
  | 'purchasedAt'
  | 'financed'
  | 'downPayment'
  | 'installment'
  | 'termMonths'
  | 'financingStartedAt'
  | 'insuranceMonthly'
  | 'gpsMonthly'
  | 'otherFixedMonthly'
  | 'insuranceExpiresAt'
  | 'registrationExpiresAt'
>;

/** El carro, resumido, en una fila de reporte. */
export type ReportVehicleRef = Pick<
  FleetVehicle,
  'id' | 'plate' | 'make' | 'model' | 'year' | 'category' | 'status' | 'dailyRate'
>;

/** Una renta, con su ingreso y su saldo ya calculados (`agreementIncome`). */
export interface ReportAgreement {
  id: string;
  contractNumber: number | null;
  vehicleId: string;
  status: AgreementStatus;
  customerName: string;
  plannedPickupAt: string;
  plannedReturnAt: string;
  actualPickupAt: string | null;
  actualReturnAt: string | null;
  pickupLocation: string;
  returnLocation: string;
  /** RN-1: `netOf(agreementTotals(...).total)`. */
  income: string;
  /** `agreementTotals(...).balance`. */
  balance: string;
}

/** Un gasto del carro, del origen que sea (099). */
export interface ReportExpense {
  incurredAt: string;
  amount: string;
}

// ===================== Salidas =====================

export interface VehicleProfitability {
  vehicle: ReportVehicleRef;
  income: string;
  expenses: string;
  /** Seguro, GPS y otros fijos del periodo. */
  fixed: string;
  installment: string;
  /** `income − expenses − fixed`: lo que deja antes de la cuota. */
  operating: string;
  /** `operating − installment`: «lo que quedó». */
  net: string;
  /** `expenses + fixed + installment`. */
  costs: string;
  verdict: Verdict;
  /** Días rentados en el periodo, con un decimal. */
  rentedDays: number;
  /** De 0 a 1. */
  occupancy: number;
  incomePerDay: string;
  /** Rentas que tocan el periodo. */
  agreements: number;
}

export interface VehicleLifetime {
  /** Desde cuándo cuenta: compra, financiamiento o la primera renta. */
  since: string | null;
  income: string;
  expenses: string;
  fixed: string;
  installment: string;
  operating: string;
  net: string;
  financed: boolean;
  installmentsPaid: number;
  termMonths: number | null;
  /** Lo que falta de cuotas; `null` sin plazo o al contado. */
  pending: string | null;
  /** Prima + cuotas pagadas, o el precio al contado. */
  disbursed: string;
  /** `operating / disbursed`; `null` si no hay desembolso («Faltan datos»). */
  recovered: number | null;
}

export interface BreakEven {
  /** Fijos + cuota activa del mes. */
  monthlyCost: string;
  /** Días de renta al mes para cubrirlos; `null` sin tarifa diaria. */
  days: number | null;
}

export interface ProfitabilityRow extends VehicleProfitability {
  lifetime: VehicleLifetime;
}

export interface ProfitabilityTotals {
  income: string;
  expenses: string;
  fixed: string;
  installment: string;
  operating: string;
  net: string;
  rentedDays: number;
  /** Promedio de la ocupación de los carros. */
  occupancy: number;
  agreements: number;
  verdicts: Record<Verdict, number>;
}

/** La rentabilidad del periodo con todas sus filas: lo que calcula {@link profitabilityReport}. */
export interface ProfitabilitySummary {
  from: string;
  to: string;
  rows: ProfitabilityRow[];
  totals: ProfitabilityTotals;
}

/**
 * `GET /rentals/reports/profitability` (101): una página de carros, del que
 * más deja al que menos; `totals` es de toda la flota, no de la página.
 */
export interface ProfitabilityReport extends Omit<ProfitabilitySummary, 'rows'> {
  rows: Page<ProfitabilityRow>;
}

export interface VehicleMonthRow {
  /** `YYYY-MM`. */
  month: string;
  income: string;
  expenses: string;
  fixed: string;
  installment: string;
  operating: string;
  net: string;
  verdict: Verdict;
  rentedDays: number;
  occupancy: number;
  /** El mes todavía no empieza: todo en cero. */
  future: boolean;
}

/** `GET /fleet/vehicles/:id/months`. */
export interface VehicleMonths {
  vehicle: ReportVehicleRef;
  year: number;
  rows: VehicleMonthRow[];
  total: VehicleProfitability;
  breakEven: BreakEven | null;
  lifetime: VehicleLifetime;
}

export interface DashboardAgreementRef {
  id: string;
  contractNumber: number | null;
  customerName: string;
  plannedPickupAt: string;
  plannedReturnAt: string;
}

export interface FleetBoardTile {
  vehicle: ReportVehicleRef;
  state: FleetBoardState;
  /** Quién lo tiene (OUT/LATE), quién sale (BOOKED) o la próxima reserva (FREE). */
  agreement: DashboardAgreementRef | null;
}

export interface DashboardEvent {
  agreementId: string;
  contractNumber: number | null;
  kind: 'PICKUP' | 'RETURN';
  at: string;
  /** Ya pasó la hora y sigue pendiente. */
  overdue: boolean;
  customerName: string;
  vehicle: ReportVehicleRef;
  location: string;
}

export interface DashboardDay {
  pickups: DashboardEvent[];
  returns: DashboardEvent[];
}

export interface DashboardBalance {
  agreementId: string;
  contractNumber: number | null;
  customerName: string;
  vehicle: ReportVehicleRef;
  balance: string;
  pickupAt: string;
}

export interface DashboardMaintenance {
  vehicle: ReportVehicleRef;
  tasks: { name: string; status: 'DUE' | 'SOON' }[];
  /** `DUE` si alguna está vencida. */
  status: 'DUE' | 'SOON';
}

export interface DashboardDocument {
  vehicle: ReportVehicleRef;
  kind: VehicleDocumentKind;
  expiresAt: string;
  daysLeft: number;
  status: DocumentStatus;
}

/** `GET /rentals/reports/dashboard`. */
export interface RentalDashboard {
  /** Hoy, `YYYY-MM-DD` en la zona del taller. */
  date: string;
  fleet: FleetBoardTile[];
  /** Salidas y regresos de hoy, con los que ya se pasaron de hora. */
  today: DashboardDay;
  tomorrow: DashboardDay;
  next7Days: { date: string; occupied: number; total: number }[];
  month: { month: string; income: string; agreements: number; occupancy: number };
  pending: {
    late: DashboardEvent[];
    balances: DashboardBalance[];
    maintenanceDue: DashboardMaintenance[];
    documentsDue: DashboardDocument[];
  };
}

// ===================== Schemas =====================

/** Tope del rango de rentabilidad: diez años. */
export const PROFITABILITY_MAX_DAYS = 3660;

/** `GET /rentals/reports/profitability?from&to&page&pageSize`: días civiles, ambos incluidos. */
export const profitabilityQuerySchema = z
  .object({ ...pageQueryShape, from: civilDateSchema, to: civilDateSchema })
  .refine((value) => value.to >= value.from, {
    message: 'El periodo termina antes de empezar.',
    path: ['to'],
  })
  .refine((value) => civilDaysApart(value.from, value.to) < PROFITABILITY_MAX_DAYS, {
    message: 'El periodo es demasiado largo.',
    path: ['to'],
  });
export type ProfitabilityQuery = z.infer<typeof profitabilityQuerySchema>;

/** `GET /fleet/vehicles/:id/months?year`. Sin año, el actual. */
export const monthsQuerySchema = z.object({
  year: z.coerce
    .number({ message: 'Escribí el año.' })
    .int({ message: 'El año es un número entero.' })
    .min(2000, { message: 'Ese año no es válido.' })
    .max(2100, { message: 'Ese año no es válido.' })
    .optional(),
});
export type MonthsQuery = z.infer<typeof monthsQuerySchema>;

// ===================== Calendario en El Salvador =====================

function civilDaysApart(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** El instante de las 00:00 del día civil `YYYY-MM-DD` en El Salvador. */
export function civilStartMs(civil: string): number {
  return Date.parse(`${civil}T00:00:00Z`) - SV_OFFSET_MS;
}

/** El día civil `YYYY-MM-DD` de un instante en El Salvador. */
export function civilDateOfInstant(instant: Date | number): string {
  const ms = instant instanceof Date ? instant.getTime() : instant;

  return new Date(ms + SV_OFFSET_MS).toISOString().slice(0, 10);
}

/** `civil` + `days` días. */
export function addCivilDays(civil: string, days: number): string {
  return new Date(Date.parse(`${civil}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** El primero del mes del instante, a las 00:00, más `months` meses. */
function monthStartMs(ms: number, months = 0): number {
  const local = new Date(ms + SV_OFFSET_MS);

  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1) - SV_OFFSET_MS;
}

/** El prototipo (`addMonths`): mismo día del mes, `months` después, a las 00:00. */
function addMonthsMs(ms: number, months: number): number {
  const local = new Date(ms + SV_OFFSET_MS);

  return (
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, local.getUTCDate()) -
    SV_OFFSET_MS
  );
}

function ms(value: Date | number | string): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? civilStartMs(value) : Date.parse(value);
}

/** `[inicio, fin)` de un periodo de días civiles, ambos incluidos. */
export interface Span {
  start: number;
  end: number;
}

export function civilPeriod(from: string, to: string): Span {
  return { start: civilStartMs(from), end: civilStartMs(addCivilDays(to, 1)) };
}

// ===================== Fórmulas del prototipo =====================

/**
 * Meses (con fracción) entre dos instantes: cada mes calendario que toca suma
 * el pedazo que cae adentro sobre su largo. Del 15 al 31 de octubre: 17/31.
 */
export function monthsFrac(from: Date | number, to: Date | number): number {
  const a = ms(from);
  const b = ms(to);

  if (!Number.isFinite(a) || !Number.isFinite(b) || !(b > a)) return 0;

  let total = 0;
  let cursor = monthStartMs(a);

  while (cursor < b) {
    const next = monthStartMs(cursor, 1);
    const overlap = Math.min(b, next) - Math.max(a, cursor);

    if (overlap > 0) total += overlap / (next - cursor);
    cursor = next;
  }

  return total;
}

/** Lo que se solapan dos tramos, en ms (0 si no se tocan). */
export function overlapMs(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * RN-1: la parte de `amount` que le toca al periodo por solapamiento,
 * `amount × solape / largo`. Centavos sin redondear.
 */
export function prorate(amount: string, interval: Span, period: Span): number {
  const length = interval.end - interval.start;

  if (!(length > 0)) return 0;

  return (moneyToCents(amount) * overlapMs(interval, period)) / length;
}

/** RN-1: el ingreso de una renta, `netOf(agreementTotals(...).total)`. */
export function agreementIncome(
  input: AgreementTotalsInput & { includesVat: boolean },
  vatRate: string,
): { income: string; balance: string } {
  const totals = agreementTotals(input);

  return { income: netOf(totals.total, vatRate, input.includesVat), balance: totals.balance };
}

function cents(amount: string | null | undefined): number {
  return amount === null || amount === undefined || amount.trim() === '' ? 0 : moneyToCents(amount);
}

/** RN-3: seguro + GPS + otros fijos, al mes, en centavos. */
export function monthlyFixedCents(
  vehicle: Pick<ReportVehicle, 'insuranceMonthly' | 'gpsMonthly' | 'otherFixedMonthly'>,
): number {
  return (
    cents(vehicle.insuranceMonthly) + cents(vehicle.gpsMonthly) + cents(vehicle.otherFixedMonthly)
  );
}

/**
 * Desde cuándo cuenta el carro (RN-3, `vStart`): la compra, el inicio del
 * financiamiento o, si no hay, la primera renta no cancelada o el primer gasto.
 */
export function vehicleStart(
  vehicle: Pick<ReportVehicle, 'id' | 'purchasedAt' | 'financingStartedAt'>,
  agreements: readonly Pick<ReportAgreement, 'vehicleId' | 'status' | 'plannedPickupAt'>[],
  expenses: readonly ReportExpense[],
): number | null {
  if (vehicle.purchasedAt) return civilStartMs(vehicle.purchasedAt);
  if (vehicle.financingStartedAt) return civilStartMs(vehicle.financingStartedAt);

  let first: number | null = null;

  for (const agreement of agreements) {
    if (agreement.vehicleId !== vehicle.id || agreement.status === 'CANCELLED') continue;
    const at = ms(agreement.plannedPickupAt);
    if (first === null || at < first) first = at;
  }
  for (const expense of expenses) {
    const at = civilStartMs(expense.incurredAt);
    if (first === null || at < first) first = at;
  }

  return first;
}

type FinancingFields = Pick<
  ReportVehicle,
  'financed' | 'installment' | 'termMonths' | 'financingStartedAt'
>;

/** El tramo en que corre la cuota (`finRange`): sin plazo, para siempre. */
export function financingRange(vehicle: FinancingFields, start: number | null): Span | null {
  if (!vehicle.financed || !(cents(vehicle.installment) > 0)) return null;

  const from = vehicle.financingStartedAt ? civilStartMs(vehicle.financingStartedAt) : start;

  if (from === null) return null;

  const term = vehicle.termMonths ?? 0;

  return { start: from, end: term > 0 ? addMonthsMs(from, term) : Number.POSITIVE_INFINITY };
}

/**
 * RN-3 (`fixedCost`): los fijos del periodo desde que el carro cuenta y la
 * cuota dentro de su plazo, en centavos sin redondear.
 */
export function fixedCost(
  vehicle: ReportVehicle,
  period: Span,
  start: number | null,
): { fixed: number; installment: number } {
  const monthly = monthlyFixedCents(vehicle);
  const fixed =
    start !== null && monthly > 0
      ? monthly * monthsFrac(Math.max(period.start, start), period.end)
      : 0;
  const range = financingRange(vehicle, start);
  const installment =
    range === null
      ? 0
      : cents(vehicle.installment) *
        monthsFrac(Math.max(period.start, range.start), Math.min(period.end, range.end));

  return { fixed, installment };
}

/**
 * El veredicto (`verdict`): con `tol = max(10, 3 % de los costos)`, ganancia
 * si `net > tol`, pérdida si `net < −tol`, cubrió su costo si no. Sin costos
 * ni ingresos, sin uso. Centavos.
 */
export function verdict(net: number, costs: number, income: number): Verdict {
  if (!costs && !income) return 'NONE';

  const tolerance = Math.max(1000, 0.03 * costs);

  if (net > tolerance) return 'GAIN';
  if (net < -tolerance) return 'LOSS';
  return 'EVEN';
}

interface ProfitCents {
  income: number;
  expenses: number;
  fixed: number;
  installment: number;
  operating: number;
  net: number;
  costs: number;
  occupiedMs: number;
  agreements: number;
}

/** `profitOne` en centavos sin redondear. */
function profitCents(
  vehicle: ReportVehicle,
  agreements: readonly ReportAgreement[],
  expenses: readonly ReportExpense[],
  period: Span,
  now: Date,
  start: number | null,
): ProfitCents {
  let income = 0;
  let occupied = 0;
  let count = 0;

  for (const agreement of agreements) {
    if (agreement.vehicleId !== vehicle.id) continue;
    if (agreement.status === 'CANCELLED' || agreement.status === 'RESERVED') continue;

    const interval = occupiedInterval(agreement, now);
    const span = { start: interval.start.getTime(), end: interval.end.getTime() };
    const overlap = overlapMs(span, period);

    if (!(span.end > span.start) || overlap <= 0) continue;

    income += prorate(agreement.income, span, period);
    occupied += overlap;
    count += 1;
  }

  const spent = expenses
    .filter((expense) => {
      const at = civilStartMs(expense.incurredAt);
      return at >= period.start && at < period.end;
    })
    .reduce((sum, expense) => sum + moneyToCents(expense.amount), 0);
  const { fixed, installment } = fixedCost(vehicle, period, start);
  const operating = income - spent - fixed;

  return {
    income,
    expenses: spent,
    fixed,
    installment,
    operating,
    net: operating - installment,
    costs: spent + fixed + installment,
    occupiedMs: occupied,
    agreements: count,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function vehicleRef(vehicle: ReportVehicle): ReportVehicleRef {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    category: vehicle.category,
    status: vehicle.status,
    dailyRate: vehicle.dailyRate,
  };
}

function toProfitability(vehicle: ReportVehicle, p: ProfitCents, span: Span): VehicleProfitability {
  const days = p.occupiedMs / DAY_MS;
  const length = span.end - span.start;

  return {
    vehicle: vehicleRef(vehicle),
    income: centsToMoney(p.income),
    expenses: centsToMoney(p.expenses),
    fixed: centsToMoney(p.fixed),
    installment: centsToMoney(p.installment),
    operating: centsToMoney(p.operating),
    net: centsToMoney(p.net),
    costs: centsToMoney(p.costs),
    verdict: verdict(p.net, p.costs, p.income),
    rentedDays: round1(days),
    occupancy: length > 0 ? round4(p.occupiedMs / length) : 0,
    incomePerDay: centsToMoney(days > 0 ? p.income / days : 0),
    agreements: p.agreements,
  };
}

/**
 * La rentabilidad de un carro en un periodo (`profitOne`, RN-1..RN-4). `from`
 * y `to` son días civiles, ambos incluidos. `agreements` y `expenses` pueden
 * traer todo: se filtra acá.
 */
export function profitability(
  vehicle: ReportVehicle,
  agreements: readonly ReportAgreement[],
  expenses: readonly ReportExpense[],
  from: string,
  to: string,
  now: Date,
): VehicleProfitability {
  const period = civilPeriod(from, to);
  const start = vehicleStart(vehicle, agreements, expenses);

  return toProfitability(
    vehicle,
    profitCents(vehicle, agreements, expenses, period, now, start),
    period,
  );
}

/**
 * La historia entera del carro (`lifetime`): desde que cuenta hasta `now`,
 * cuotas pagadas, lo desembolsado (prima + cuotas, o el precio al contado) y
 * la inversión recuperada (`operating / disbursed`).
 */
export function lifetime(
  vehicle: ReportVehicle,
  agreements: readonly ReportAgreement[],
  expenses: readonly ReportExpense[],
  now: Date,
): VehicleLifetime {
  const nowMs = now.getTime();
  const start = vehicleStart(vehicle, agreements, expenses);
  const p =
    start === null
      ? null
      : profitCents(vehicle, agreements, expenses, { start, end: nowMs }, now, start);
  const range = financingRange(vehicle, start);
  const term = vehicle.termMonths ?? 0;
  let installmentsPaid = 0;
  let pending: number | null = null;
  let disbursed: number;

  if (range !== null) {
    installmentsPaid = Math.ceil(monthsFrac(range.start, Math.min(nowMs, range.end)) - 1e-9);
    if (term > 0) installmentsPaid = Math.min(installmentsPaid, term);
    installmentsPaid = Math.max(0, installmentsPaid);
    disbursed = cents(vehicle.downPayment) + installmentsPaid * cents(vehicle.installment);
    pending = term > 0 ? Math.max(0, term - installmentsPaid) * cents(vehicle.installment) : null;
  } else {
    disbursed = cents(vehicle.purchasePrice);
  }

  const operating = p?.operating ?? 0;

  return {
    since: start === null ? null : civilDateOfInstant(start),
    income: centsToMoney(p?.income ?? 0),
    expenses: centsToMoney(p?.expenses ?? 0),
    fixed: centsToMoney(p?.fixed ?? 0),
    installment: centsToMoney(p?.installment ?? 0),
    operating: centsToMoney(operating),
    net: centsToMoney(p?.net ?? 0),
    financed: range !== null,
    installmentsPaid,
    termMonths: vehicle.termMonths,
    pending: pending === null ? null : centsToMoney(pending),
    disbursed: centsToMoney(disbursed),
    recovered: disbursed > 0 ? round4(operating / disbursed) : null,
  };
}

/**
 * RN-5 (`equilibrio`): fijos + cuota activa hoy, y cuántos días de renta al
 * mes los cubren a la tarifa diaria. `null` si el carro no tiene costos fijos.
 */
export function breakEvenDays(
  vehicle: ReportVehicle,
  start: number | null,
  now: Date,
): BreakEven | null {
  const range = financingRange(vehicle, start);
  const nowMs = now.getTime();
  const active = range !== null && nowMs >= range.start && nowMs < range.end;
  const monthly = monthlyFixedCents(vehicle) + (active ? cents(vehicle.installment) : 0);

  if (!monthly) return null;

  const rate = cents(vehicle.dailyRate);

  return { monthlyCost: centsToMoney(monthly), days: rate > 0 ? round1(monthly / rate) : null };
}

/** La rentabilidad de toda la flota en un periodo, con totales. */
export function profitabilityReport(
  vehicles: readonly ReportVehicle[],
  agreements: readonly ReportAgreement[],
  expensesByVehicle: ReadonlyMap<string, readonly ReportExpense[]>,
  from: string,
  to: string,
  now: Date,
): ProfitabilitySummary {
  const rows: ProfitabilityRow[] = [];
  const period = civilPeriod(from, to);
  const sum = {
    income: 0,
    expenses: 0,
    fixed: 0,
    installment: 0,
    operating: 0,
    net: 0,
    occupiedMs: 0,
    agreements: 0,
  };
  const verdicts: Record<Verdict, number> = { GAIN: 0, EVEN: 0, LOSS: 0, NONE: 0 };
  const nets = new Map<string, number>();
  let occupancy = 0;

  for (const vehicle of vehicles) {
    const expenses = expensesByVehicle.get(vehicle.id) ?? [];
    const start = vehicleStart(vehicle, agreements, expenses);
    const p = profitCents(vehicle, agreements, expenses, period, now, start);

    // Como `profit()`: un carro retirado solo sale si movió algo en el periodo.
    if (vehicle.status === 'RETIRED' && !p.income && !p.expenses) continue;

    const row = toProfitability(vehicle, p, period);
    rows.push({ ...row, lifetime: lifetime(vehicle, agreements, expenses, now) });
    nets.set(vehicle.id, p.net);
    sum.income += p.income;
    sum.expenses += p.expenses;
    sum.fixed += p.fixed;
    sum.installment += p.installment;
    sum.operating += p.operating;
    sum.net += p.net;
    sum.occupiedMs += p.occupiedMs;
    sum.agreements += p.agreements;
    occupancy += row.occupancy;
    verdicts[row.verdict] += 1;
  }

  rows.sort(
    (left, right) =>
      (nets.get(right.vehicle.id) ?? 0) - (nets.get(left.vehicle.id) ?? 0) ||
      left.vehicle.id.localeCompare(right.vehicle.id),
  );

  return {
    from,
    to,
    rows,
    totals: {
      income: centsToMoney(sum.income),
      expenses: centsToMoney(sum.expenses),
      fixed: centsToMoney(sum.fixed),
      installment: centsToMoney(sum.installment),
      operating: centsToMoney(sum.operating),
      net: centsToMoney(sum.net),
      rentedDays: round1(sum.occupiedMs / DAY_MS),
      occupancy: rows.length > 0 ? round4(occupancy / rows.length) : 0,
      agreements: sum.agreements,
      verdicts,
    },
  };
}

/** Los 12 meses de un carro en un año, más el total, el equilibrio y la historia. */
export function vehicleMonths(
  vehicle: ReportVehicle,
  agreements: readonly ReportAgreement[],
  expenses: readonly ReportExpense[],
  year: number,
  now: Date,
): VehicleMonths {
  const start = vehicleStart(vehicle, agreements, expenses);
  const nowMs = now.getTime();
  const rows: VehicleMonthRow[] = [];

  for (let month = 0; month < 12; month += 1) {
    const period = {
      start: Date.UTC(year, month, 1) - SV_OFFSET_MS,
      end: Date.UTC(year, month + 1, 1) - SV_OFFSET_MS,
    };
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const future = period.start > nowMs;
    const p = future
      ? null
      : toProfitability(
          vehicle,
          profitCents(vehicle, agreements, expenses, period, now, start),
          period,
        );

    rows.push({
      month: key,
      income: p?.income ?? '0.00',
      expenses: p?.expenses ?? '0.00',
      fixed: p?.fixed ?? '0.00',
      installment: p?.installment ?? '0.00',
      operating: p?.operating ?? '0.00',
      net: p?.net ?? '0.00',
      verdict: p?.verdict ?? 'NONE',
      rentedDays: p?.rentedDays ?? 0,
      occupancy: p?.occupancy ?? 0,
      future,
    });
  }

  // El total del año hasta donde va: de enero al fin del último mes que ya empezó.
  const yearStart = Date.UTC(year, 0, 1) - SV_OFFSET_MS;
  const yearEnd = Date.UTC(year + 1, 0, 1) - SV_OFFSET_MS;
  const totalEnd = Math.min(yearEnd, Math.max(yearStart, monthStartMs(nowMs, 1)));
  const totalSpan = { start: yearStart, end: totalEnd };

  return {
    vehicle: vehicleRef(vehicle),
    year,
    rows,
    total: toProfitability(
      vehicle,
      profitCents(vehicle, agreements, expenses, totalSpan, now, start),
      totalSpan,
    ),
    breakEven: breakEvenDays(vehicle, start, now),
    lifetime: lifetime(vehicle, agreements, expenses, now),
  };
}

// ===================== Tablero de inicio =====================

export interface DashboardPlanTask {
  id: string;
  name: string;
  intervalKm: number | null;
  intervalDays: number | null;
}

export interface DashboardLastService {
  vehicleId: string;
  taskId: string;
  performedAt: string;
  odometerKm: number | null;
}

export interface DashboardInput {
  vehicles: readonly ReportVehicle[];
  agreements: readonly ReportAgreement[];
  /** Tareas activas del plan (099). */
  plan: readonly DashboardPlanTask[];
  /** El servicio más reciente por carro y tarea. */
  lastServices: readonly DashboardLastService[];
  alerts: MaintenanceAlerts;
  now: Date;
}

function slotRef(agreement: ReportAgreement): DashboardAgreementRef {
  return {
    id: agreement.id,
    contractNumber: agreement.contractNumber,
    customerName: agreement.customerName,
    plannedPickupAt: agreement.plannedPickupAt,
    plannedReturnAt: agreement.plannedReturnAt,
  };
}

/** Estado del carro en el tablero (`vStatus`). */
export function fleetBoardState(
  vehicle: Pick<ReportVehicle, 'id' | 'status'>,
  agreements: readonly ReportAgreement[],
  now: Date,
): { state: FleetBoardState; agreement: ReportAgreement | null } {
  const nowMs = now.getTime();

  if (vehicle.status === 'IN_SHOP') return { state: 'IN_SHOP', agreement: null };

  const active = agreements.find(
    (agreement) => agreement.vehicleId === vehicle.id && agreement.status === 'IN_PROGRESS',
  );

  if (active !== undefined) {
    return { state: ms(active.plannedReturnAt) < nowMs ? 'LATE' : 'OUT', agreement: active };
  }

  const next = agreements
    .filter(
      (agreement) =>
        agreement.vehicleId === vehicle.id &&
        agreement.status === 'RESERVED' &&
        ms(agreement.plannedReturnAt) > nowMs,
    )
    .sort((left, right) => ms(left.plannedPickupAt) - ms(right.plannedPickupAt))[0];

  if (next !== undefined && ms(next.plannedPickupAt) - nowMs < BOOKED_WINDOW_HOURS * HOUR_MS) {
    return { state: 'BOOKED', agreement: next };
  }

  return { state: 'FREE', agreement: next ?? null };
}

function nameOf(vehicle: Pick<ReportVehicle, 'make' | 'model'>): string {
  return `${vehicle.make} ${vehicle.model}`;
}

/** El tablero de inicio (`VIEWS.inicio`), todo calculado. */
export function rentalDashboard(input: DashboardInput): RentalDashboard {
  const { now, alerts } = input;
  const nowMs = now.getTime();
  const today = civilDateOfInstant(now);
  const tomorrow = addCivilDays(today, 1);
  const todayStart = civilStartMs(today);
  const tomorrowStart = civilStartMs(tomorrow);
  const dayAfterStart = civilStartMs(addCivilDays(today, 2));
  const vehicles = input.vehicles
    .filter((vehicle) => vehicle.status !== 'RETIRED')
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        nameOf(left).localeCompare(nameOf(right), 'es'),
    );
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const agreements = input.agreements.filter((agreement) => byId.has(agreement.vehicleId));

  const fleet: FleetBoardTile[] = vehicles.map((vehicle) => {
    const { state, agreement } = fleetBoardState(vehicle, agreements, now);
    return {
      vehicle: vehicleRef(vehicle),
      state,
      agreement: agreement === null ? null : slotRef(agreement),
    };
  });

  const events: DashboardEvent[] = [];
  for (const agreement of agreements) {
    const vehicle = byId.get(agreement.vehicleId);
    if (vehicle === undefined) continue;

    if (agreement.status === 'RESERVED' || agreement.status === 'IN_PROGRESS') {
      const pickup = agreement.status === 'RESERVED';
      const at = pickup ? agreement.plannedPickupAt : agreement.plannedReturnAt;
      events.push({
        agreementId: agreement.id,
        contractNumber: agreement.contractNumber,
        kind: pickup ? 'PICKUP' : 'RETURN',
        at,
        overdue: ms(at) < nowMs,
        customerName: agreement.customerName,
        vehicle: vehicleRef(vehicle),
        location: pickup ? agreement.pickupLocation : agreement.returnLocation,
      });
    }
  }
  events.sort((left, right) => ms(left.at) - ms(right.at));

  const dayOf = (from: number, to: number, withOverdue: boolean): DashboardDay => {
    const inDay = events.filter((event) => {
      const at = ms(event.at);
      return (at >= from || (withOverdue && event.overdue)) && at < to;
    });
    return {
      pickups: inDay.filter((event) => event.kind === 'PICKUP'),
      returns: inDay.filter((event) => event.kind === 'RETURN'),
    };
  };

  const next7Days = Array.from({ length: 7 }, (_, index) => {
    const date = addCivilDays(today, index);
    const day = { start: civilStartMs(date), end: civilStartMs(addCivilDays(date, 1)) };
    const occupied = vehicles.filter((vehicle) =>
      agreements.some((agreement) => {
        if (agreement.vehicleId !== vehicle.id) return false;
        if (agreement.status !== 'RESERVED' && agreement.status !== 'IN_PROGRESS') return false;
        const interval = occupiedInterval(agreement, now);
        return interval.start.getTime() < day.end && interval.end.getTime() > day.start;
      }),
    ).length;
    return { date, occupied, total: vehicles.length };
  });

  const monthKey = today.slice(0, 7);
  const monthPeriod = { start: monthStartMs(nowMs), end: monthStartMs(nowMs, 1) };
  let monthIncome = 0;
  let monthAgreements = 0;
  let occupancy = 0;
  for (const vehicle of vehicles) {
    const p = profitCents(vehicle, agreements, [], monthPeriod, now, null);
    monthIncome += p.income;
    monthAgreements += p.agreements;
    occupancy += p.occupiedMs / (monthPeriod.end - monthPeriod.start);
  }

  const late = events.filter((event) => event.kind === 'RETURN' && event.overdue);
  const balances: DashboardBalance[] = agreements
    .flatMap((agreement) => {
      const vehicle = byId.get(agreement.vehicleId);
      if (vehicle === undefined) return [];
      if (agreement.status !== 'FINISHED' || moneyToCents(agreement.balance) <= 0) return [];
      return [
        {
          agreementId: agreement.id,
          contractNumber: agreement.contractNumber,
          customerName: agreement.customerName,
          vehicle: vehicleRef(vehicle),
          balance: agreement.balance,
          pickupAt: agreement.actualPickupAt ?? agreement.plannedPickupAt,
        },
      ];
    })
    .sort((left, right) => ms(left.pickupAt) - ms(right.pickupAt));

  const maintenanceDue: DashboardMaintenance[] = [];
  const documentsDue: DashboardDocument[] = [];
  for (const vehicle of vehicles) {
    const tasks: DashboardMaintenance['tasks'] = [];
    for (const task of input.plan) {
      const last = input.lastServices.find(
        (service) => service.vehicleId === vehicle.id && service.taskId === task.id,
      );
      const result = taskStatus({
        task,
        last: last === undefined ? null : last,
        odometerKm: vehicle.odometerKm,
        today,
        alerts,
      });
      if (result.status === 'DUE' || result.status === 'SOON') {
        tasks.push({ name: task.name, status: result.status });
      }
    }
    if (tasks.length > 0) {
      maintenanceDue.push({
        vehicle: vehicleRef(vehicle),
        tasks,
        status: tasks.some((task) => task.status === 'DUE') ? 'DUE' : 'SOON',
      });
    }
    const documents: [VehicleDocumentKind, string | null][] = [
      ['INSURANCE', vehicle.insuranceExpiresAt],
      ['REGISTRATION', vehicle.registrationExpiresAt],
    ];
    for (const [kind, expiresAt] of documents) {
      const status = documentStatus(expiresAt, today, alerts.daysAlert);
      if (status !== null && expiresAt !== null) {
        documentsDue.push({ vehicle: vehicleRef(vehicle), kind, expiresAt, ...status });
      }
    }
  }
  maintenanceDue.sort((left, right) =>
    left.status === right.status ? 0 : left.status === 'DUE' ? -1 : 1,
  );
  documentsDue.sort((left, right) => left.daysLeft - right.daysLeft);

  return {
    date: today,
    fleet,
    today: dayOf(todayStart, tomorrowStart, true),
    tomorrow: dayOf(tomorrowStart, dayAfterStart, false),
    next7Days,
    month: {
      month: monthKey,
      income: centsToMoney(monthIncome),
      agreements: monthAgreements,
      occupancy: vehicles.length > 0 ? round4(occupancy / vehicles.length) : 0,
    },
    pending: { late, balances, maintenanceDue, documentsDue },
  };
}
