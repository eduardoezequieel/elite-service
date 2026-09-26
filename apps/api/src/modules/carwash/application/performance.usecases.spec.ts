import { NotFoundException } from '@nestjs/common';

import type {
  CivilRange,
  PerformanceFollowUpRecord,
  PerformanceWashRecord,
} from '../domain/performance';
import { PerformanceUseCases } from './performance.usecases';
import type { PerformanceRepository } from './ports/performance.repository';

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
      const report = await useCases.report({});

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
      const report = await useCases.report({ from: '2026-07-01', to: '2026-07-31' });

      expect(report.returnsShifted).toBe(false);
      expect(repository.washQueries).toEqual([[{ from: '2026-07-01', to: '2026-07-31' }]]);
    });

    it('rango vacío → cifras en cero, sin buscar vueltas', async () => {
      const report = await useCases.report({ from: '2026-09-01', to: '2026-09-26' });

      expect(report.team.washCount).toBe(0);
      expect(report.team.commission).toBe('0.00');
      expect(report.team.avgMinutes).toBeNull();
      expect(report.employees).toEqual([]);
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

      const report = await useCases.report({ from: '2026-09-01', to: '2026-09-26' });

      expect(repository.followUpQueries).toHaveLength(1);
      expect(repository.followUpQueries[0].vehicleIds).toEqual(['veh-measured']);
      expect(repository.followUpQueries[0].after).toEqual(new Date('2026-08-10T17:00:00.000Z'));
      expect(report.team.washCount).toBe(1);
      expect(report.team.measuredCount).toBe(1);
      expect(report.team.returnedCount).toBe(1);
      expect(report.team.avgReturnDays).toBe(5);
    });
  });

  describe('employee', () => {
    it('id inexistente → 404 NOT_FOUND', async () => {
      await expect(useCases.employee('emp-missing', {})).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
      await expect(useCases.employee('emp-missing', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('empleado inactivo → 404: Rendimiento no lo muestra (RN-8)', async () => {
      await expect(useCases.employee('emp-old', {})).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.washQueries).toEqual([]);
    });

    it('activo sin lavados → cifras en cero', async () => {
      const detail = await useCases.employee('emp-ana', { from: '2026-09-01', to: '2026-09-26' });

      expect(detail.employee).toEqual({ id: 'emp-ana', fullName: 'Ana' });
      expect(detail.figures.washCount).toBe(0);
      expect(detail.figures.salesAttributed).toBe('0.00');
      expect(detail.teamEmployeeCount).toBe(0);
      expect(detail.washes).toEqual([]);
      expect(detail.returns).toEqual([]);
    });
  });
});
