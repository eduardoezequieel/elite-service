import type {
  CivilRange,
  PerformanceFollowUpRecord,
  PerformanceWashRecord,
} from '../../domain/performance';

/**
 * Lo que Rendimiento (067) lee de la base. Devuelve registros planos: el
 * calculo entero vive en `domain/performance.ts`.
 */
export interface PerformanceRepository {
  /** Empleados activos, por nombre. */
  listActiveEmployees(): Promise<{ id: string; fullName: string }[]>;
  /** Cualquier empleado, activo o no: el caso de uso decide el 404. */
  findEmployee(id: string): Promise<{ id: string; fullName: string; isActive: boolean } | null>;
  /** Tipos de carro activos, en su `sortOrder`. */
  listActiveBodyTypes(): Promise<{ id: string; name: string }[]>;
  /**
   * Lavados CARWASH `PAID` con `chargedAt` en alguno de los rangos civiles y al
   * menos un asignado activo (RN-1).
   */
  listPaidWashes(ranges: readonly CivilRange[]): Promise<PerformanceWashRecord[]>;
  /**
   * Lavados CARWASH no anulados de esos carros creados despues de `after` y
   * antes de `before`: los candidatos a «la vuelta» (RN-5).
   */
  listFollowUps(
    vehicleIds: readonly string[],
    after: Date,
    before: Date,
  ): Promise<PerformanceFollowUpRecord[]>;
}

export const PERFORMANCE_REPOSITORY = Symbol('carwash.PerformanceRepository');
