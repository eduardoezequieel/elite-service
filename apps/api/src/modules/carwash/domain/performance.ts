import type {
  PerformanceBodyTime,
  PerformanceEmployeeDetail,
  PerformanceEmployeeRow,
  PerformanceExtraCount,
  PerformanceFigures,
  PerformanceReport,
  PerformanceReturnLine,
  PerformanceReturnsRange,
  PerformanceWashLine,
} from '@elite/shared';

import { civilDateInBusinessZone, commissionBaseOf, splitCommission } from './commission';
import type { Cents } from './money';
import { toDecimalString } from './money';

/**
 * El reporte con todas sus filas. El caso de uso lo pagina (102); `team` y
 * las cifras se calculan siempre sobre todo el rango.
 */
export type PerformanceReportRows = Omit<PerformanceReport, 'employees'> & {
  employees: PerformanceEmployeeRow[];
};

/** El detalle con todos sus lavados y vueltas, antes de paginar (102). */
export type PerformanceEmployeeLines = Omit<
  PerformanceEmployeeDetail,
  'washes' | 'extraWashes' | 'returns'
> & {
  washes: PerformanceWashLine[];
  returns: PerformanceReturnLine[];
};

/**
 * Rendimiento del lavado (spec 067): tiempos, extras y clientes fieles, del
 * equipo o de un empleado. Todo sale de registros planos que ya trajo el
 * repositorio; aca no hay base ni reloj.
 */

/** Dias civiles que un carro tiene para «volver» (RN-5). */
export const RETURN_WINDOW_DAYS = 30;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Una linea del lavado, reducida a lo que mide Rendimiento. */
export interface PerformanceLineRecord {
  kind: 'SERVICE' | 'PRODUCT';
  /** Snapshot del nombre de la linea. */
  serviceName: string;
  unitPrice: Cents;
  /** `unitPrice × quantity`, redondeado al centavo (065 RN-6). */
  total: Cents;
  /**
   * El servicio pertenece **hoy** a una categoria con `isExtra` (RN-4). Siempre
   * `false` en un producto o en una linea cuyo servicio ya no existe.
   */
  isExtra: boolean;
}

/** Un empleado asignado al lavado, en el orden de asignacion. */
export interface PerformanceWasherRecord {
  employeeId: string;
  fullName: string;
  isActive: boolean;
}

/** Un lavado PAID del area CARWASH, con lo que hace falta para medirlo. */
export interface PerformanceWashRecord {
  workOrderId: string;
  ticketNumber: string;
  vehicleId: string;
  plate: string;
  /** Snapshot del tipo de carro del lavado (RN-3). */
  bodyTypeId: string;
  bodyTypeName: string;
  chargedAt: Date;
  washingStartedAt: Date | null;
  /** Todas las entradas `STATUS` a `READY` del historial (046), en cualquier orden. */
  readyEventTimes: Date[];
  lines: PerformanceLineRecord[];
  /** Todos los asignados, activos o no, en orden de asignacion (009 RN-4). */
  washers: PerformanceWasherRecord[];
  /** `CommissionEntry` congeladas al cobrar (RN-7). */
  commissions: { employeeId: string; amount: Cents }[];
}

/** Un lavado posterior del mismo carro, candidato a «la vuelta» (RN-5). */
export interface PerformanceFollowUpRecord {
  workOrderId: string;
  vehicleId: string;
  createdAt: Date;
  /** Nombres de sus asignados, en orden de asignacion. */
  washerNames: string[];
}

export interface PerformanceSnapshot {
  activeEmployees: { id: string; fullName: string }[];
  /** Tipos de carro activos, en su `sortOrder`. */
  bodyTypes: { id: string; name: string }[];
  /** Lavados PAID con `chargedAt` en el rango o en el de fieles. */
  washes: PerformanceWashRecord[];
  /** Lavados CARWASH no anulados de esos carros, creados despues de algun cobro. */
  followUps: PerformanceFollowUpRecord[];
}

export interface CivilRange {
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// Fechas civiles
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` + `days` dias, en calendario puro (sin zona). */
export function addCivilDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Dias civiles de `from` a `to`. Negativo si `to` es anterior. */
export function civilDaysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);

  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY);
}

/**
 * El rango que miden los clientes fieles (RN-6). Solo cuentan lavados cuyos 30
 * dias ya pasaron: el corte es hoy − 30. Si el rango pedido llega mas aca del
 * corte, se corre hacia atras conservando su largo.
 */
export function resolveReturnsRange(range: CivilRange, today: string): PerformanceReturnsRange {
  const cutoff = addCivilDays(today, -RETURN_WINDOW_DAYS);

  if (range.to <= cutoff) {
    return { returnsFrom: range.from, returnsTo: range.to, returnsShifted: false };
  }

  const returnsFrom =
    range.from <= cutoff
      ? range.from
      : addCivilDays(cutoff, -civilDaysBetween(range.from, range.to));

  return {
    returnsFrom,
    returnsTo: cutoff,
    returnsShifted: returnsFrom !== range.from || cutoff !== range.to,
  };
}

// ---------------------------------------------------------------------------
// Tiempo (RN-2)
// ---------------------------------------------------------------------------

/**
 * Minutos de «Lavando» a la **ultima** entrada a «Listo» posterior a ese
 * momento (RN-2). Sin inicio o sin un «Listo» despues, `null`: el lavado queda
 * sin tiempo. Sin redondear: los promedios se redondean al final.
 */
export function washMinutes(
  washingStartedAt: Date | null,
  readyEventTimes: readonly Date[],
): number | null {
  if (washingStartedAt === null) return null;

  const start = washingStartedAt.getTime();
  const lastReady = readyEventTimes.reduce<number | null>((latest, time) => {
    const at = time.getTime();

    if (at <= start) return latest;

    return latest === null || at > latest ? at : latest;
  }, null);

  return lastReady === null ? null : (lastReady - start) / MS_PER_MINUTE;
}

/** Un decimal, sin `-0`. */
export function roundToTenth(value: number): number {
  const rounded = Math.round(value * 10) / 10;

  return Object.is(rounded, -0) ? 0 : rounded;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundedAverage(values: readonly number[]): number | null {
  const avg = average(values);

  return avg === null ? null : roundToTenth(avg);
}

// ---------------------------------------------------------------------------
// Preparacion: una vez por lavado, sirve al equipo y a cada empleado
// ---------------------------------------------------------------------------

interface WasherShare {
  employeeId: string;
  fullName: string;
  /** Su parte del total del lavado (009 RN-4), solo servicios (065 RN-8). */
  sales: Cents;
  /** Su `CommissionEntry.amount`; 0 si el lavado es anterior a la 009. */
  commission: Cents;
}

interface PreparedWash {
  record: PerformanceWashRecord;
  inRange: boolean;
  inReturns: boolean;
  minutes: number | null;
  vsTeam: number | null;
  extras: { serviceName: string; total: Cents }[];
  extrasTotal: Cents;
  mainServiceName: string | null;
  total: Cents;
  /** Solo los asignados activos (RN-8). Nunca vacio: sin activos no cuenta (RN-1). */
  activeWashers: WasherShare[];
  returnedAfterDays: number | null;
  returnedWithName: string | null;
}

function within(date: string, range: CivilRange): boolean {
  return date >= range.from && date <= range.to;
}

function activeSharesOf(wash: PerformanceWashRecord): WasherShare[] {
  const base = commissionBaseOf(wash.lines.map((line) => ({ kind: line.kind, total: line.total })));
  const shares = splitCommission(base, wash.washers.length);

  return wash.washers.flatMap((washer, index) =>
    washer.isActive
      ? [
          {
            employeeId: washer.employeeId,
            fullName: washer.fullName,
            sales: shares[index] ?? 0,
            commission: wash.commissions
              .filter((entry) => entry.employeeId === washer.employeeId)
              .reduce((sum, entry) => sum + entry.amount, 0),
          },
        ]
      : [],
  );
}

/**
 * La vuelta del carro (RN-5): el primer lavado no anulado del mismo vehiculo
 * creado despues del cobro. Vuelve si ese siguiente cae dentro de 30 dias
 * civiles; si el primero cae despues, ya no hay vuelta que contar.
 */
function returnOf(
  wash: PerformanceWashRecord,
  followUpsByVehicle: ReadonlyMap<string, readonly PerformanceFollowUpRecord[]>,
): { days: number; withName: string | null } | null {
  const candidates = followUpsByVehicle.get(wash.vehicleId) ?? [];
  const charged = wash.chargedAt.getTime();
  const next = candidates.find(
    (followUp) =>
      followUp.workOrderId !== wash.workOrderId && followUp.createdAt.getTime() > charged,
  );

  if (next === undefined) return null;

  const days = civilDaysBetween(
    civilDateInBusinessZone(wash.chargedAt),
    civilDateInBusinessZone(next.createdAt),
  );

  if (days > RETURN_WINDOW_DAYS) return null;

  return { days, withName: next.washerNames.length === 0 ? null : next.washerNames.join(', ') };
}

function prepare(
  range: CivilRange,
  returns: PerformanceReturnsRange,
  snapshot: PerformanceSnapshot,
): PreparedWash[] {
  const returnsRange = { from: returns.returnsFrom, to: returns.returnsTo };
  const followUpsByVehicle = new Map<string, PerformanceFollowUpRecord[]>();

  for (const followUp of [...snapshot.followUps].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )) {
    const list = followUpsByVehicle.get(followUp.vehicleId) ?? [];
    list.push(followUp);
    followUpsByVehicle.set(followUp.vehicleId, list);
  }

  const prepared = snapshot.washes.flatMap((record): PreparedWash[] => {
    const activeWashers = activeSharesOf(record);

    // RN-1: sin un asignado activo el lavado no cuenta (oficina o solo inactivos).
    if (activeWashers.length === 0) return [];

    const date = civilDateInBusinessZone(record.chargedAt);
    const inRange = within(date, range);
    const inReturns = within(date, returnsRange);

    if (!inRange && !inReturns) return [];

    const services = record.lines.filter((line) => line.kind === 'SERVICE');
    const extras = services
      .filter((line) => line.isExtra)
      .map((line) => ({ serviceName: line.serviceName, total: line.unitPrice }));
    const main = services.filter((line) => !line.isExtra).map((line) => line.serviceName);
    const back = inReturns ? returnOf(record, followUpsByVehicle) : null;

    return [
      {
        record,
        inRange,
        inReturns,
        minutes: washMinutes(record.washingStartedAt, record.readyEventTimes),
        vsTeam: null,
        extras,
        extrasTotal: extras.reduce((sum, extra) => sum + extra.total, 0),
        mainServiceName: main.length === 0 ? null : main.join(' + '),
        total: record.lines.reduce((sum, line) => sum + line.total, 0),
        activeWashers,
        returnedAfterDays: back?.days ?? null,
        returnedWithName: back?.withName ?? null,
      },
    ];
  });

  // RN-3: promedio del equipo por tipo de carro, sobre los medidos del rango.
  const teamMinutesByBody = new Map<string, number[]>();

  for (const wash of prepared) {
    if (!wash.inRange || wash.minutes === null) continue;

    const list = teamMinutesByBody.get(wash.record.bodyTypeId) ?? [];
    list.push(wash.minutes);
    teamMinutesByBody.set(wash.record.bodyTypeId, list);
  }

  const teamAvgByBody = new Map<string, number>();

  for (const [bodyTypeId, minutes] of teamMinutesByBody) {
    const avg = average(minutes);

    if (avg !== null) teamAvgByBody.set(bodyTypeId, avg);
  }

  for (const wash of prepared) {
    if (!wash.inRange || wash.minutes === null) continue;

    const teamAvg = teamAvgByBody.get(wash.record.bodyTypeId);

    wash.vsTeam = teamAvg === undefined ? null : wash.minutes - teamAvg;
  }

  return prepared;
}

// ---------------------------------------------------------------------------
// Cifras
// ---------------------------------------------------------------------------

type ShareOf = (wash: PreparedWash) => { sales: Cents; commission: Cents };

function figuresOf(
  washes: readonly PreparedWash[],
  bodyTypes: PerformanceSnapshot['bodyTypes'],
  shareOf: ShareOf,
  compareToTeam: boolean,
): PerformanceFigures {
  const inRange = washes.filter((wash) => wash.inRange);
  const measured = washes.filter((wash) => wash.inReturns);
  const timed = inRange.filter((wash) => wash.minutes !== null);

  let sales = 0;
  let commission = 0;

  for (const wash of inRange) {
    const share = shareOf(wash);
    sales += share.sales;
    commission += share.commission;
  }

  const byBodyType: PerformanceBodyTime[] = bodyTypes.map((bodyType) => {
    const minutes = timed
      .filter((wash) => wash.record.bodyTypeId === bodyType.id)
      .map((wash) => wash.minutes ?? 0);

    return {
      bodyTypeId: bodyType.id,
      bodyTypeName: bodyType.name,
      timedCount: minutes.length,
      avgMinutes: roundedAverage(minutes),
    };
  });

  const extrasByName = new Map<string, { count: number; total: Cents }>();

  for (const wash of inRange) {
    for (const extra of wash.extras) {
      const current = extrasByName.get(extra.serviceName) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += extra.total;
      extrasByName.set(extra.serviceName, current);
    }
  }

  const extras: PerformanceExtraCount[] = [...extrasByName.entries()]
    .sort(([leftName, left], [rightName, right]) => {
      if (left.count !== right.count) return right.count - left.count;
      if (left.total !== right.total) return right.total - left.total;

      return leftName.localeCompare(rightName, 'es');
    })
    .map(([serviceName, value]) => ({
      serviceName,
      count: value.count,
      total: toDecimalString(value.total),
    }));

  const returned = measured.filter((wash) => wash.returnedAfterDays !== null);

  return {
    washCount: inRange.length,
    salesAttributed: toDecimalString(sales),
    commission: toDecimalString(commission),
    timedCount: timed.length,
    untimedCount: inRange.length - timed.length,
    avgMinutes: roundedAverage(timed.map((wash) => wash.minutes ?? 0)),
    byBodyType,
    minutesVsTeam: compareToTeam
      ? roundedAverage(timed.flatMap((wash) => (wash.vsTeam === null ? [] : [wash.vsTeam])))
      : null,
    withExtrasCount: inRange.filter((wash) => wash.extras.length > 0).length,
    extrasTotal: toDecimalString(inRange.reduce((sum, wash) => sum + wash.extrasTotal, 0)),
    extras,
    measuredCount: measured.length,
    returnedCount: returned.length,
    avgReturnDays: roundedAverage(returned.map((wash) => wash.returnedAfterDays ?? 0)),
  };
}

/** El equipo: cada lavado una vez, con lo de todos sus asignados activos (RN-1, RN-8). */
const teamShare: ShareOf = (wash) =>
  wash.activeWashers.reduce(
    (sum, washer) => ({
      sales: sum.sales + washer.sales,
      commission: sum.commission + washer.commission,
    }),
    { sales: 0, commission: 0 },
  );

function employeeShare(employeeId: string): ShareOf {
  return (wash) => {
    const washer = wash.activeWashers.find((item) => item.employeeId === employeeId);

    return { sales: washer?.sales ?? 0, commission: washer?.commission ?? 0 };
  };
}

function washesOf(prepared: readonly PreparedWash[], employeeId: string): PreparedWash[] {
  return prepared.filter((wash) =>
    wash.activeWashers.some((washer) => washer.employeeId === employeeId),
  );
}

function byName<T extends { fullName: string }>(left: T, right: T): number {
  return left.fullName.localeCompare(right.fullName, 'es');
}

function newestFirst(left: PreparedWash, right: PreparedWash): number {
  return right.record.chargedAt.getTime() - left.record.chargedAt.getTime();
}

function roundOrNull(value: number | null): number | null {
  return value === null ? null : roundToTenth(value);
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

/** `GET /carwash/performance`: el equipo y una fila por empleado activo con lavados. */
export function buildPerformanceReport(
  range: CivilRange,
  returns: PerformanceReturnsRange,
  snapshot: PerformanceSnapshot,
): PerformanceReportRows {
  const prepared = prepare(range, returns, snapshot);
  const activeEmployees = [...snapshot.activeEmployees]
    .sort(byName)
    .map((employee) => ({ id: employee.id, fullName: employee.fullName }));

  const employees: PerformanceEmployeeRow[] = activeEmployees.flatMap((employee) => {
    const own = washesOf(prepared, employee.id);

    if (own.length === 0) return [];

    return [
      {
        employeeId: employee.id,
        fullName: employee.fullName,
        ...figuresOf(own, snapshot.bodyTypes, employeeShare(employee.id), true),
      },
    ];
  });

  return {
    from: range.from,
    to: range.to,
    ...returns,
    team: figuresOf(prepared, snapshot.bodyTypes, teamShare, false),
    employees,
    activeEmployees,
  };
}

/** `GET /carwash/performance/:employeeId`: lo suyo, el equipo al lado y sus lavados. */
export function buildEmployeePerformance(
  range: CivilRange,
  returns: PerformanceReturnsRange,
  employee: { id: string; fullName: string },
  snapshot: PerformanceSnapshot,
): PerformanceEmployeeLines {
  const prepared = prepare(range, returns, snapshot);
  const own = washesOf(prepared, employee.id);

  const teamEmployees = new Set(
    prepared
      .filter((wash) => wash.inRange)
      .flatMap((wash) => wash.activeWashers.map((washer) => washer.employeeId)),
  );

  const washes: PerformanceWashLine[] = own
    .filter((wash) => wash.inRange)
    .sort(newestFirst)
    .map((wash) => ({
      workOrderId: wash.record.workOrderId,
      ticketNumber: wash.record.ticketNumber,
      chargedAt: wash.record.chargedAt.toISOString(),
      plate: wash.record.plate,
      bodyTypeId: wash.record.bodyTypeId,
      bodyTypeName: wash.record.bodyTypeName,
      mainServiceName: wash.mainServiceName,
      extras: wash.extras.map((extra) => ({
        serviceName: extra.serviceName,
        total: toDecimalString(extra.total),
      })),
      extrasTotal: toDecimalString(wash.extrasTotal),
      total: toDecimalString(wash.total),
      minutes: roundOrNull(wash.minutes),
      minutesVsTeam: roundOrNull(wash.vsTeam),
    }));

  const returnLines: PerformanceReturnLine[] = own
    .filter((wash) => wash.inReturns)
    .sort(newestFirst)
    .map((wash) => ({
      workOrderId: wash.record.workOrderId,
      ticketNumber: wash.record.ticketNumber,
      chargedAt: wash.record.chargedAt.toISOString(),
      plate: wash.record.plate,
      bodyTypeName: wash.record.bodyTypeName,
      returnedAfterDays: wash.returnedAfterDays,
      returnedWithName: wash.returnedWithName,
    }));

  return {
    from: range.from,
    to: range.to,
    ...returns,
    employee: { id: employee.id, fullName: employee.fullName },
    figures: figuresOf(own, snapshot.bodyTypes, employeeShare(employee.id), true),
    team: figuresOf(prepared, snapshot.bodyTypes, teamShare, false),
    teamEmployeeCount: teamEmployees.size,
    washes,
    returns: returnLines,
  };
}
