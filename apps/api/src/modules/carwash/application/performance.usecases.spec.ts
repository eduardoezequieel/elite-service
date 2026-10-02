import { API_ERROR_CODES } from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import type {
  CivilRange,
  PerformanceFollowUpRecord,
  PerformanceWashRecord,
} from '../domain/performance';
import { PerformanceUseCases } from './performance.usecases';
import type { PerformanceRepository } from './ports/performance.repository';

const PAGE = { page: 1, pageSize: 25 };
const EMPTY_PAGE = { items: [], page: 1, pageSize: 25, total: 0 };

class InMemoryPerformanceRepository implements PerformanceRepository {
  employees = [
    { id: 'emp-ana', fullName: 'Ana', isActive: true },
    { id: 'emp-old', fullName: 'Oscar', isActive: false },
  ];
  washes: PerformanceWashRecord[] = [];
  followUps: PerformanceFollowUpRecord[] = [];
  washQueries: CivilRange[][] = [];
  followUpQueries: { vehicleIds: readonly string[]; after: Date; before: Date }[] = [];

  async listActiveEmployees(): Promise<{ id: string; fullName: string }[]> {
    return this.employees
      .filter((employee) => employee.isActive)
      .map(({ id, fullName }) => ({ id, fullName }));
  }

  async findEmployee(
    id: string,
  ): Promise<{ id: string; fullName: string; isActive: boolean } | null> {
    return this.employees.find((employee) => employee.id === id) ?? null;
  }

  async listActiveBodyTypes(): Promise<{ id: string; name: string }[]> {
    return [{ id: 'bt-sedan', name: 'Sedán' }];
  }

  async listPaidWashes(ranges: readonly CivilRange[]): Promise<PerformanceWashRecord[]> {
    this.washQueries.push([...ranges]);

    return this.washes;
  }

  async listFollowUps(
    vehicleIds: readonly string[],
    after: Date,
    before: Date,
  ): Promise<PerformanceFollowUpRecord[]> {
    this.followUpQueries.push({ vehicleIds, after, before });

    return this.followUps;
  }
}

/** 26 sept 2026, 10:00 en El Salvador. Corte de fieles: 27 ago. */
const NOW = new Date('2026-09-26T16:00:00.000Z');

function wash(chargedAt: string, vehicleId = 'veh-1'): PerformanceWashRecord {
  return {
    workOrderId: `wo-${chargedAt}`,
    ticketNumber: 'CW-0001',
    vehicleId,
    plate: 'P123',
    bodyTypeId: 'bt-sedan',
    bodyTypeName: 'Sedán',
    chargedAt: new Date(chargedAt),
    washingStartedAt: null,
    readyEventTimes: [],
    lines: [
      { kind: 'SERVICE', serviceName: 'Lavado', unitPrice: 1000, total: 1000, isExtra: false },
    ],
    washers: [{ employeeId: 'emp-ana', fullName: 'Ana', isActive: true }],
    commissions: [],
  };
}

describe('PerformanceUseCases', () => {
  let repository: InMemoryPerformanceRepository;
  let useCases: PerformanceUseCases;

  beforeEach(() => {
    repository = new InMemoryPerformanceRepository();
    useCases = new PerformanceUseCases(repository, () => NOW);
  });

  describe('report', () => {
    it('sin fechas usa hoy–hoy, como comisiones, y corre el rango de fieles (RN-6)', async () => {
      const report = await useCases.report(PAGE);

      expect(report.from).toBe('2026-09-26');
      expect(report.to).toBe('2026-09-26');
      expect(report).toMatchObject({
        returnsFrom: '2026-08-27',
        returnsTo: '2026-08-27',
        returnsShifted: true,
      });
      expect(repository.washQueries).toEqual([
        [
          { from: '2026-09-26', to: '2026-09-26' },
          { from: '2026-08-27', to: '2026-08-27' },
        ],
      ]);
    });

    it('un rango viejo se mide igual y pide los lavados una sola vez', async () => {
      const report = await useCases.report({ from: '2026-07-01', to: '2026-07-31', ...PAGE });

      expect(report.returnsShifted).toBe(false);
      expect(repository.washQueries).toEqual([[{ from: '2026-07-01', to: '2026-07-31' }]]);
    });

    it('rango vacío → cifras en cero, sin buscar vueltas', async () => {
      const report = await useCases.report({ from: '2026-09-01', to: '2026-09-26', ...PAGE });

      expect(report.team.washCount).toBe(0);
      expect(report.team.commission).toBe('0.00');
      expect(report.team.avgMinutes).toBeNull();
      expect(report.employees).toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
      expect(report.activeEmployees).toEqual([{ id: 'emp-ana', fullName: 'Ana' }]);
      expect(repository.followUpQueries).toEqual([]);
    });

    it('busca las vueltas solo de los carros del rango de fieles', async () => {
      repository.washes = [
        wash('2026-08-10T17:00:00.000Z', 'veh-measured'),
        wash('2026-09-10T17:00:00.000Z', 'veh-recent'),
      ];
      repository.followUps = [
        {
          workOrderId: 'wo-next',
          vehicleId: 'veh-measured',
          createdAt: new Date('2026-08-15T17:00:00.000Z'),
          washerNames: [],
        },
      ];

      const report = await useCases.report({ from: '2026-09-01', to: '2026-09-26', ...PAGE });

      expect(repository.followUpQueries).toHaveLength(1);
      expect(repository.followUpQueries[0].vehicleIds).toEqual(['veh-measured']);
      expect(repository.followUpQueries[0].after).toEqual(new Date('2026-08-10T17:00:00.000Z'));
      expect(report.team.washCount).toBe(1);
      expect(report.team.measuredCount).toBe(1);
      expect(report.team.returnedCount).toBe(1);
      expect(report.team.avgReturnDays).toBe(5);
    });
  });

  describe('paginado (102)', () => {
    it('la tabla del equipo se corta; `team` cuenta todos los lavados', async () => {
      repository.employees = [
        { id: 'emp-ana', fullName: 'Ana', isActive: true },
        { id: 'emp-beto', fullName: 'Beto', isActive: true },
      ];
      repository.washes = [
        wash('2026-09-26T15:00:00.000Z'),
        {
          ...wash('2026-09-26T15:30:00.000Z'),
          washers: [{ employeeId: 'emp-beto', fullName: 'Beto', isActive: true }],
        },
      ];

      const report = await useCases.report({ page: 2, pageSize: 1 });

      expect(report.employees).toMatchObject({ page: 2, pageSize: 1, total: 2 });
      expect(report.employees.items.map((row) => row.employeeId)).toEqual(['emp-beto']);
      expect(report.team.washCount).toBe(2);
    });

    it('el detalle corta lavados, extras y vueltas con la misma página', async () => {
      const plain = wash('2026-09-26T14:00:00.000Z');
      const withExtra = {
        ...wash('2026-09-26T15:00:00.000Z'),
        lines: [
          ...plain.lines,
          {
            kind: 'SERVICE' as const,
            serviceName: 'Cera',
            unitPrice: 300,
            total: 300,
            isExtra: true,
          },
        ],
      };
      repository.washes = [plain, withExtra, { ...wash('2026-09-26T13:00:00.000Z') }];

      const detail = await useCases.employee('emp-ana', { page: 1, pageSize: 2 });

      expect(detail.washes).toMatchObject({ page: 1, pageSize: 2, total: 3 });
      expect(detail.washes.items).toHaveLength(2);
      expect(detail.extraWashes.total).toBe(1);
      expect(detail.extraWashes.items[0].workOrderId).toBe(withExtra.workOrderId);
      expect(detail.figures.washCount).toBe(3);
    });
  });

  describe('employee', () => {
    it('id inexistente → 404 NOT_FOUND', async () => {
      await expect(useCases.employee('emp-missing', PAGE)).rejects.toMatchObject({
        code: API_ERROR_CODES.NOT_FOUND,
      });
      await expect(useCases.employee('emp-missing', PAGE)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('empleado inactivo → 404: Rendimiento no lo muestra (RN-8)', async () => {
      await expect(useCases.employee('emp-old', PAGE)).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.washQueries).toEqual([]);
    });

    it('activo sin lavados → cifras en cero', async () => {
      const detail = await useCases.employee('emp-ana', {
        from: '2026-09-01',
        to: '2026-09-26',
        ...PAGE,
      });

      expect(detail.employee).toEqual({ id: 'emp-ana', fullName: 'Ana' });
      expect(detail.figures.washCount).toBe(0);
      expect(detail.figures.salesAttributed).toBe('0.00');
      expect(detail.teamEmployeeCount).toBe(0);
      expect(detail.washes).toEqual(EMPTY_PAGE);
      expect(detail.extraWashes).toEqual(EMPTY_PAGE);
      expect(detail.returns).toEqual(EMPTY_PAGE);
    });
  });
});
