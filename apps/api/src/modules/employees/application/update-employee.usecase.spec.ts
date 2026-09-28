import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { Employee } from '../domain/employee';
import { FakePinDigest } from './testing/fake-pin.digest';
import { InMemoryEmployeeRepository } from './testing/in-memory-employee.repository';
import { UpdateEmployeeUseCase } from './update-employee.usecase';

const carlos: Employee = {
  id: 'employee-carlos',
  username: 'carlos',
  fullName: 'Carlos Melgar',
  pinHash: 'digest:123456',
  isActive: true,
  pinChangedAt: new Date('2026-01-01T08:00:00Z'),
  createdAt: new Date('2026-01-01T08:00:00Z'),
  updatedAt: new Date('2026-01-01T08:00:00Z'),
};

function build(seed: Employee[] = [carlos]) {
  const employees = new InMemoryEmployeeRepository(seed);
  const pins = new FakePinDigest();

  return {
    employees,
    update: new UpdateEmployeeUseCase(employees, pins),
  };
}

describe('UpdateEmployeeUseCase', () => {
  it('404 si el empleado no existe', async () => {
    const { update } = build();

    const failure = await captureApiError(update.execute('nadie', { fullName: 'X' }));

    expect(failure.status).toBe(404);
  });

  it('deja editar sin chocar contra su propio usuario', async () => {
    const { update } = build();

    const updated = await update.execute('employee-carlos', {
      username: 'carlos',
      fullName: 'Carlos A. Melgar',
    });

    expect(updated.fullName).toBe('Carlos A. Melgar');
  });

  it('rechaza tomar el usuario de otro', async () => {
    const { update } = build([carlos, { ...carlos, id: 'employee-ana', username: 'ana' }]);

    const failure = await captureApiError(update.execute('employee-ana', { username: 'carlos' }));

    expect(failure.body.code).toBe(API_ERROR_CODES.USERNAME_TAKEN);
  });

  /**
   * Lo que hace que reemplazar el PIN cierre las sesiones abiertas: el hash y
   * la marca se mueven juntos. Mover uno sin el otro deja vivas justo las
   * sesiones que había que cerrar (RN-18).
   */
  it('corre `pinChangedAt` al reemplazar el PIN', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { pin: '987600' });

    const stored = await employees.findById('employee-carlos');

    expect(stored?.pinHash).toBe('digest:987600');
    expect(stored?.pinChangedAt.getTime()).toBeGreaterThan(carlos.pinChangedAt.getTime());
  });

  it('no toca `pinChangedAt` cuando el cambio no incluye el PIN', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { fullName: 'Carlos M.' });

    expect((await employees.findById('employee-carlos'))?.pinChangedAt).toEqual(
      carlos.pinChangedAt,
    );
  });

  it('rechaza tomar el PIN de otro (044 RN-3)', async () => {
    const { update } = build([
      carlos,
      { ...carlos, id: 'employee-ana', username: 'ana', pinHash: 'digest:777777' },
    ]);

    const failure = await captureApiError(update.execute('employee-ana', { pin: '123456' }));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.PIN_TAKEN);
  });

  it('deja reponer el mismo PIN que ya tenía, sin chocar contra sí mismo', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { pin: '123456' });

    expect((await employees.findById('employee-carlos'))?.pinHash).toBe('digest:123456');
  });

  it('desactiva sin eliminar (RN-13)', async () => {
    const { update, employees } = build();

    const updated = await update.execute('employee-carlos', { isActive: false });

    expect(updated.isActive).toBe(false);
    expect(await employees.findById('employee-carlos')).not.toBeNull();
  });

  describe('con lavados sin terminar (090)', () => {
    const washes = [
      { id: 't1', number: 'CW-0001', plate: 'P001', status: 'WASHING' as const },
      { id: 't2', number: 'CW-0002', plate: 'P002', status: 'OPEN' as const },
    ];

    it('no lo desactiva y dice cuáles', async () => {
      const { update, employees } = build();

      employees.unfinished.set('employee-carlos', washes);

      const failure = await captureApiError(
        update.execute('employee-carlos', { isActive: false }),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.EMPLOYEE_HAS_ACTIVE_TICKETS);
      expect(failure.body.message).toBe(
        'Carlos Melgar tiene 2 lavados sin terminar: P001, P002. Pasalos a otro o marcalos listos antes de desactivarlo.',
      );
      expect(failure.body.details).toEqual({
        tickets: [
          { ticketId: 't1', number: 'CW-0001', plate: 'P001', status: 'WASHING' },
          { ticketId: 't2', number: 'CW-0002', plate: 'P002', status: 'OPEN' },
        ],
      });
      expect((await employees.findById('employee-carlos'))?.isActive).toBe(true);
    });

    it('con uno solo, lo dice en singular', async () => {
      const { update, employees } = build();

      employees.unfinished.set('employee-carlos', [washes[0]]);

      const failure = await captureApiError(
        update.execute('employee-carlos', { isActive: false }),
      );

      expect(failure.body.message).toBe(
        'Carlos Melgar tiene un lavado sin terminar: P001. Pasalo a otro o marcalo listo antes de desactivarlo.',
      );
    });

    it('deja cambiar el nombre sin desactivarlo', async () => {
      const { update, employees } = build();

      employees.unfinished.set('employee-carlos', washes);

      const updated = await update.execute('employee-carlos', { fullName: 'Carlos A. Melgar' });

      expect(updated.fullName).toBe('Carlos A. Melgar');
    });
  });
});
