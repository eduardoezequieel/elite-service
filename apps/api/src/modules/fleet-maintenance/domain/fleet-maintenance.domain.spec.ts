import { splitCents, taskKeyFrom } from './plan-task';
import { reminderDate, taskDetail } from './reminders';

describe('plan de mantenimiento (099)', () => {
  it('arma la clave con el nombre, sin tildes, y le suma un número si choca', () => {
    expect(taskKeyFrom('Revisión de Suspensión', () => false)).toBe('revision_de_suspension');
    expect(taskKeyFrom('Oil', (key) => key === 'oil')).toBe('oil_2');
  });

  it('reparte el costo en partes que suman el total', () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
    expect(splitCents(1, 3)).toEqual([1, 0, 0]);
    expect(splitCents(4550, 1)).toEqual([4550]);
  });
});

describe('recordatorios (099)', () => {
  it('describe lo que falta y lo que se pasó', () => {
    expect(taskDetail({ kmLeft: -300, daysLeft: 50 })).toBe('se pasó por 300 km, faltan 50 días');
    expect(taskDetail({ kmLeft: null, daysLeft: 0 })).toBe('le toca hoy');
    expect(taskDetail({ kmLeft: null, daysLeft: 1 })).toBe('falta 1 día');
  });

  it('el día del recordatorio: hoy si venció; si no, lo primero entre días y km al ritmo de rentas', () => {
    expect(reminderDate({ status: 'DUE', kmLeft: -5, daysLeft: 3 }, 100, '2026-10-01')).toBe(
      '2026-10-01',
    );
    expect(reminderDate({ status: 'SOON', kmLeft: 400, daysLeft: 6 }, 100, '2026-10-01')).toBe(
      '2026-10-05',
    );
    expect(reminderDate({ status: 'SOON', kmLeft: 400, daysLeft: null }, 0, '2026-10-01')).toBe(
      '2026-10-01',
    );
  });
});
