import type { MaintenancePlanTask } from '@elite/shared';

import {
  activeTasks,
  apiDraftErrors,
  draftOf,
  draftUnchanged,
  parseNewTask,
  parseTaskEdit,
} from './plan-task-draft';

const task = (over: Partial<MaintenancePlanTask>): MaintenancePlanTask => ({
  id: 't1',
  key: 'oil',
  name: 'Aceite',
  intervalKm: 5000,
  intervalDays: 90,
  sortOrder: 0,
  isActive: true,
  ...over,
});

describe('plan de servicio en Ajustes (123)', () => {
  it('muestra solo las activas, en el orden del plan', () => {
    const rows = activeTasks([
      task({ id: 'a', name: 'Llantas', sortOrder: 2 }),
      task({ id: 'b', name: 'Viejo', isActive: false }),
      task({ id: 'c', name: 'Aceite', sortOrder: 1 }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['c', 'a']);
  });

  it('una tarea sin km se escribe vacía y vuelve como null', () => {
    const draft = draftOf(task({ intervalKm: null }));
    expect(draft).toEqual({ name: 'Aceite', intervalKm: '', intervalDays: '90' });

    const parsed = parseTaskEdit(draft);
    expect(parsed).toEqual({
      ok: true,
      input: { name: 'Aceite', intervalKm: null, intervalDays: 90 },
    });
  });

  it('una nueva sin nombre o con un número mal escrito no se manda', () => {
    const parsed = parseNewTask({ name: ' ', intervalKm: '5k', intervalDays: '' });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.name).toBeDefined();
      expect(parsed.errors.intervalKm).toBeDefined();
      expect(parsed.errors.intervalDays).toBeUndefined();
    }
  });

  it('una nueva válida', () => {
    expect(parseNewTask({ name: 'Frenos', intervalKm: '20000', intervalDays: '' })).toEqual({
      ok: true,
      input: { name: 'Frenos', intervalKm: 20000, intervalDays: null },
    });
  });

  it('sin cambios no hace falta guardar', () => {
    const saved = task({});
    expect(draftUnchanged({ name: 'Aceite ', intervalKm: '5000', intervalDays: '90' }, saved)).toBe(
      true,
    );
    expect(draftUnchanged({ name: 'Aceite', intervalKm: '6000', intervalDays: '90' }, saved)).toBe(
      false,
    );
  });

  it('lee los errores del API campo por campo', () => {
    expect(apiDraftErrors({ name: 'Ya existe.', other: 'x' })).toEqual({ name: 'Ya existe.' });
    expect(apiDraftErrors(null)).toEqual({});
  });
});
