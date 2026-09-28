import { presetRange } from '@/lib/civil-date';
import {
  barScaleMax,
  commissionsRedirectHref,
  firstName,
  formatMinutes,
  minutesDelta,
  percent,
  performanceHref,
  performanceViewFrom,
  plural,
  pointsDelta,
  rangeLabel,
} from './performance';

describe('performanceViewFrom (067)', () => {
  it('lee pestaña, empleado y rango de la URL', () => {
    expect(
      performanceViewFrom({
        tab: 'times',
        employee: 'e1',
        start: '2026-08-01',
        end: '2026-08-31',
      }),
    ).toEqual({
      tab: 'times',
      employeeId: 'e1',
      range: { from: '2026-08-01', to: '2026-08-31' },
    });
  });

  it('sin nada arranca en Resumen, todo el equipo y «Este mes»', () => {
    expect(performanceViewFrom({})).toEqual({
      tab: 'summary',
      employeeId: null,
      range: presetRange('month'),
    });
  });

  it('descarta una pestaña desconocida, un empleado vacío y valores repetidos', () => {
    expect(performanceViewFrom({ tab: 'returns', employee: '' })).toMatchObject({
      tab: 'summary',
      employeeId: null,
    });
    expect(performanceViewFrom({ tab: ['extras'], employee: ['e1', 'e2'] })).toMatchObject({
      tab: 'summary',
      employeeId: null,
    });
  });
});

describe('performanceHref (067)', () => {
  const range = { from: '2026-09-01', to: '2026-09-26' };

  it('no escribe Resumen ni el equipo', () => {
    expect(performanceHref({ tab: 'summary', employeeId: null, range })).toBe(
      '/carwash/performance?start=2026-09-01&end=2026-09-26',
    );
  });

  it('escribe pestaña y empleado cuando los hay', () => {
    expect(performanceHref({ tab: 'loyalty', employeeId: 'e1', range })).toBe(
      '/carwash/performance?tab=loyalty&employee=e1&start=2026-09-01&end=2026-09-26',
    );
  });

  it('ida y vuelta por la URL da la misma vista', () => {
    const view = { tab: 'extras' as const, employeeId: 'e9', range };
    const params = new URLSearchParams(performanceHref(view).split('?')[1]);

    expect(
      performanceViewFrom({
        tab: params.get('tab'),
        employee: params.get('employee'),
        start: params.get('start'),
        end: params.get('end'),
      }),
    ).toEqual(view);
  });
});

describe('commissionsRedirectHref (067)', () => {
  it('manda el reporte viejo a la pestaña Comisiones con su rango', () => {
    expect(commissionsRedirectHref({ start: '2026-08-01', end: '2026-08-31' })).toBe(
      '/carwash/performance?tab=commissions&start=2026-08-01&end=2026-08-31',
    );
  });

  it('manda el detalle viejo con el empleado', () => {
    expect(
      commissionsRedirectHref({ employee: 'e1', start: '2026-08-01', end: '2026-08-31' }),
    ).toBe('/carwash/performance?tab=commissions&employee=e1&start=2026-08-01&end=2026-08-31');
  });

  it('no copia un rango roto', () => {
    expect(commissionsRedirectHref({ start: '2026-08-31', end: '2026-08-01' })).toBe(
      '/carwash/performance?tab=commissions',
    );
    expect(commissionsRedirectHref({ start: '2026-02-30', end: undefined })).toBe(
      '/carwash/performance?tab=commissions',
    );
  });
});

describe('palabras de Rendimiento (067)', () => {
  it('dice el tiempo contra el equipo con palabras, nunca solo color', () => {
    expect(minutesDelta(-4.4)).toEqual({ text: '4 min más rápido que el promedio', tone: 'go' });
    expect(minutesDelta(6.6, true)).toEqual({ text: '7 min más lento', tone: 'warn' });
    expect(minutesDelta(0.3, true)).toEqual({ text: 'en el promedio', tone: 'neutral' });
    expect(minutesDelta(null)).toEqual({ text: 'sin medir', tone: 'neutral' });
  });

  it('compara porcentajes en puntos', () => {
    expect(pointsDelta(45, 40)).toEqual({ text: '5 puntos más', tone: 'go' });
    expect(pointsDelta(39, 40)).toEqual({ text: '1 punto menos', tone: 'warn' });
    expect(pointsDelta(40, 40)).toEqual({ text: 'igual', tone: 'neutral' });
    expect(pointsDelta(null, 40)).toEqual({ text: '', tone: 'neutral' });
  });

  it('redondea minutos y porcentajes', () => {
    expect(formatMinutes(33.6)).toBe('34 min');
    expect(formatMinutes(null)).toBe('—');
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 0)).toBeNull();
  });

  it('pluraliza y recorta el nombre', () => {
    expect(plural(1, 'lavado', 'lavados')).toBe('1 lavado');
    expect(plural(0, 'lavado', 'lavados')).toBe('0 lavados');
    expect(firstName('  Carlos Méndez ')).toBe('Carlos');
  });

  it('nombra el rango corto', () => {
    expect(rangeLabel('2026-09-26', '2026-09-26')).toBe('26 sept');
    expect(rangeLabel('2026-09-01', '2026-09-26')).toBe('1 – 26 sept');
    expect(rangeLabel('2026-08-28', '2026-09-03')).toBe('28 ago – 3 sept');
  });

  it('la escala deja aire y respeta la marca del promedio', () => {
    expect(barScaleMax([10, 20])).toBeCloseTo(21.6);
    expect(barScaleMax([10, 20], 30)).toBeCloseTo(32.4);
    expect(barScaleMax([])).toBe(0);
  });
});
