import { API_ERROR_CODES } from '@elite/shared';
import type {
  PageQuery,
  PerformanceEmployeeDetail,
  PerformanceQuery,
  PerformanceReport,
  PerformanceReturnsRange,
} from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import { slicePage } from '../../../common/pagination/page';
import { civilDateInBusinessZone, resolveCommissionRange } from '../domain/commission';
import {
  RETURN_WINDOW_DAYS,
  buildEmployeePerformance,
  buildPerformanceReport,
  resolveReturnsRange,
} from '../domain/performance';
import type {
  CivilRange,
  PerformanceEmployeeLines,
  PerformanceSnapshot,
} from '../domain/performance';
import type { PerformanceRepository } from './ports/performance.repository';

/** Margen de sobra para la ventana de 30 dias civiles, sin importar la zona. */
const FOLLOW_UP_WINDOW_MS = (RETURN_WINDOW_DAYS + 2) * 86_400_000;

/**
 * Rendimiento del lavado (067). Arma el rango igual que comisiones (009), corre
 * el de fieles segun RN-6 y deja el calculo al dominio.
 */
export class PerformanceUseCases {
  constructor(
    private readonly performance: PerformanceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async report(query: PerformanceQuery): Promise<PerformanceReport> {
    const { range, returns } = this.ranges(query);
    const snapshot = await this.snapshot(range, returns);

    const report = buildPerformanceReport(range, returns, snapshot);

    // `team` ya se conto sobre todos; la pagina solo corta la tabla (102).
    return { ...report, employees: slicePage(report.employees, query) };
  }

  /** Un inactivo es 404: Rendimiento no lo muestra (RN-8). */
  async employee(employeeId: string, query: PerformanceQuery): Promise<PerformanceEmployeeDetail> {
    const employee = await this.performance.findEmployee(employeeId);

    if (employee === null || !employee.isActive) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      });
    }

    const { range, returns } = this.ranges(query);
    const snapshot = await this.snapshot(range, returns);

    return pageEmployeeLines(buildEmployeePerformance(range, returns, employee, snapshot), query);
  }

  private ranges(query: PerformanceQuery): { range: CivilRange; returns: PerformanceReturnsRange } {
    const today = civilDateInBusinessZone(this.now());
    const range = resolveCommissionRange(query.from, query.to, today);
    const returns = resolveReturnsRange(range, today);

    return { range, returns };
  }

  private async snapshot(
    range: CivilRange,
    returns: PerformanceReturnsRange,
  ): Promise<PerformanceSnapshot> {
    const returnsRange = { from: returns.returnsFrom, to: returns.returnsTo };
    const ranges = returns.returnsShifted ? [range, returnsRange] : [range];

    const [activeEmployees, bodyTypes, washes] = await Promise.all([
      this.performance.listActiveEmployees(),
      this.performance.listActiveBodyTypes(),
      this.performance.listPaidWashes(ranges),
    ]);

    // Solo los lavados del rango de fieles buscan su vuelta (RN-5, RN-6). El
    // dominio vuelve a recortar por dia civil; aca basta con no traer de menos.
    const measured = washes.filter((wash) => {
      const date = civilDateInBusinessZone(wash.chargedAt);

      return date >= returnsRange.from && date <= returnsRange.to;
    });

    if (measured.length === 0) return { activeEmployees, bodyTypes, washes, followUps: [] };

    // Sin spread: `Math.min(...lista)` revienta la pila con rangos largos.
    const times = measured.map((wash) => wash.chargedAt.getTime());
    const first = times.reduce((min, time) => Math.min(min, time));
    const last = times.reduce((max, time) => Math.max(max, time));

    const followUps = await this.performance.listFollowUps(
      [...new Set(measured.map((wash) => wash.vehicleId))],
      new Date(first),
      new Date(last + FOLLOW_UP_WINDOW_MS),
    );

    return { activeEmployees, bodyTypes, washes, followUps };
  }
}

/**
 * Las tres listas del detalle, cortadas con la misma pagina (102): cada pestana
 * muestra una sola. Las cifras ya salieron de todos los lavados.
 */
function pageEmployeeLines(
  detail: PerformanceEmployeeLines,
  query: PageQuery,
): PerformanceEmployeeDetail {
  return {
    ...detail,
    washes: slicePage(detail.washes, query),
    extraWashes: slicePage(
      detail.washes.filter((wash) => wash.extras.length > 0),
      query,
    ),
    returns: slicePage(detail.returns, query),
  };
}
