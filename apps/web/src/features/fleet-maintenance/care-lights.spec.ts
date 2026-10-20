import type { MaintenanceTaskStatus } from '@elite/shared';

import {
  dialCaption,
  dialFocus,
  documentLight,
  litCount,
  needleAngle,
  odometerDigits,
  taskIcon,
  taskLight,
} from './care-lights';

function task(overrides: Partial<MaintenanceTaskStatus> = {}): MaintenanceTaskStatus {
  return {
    task: { id: 't1', key: 'oil', name: 'Cambio de aceite', intervalKm: 5000, intervalDays: 90 },
    status: 'OK',
    kmLeft: 4000,
    daysLeft: 80,
    lastAt: '2026-10-09',
    lastKm: 86000,
    score: 0.8,
    line: null,
    dueWithinDays: null,
    ...overrides,
  };
}

describe('care-lights (122)', () => {
  it('elige el ícono por la clave y cae en la llave inglesa', () => {
    expect(taskIcon('oil')).toBe('oil');
    expect(taskIcon('cambio_de_aceite')).toBe('oil');
    expect(taskIcon('brakes')).toBe('brakes');
    expect(taskIcon('rotacion_de_llantas')).toBe('tires');
    expect(taskIcon('air_filter')).toBe('air');
    expect(taskIcon('revision_de_bateria')).toBe('battery');
    expect(taskIcon('coolant')).toBe('coolant');
    expect(taskIcon('general')).toBe('wrench');
  });

  it('da el tono y la frase de cada estado de una tarea', () => {
    const ok = taskLight(task());
    expect(ok).toMatchObject({ tone: 'ok', state: 'Bien', detail: 'quedan 4.000 km' });
    expect(ok.used).toBeCloseTo(0.2);
    expect(taskLight(task({ kmLeft: null })).detail).toBe('toca en 80 días');

    expect(
      taskLight(task({ status: 'SOON', kmLeft: 300, daysLeft: 60, score: 0.06 })),
    ).toMatchObject({ tone: 'soon', state: 'Quedan 300 km' });
    expect(
      taskLight(task({ status: 'DUE', kmLeft: -1200, daysLeft: 10, score: -0.24 })),
    ).toMatchObject({ tone: 'due', state: '1.200 km de más', used: 1 });
    expect(taskLight(task({ status: 'DUE', kmLeft: 3000, daysLeft: -3, score: -0.03 })).state).toBe(
      'Venció hace 3 días',
    );
    expect(
      taskLight(task({ status: 'NO_DATA', kmLeft: null, daysLeft: null, score: null })),
    ).toMatchObject({ tone: 'none', state: 'Sin dato', used: 0 });
  });

  it('lee los papeles con documentStatus y sin fecha queda gris', () => {
    const today = '2026-10-19';
    expect(documentLight('INSURANCE', null, today, 7)).toMatchObject({
      tone: 'none',
      state: 'Sin fecha',
      name: 'Seguro',
    });
    expect(documentLight('INSURANCE', '2026-10-16', today, 7)).toMatchObject({
      tone: 'due',
      state: 'Venció hace 3 días',
    });
    expect(documentLight('REGISTRATION', '2026-10-20', today, 7)).toMatchObject({
      tone: 'soon',
      state: 'Vence mañana',
      name: 'Tarjeta de circulación',
    });
    expect(documentLight('REGISTRATION', '2027-03-12', today, 7)).toMatchObject({
      tone: 'ok',
      state: 'Vence el 12 mar',
    });
  });

  it('el medidor marca lo más urgente, si no lo más gastado, y la línea lo dice', () => {
    const ok = taskLight(task());
    const older = taskLight(
      task({ task: { ...task().task, id: 't2', name: 'Frenos' }, score: 0.3 }),
    );
    const soon = taskLight(task({ status: 'SOON', kmLeft: 300, score: 0.06 }));
    const due = taskLight(task({ status: 'DUE', kmLeft: -10, score: -0.01 }));
    const none = taskLight(task({ status: 'NO_DATA', kmLeft: null, daysLeft: null, score: null }));

    expect(dialFocus([ok, soon, due])).toBe(due);
    expect(dialFocus([ok, older])).toBe(older);
    expect(dialFocus([none])).toBeNull();
    expect(dialCaption(null)).toEqual({ kind: 'empty', text: 'Todavía no hay nada anotado.' });
    expect(dialCaption(due)).toMatchObject({ lead: 'Lo más urgente:', detail: '10 km de más' });
    expect(dialCaption(older)).toMatchObject({ lead: 'Todo bien. Lo próximo es', name: 'Frenos' });
    expect(litCount([ok, soon, due, none])).toBe(2);
  });

  it('gira la aguja y arma el odómetro', () => {
    expect(needleAngle(0)).toBe(-90);
    expect(needleAngle(1)).toBe(90);
    expect(needleAngle(2)).toBe(90);
    expect(odometerDigits(87420)).toEqual(['0', '8', '7', '4', '2', '0']);
    expect(odometerDigits(1234567)).toHaveLength(7);
  });
});
