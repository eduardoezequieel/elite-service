import {
  addCivilDays,
  buildEmployeePerformance,
  buildPerformanceReport,
  civilDaysBetween,
  resolveReturnsRange,
  roundToTenth,
  washMinutes,
} from './performance';
import type {
  PerformanceFollowUpRecord,
  PerformanceLineRecord,
  PerformanceSnapshot,
  PerformanceWashRecord,
} from './performance';

const SEDAN = { id: 'bt-sedan', name: 'Sedán' };
const SUV = { id: 'bt-suv', name: 'Camioneta' };

const ANA = { employeeId: 'emp-ana', fullName: 'Ana', isActive: true };
const BETO = { employeeId: 'emp-beto', fullName: 'Beto', isActive: true };
const CARLOS = { employeeId: 'emp-carlos', fullName: 'Carlos', isActive: false };

const RANGE = { from: '2026-08-01', to: '2026-08-31' };
const SAME_RETURNS = { returnsFrom: RANGE.from, returnsTo: RANGE.to, returnsShifted: false };

/** 9:00 en El Salvador (UTC−6) de ese día, más `minutes`. */
function at(date: string, minutes = 0): Date {
  return new Date(new Date(`${date}T15:00:00.000Z`).getTime() + minutes * 60_000);
}

function main(price = 1000): PerformanceLineRecord {
  return { kind: 'SERVICE', serviceName: 'Lavado', unitPrice: price, total: price, isExtra: false };
}

function extra(name: string, price: number): PerformanceLineRecord {
  return { kind: 'SERVICE', serviceName: name, unitPrice: price, total: price, isExtra: true };
}

let sequence = 0;

function wash(overrides: Partial<PerformanceWashRecord> = {}): PerformanceWashRecord {
  sequence += 1;
  const date = '2026-08-10';

  return {
    workOrderId: `wo-${sequence}`,
    ticketNumber: `CW-${String(sequence).padStart(4, '0')}`,
    vehicleId: `veh-${sequence}`,
    plate: `P${sequence}`,
    bodyTypeId: SEDAN.id,
    bodyTypeName: SEDAN.name,
    chargedAt: at(date, 120),
    washingStartedAt: at(date),
    readyEventTimes: [at(date, 30)],
    lines: [main()],
    washers: [ANA],
    commissions: [],
    ...overrides,
  };
}

function snapshot(
  washes: PerformanceWashRecord[],
  followUps: PerformanceFollowUpRecord[] = [],
): PerformanceSnapshot {
  return {
    activeEmployees: [
      { id: BETO.employeeId, fullName: BETO.fullName },
      { id: ANA.employeeId, fullName: ANA.fullName },
    ],
    bodyTypes: [SEDAN, SUV],
    washes,
    followUps,
  };
}

describe('fechas civiles', () => {
  it('suma y resta días cruzando meses', () => {
    expect(addCivilDays('2026-09-26', -30)).toBe('2026-08-27');
    expect(addCivilDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('cuenta días entre dos fechas', () => {
    expect(civilDaysBetween('2026-08-01', '2026-08-31')).toBe(30);
    expect(civilDaysBetween('2026-08-31', '2026-08-01')).toBe(-30);
  });
});

describe('resolveReturnsRange (067 RN-6)', () => {
  const today = '2026-09-26'; // corte = 2026-08-27

  it('si el rango ya pasó el corte, mide el mismo rango', () => {
    expect(resolveReturnsRange({ from: '2026-08-01', to: '2026-08-27' }, today)).toEqual({
      returnsFrom: '2026-08-01',
      returnsTo: '2026-08-27',
      returnsShifted: false,
    });
  });

  it('si `from` es anterior al corte, recorta el final en el corte', () => {
    expect(resolveReturnsRange({ from: '2026-08-01', to: '2026-09-26' }, today)).toEqual({
      returnsFrom: '2026-08-01',
      returnsTo: '2026-08-27',
      returnsShifted: true,
    });
  });

  it('si todo el rango es posterior al corte, lo corre hacia atrás con el mismo largo', () => {
    // «Este mes»: 1–26 sept = 25 días de diferencia → 2 ago–27 ago.
    expect(resolveReturnsRange({ from: '2026-09-01', to: '2026-09-26' }, today)).toEqual({
      returnsFrom: '2026-08-02',
      returnsTo: '2026-08-27',
      returnsShifted: true,
    });
  });

  it('un solo día de hoy se mide sobre el día del corte', () => {
    expect(resolveReturnsRange({ from: today, to: today }, today)).toEqual({
      returnsFrom: '2026-08-27',
      returnsTo: '2026-08-27',
      returnsShifted: true,
    });
  });
});

describe('washMinutes (067 RN-2)', () => {
  const start = at('2026-08-10');

  it('va de «Lavando» a la última entrada a «Listo» posterior', () => {
    expect(washMinutes(start, [at('2026-08-10', 20), at('2026-08-10', 45)])).toBe(45);
  });

  it('ignora un «Listo» anterior al inicio', () => {
    expect(washMinutes(start, [at('2026-08-10', -10)])).toBeNull();
    expect(washMinutes(start, [at('2026-08-10', -10), at('2026-08-10', 12)])).toBe(12);
  });

  it('sin inicio o sin «Listo» no hay tiempo', () => {
    expect(washMinutes(null, [at('2026-08-10', 20)])).toBeNull();
    expect(washMinutes(start, [])).toBeNull();
  });

  it('redondea a un decimal sin -0', () => {
    expect(roundToTenth(12.345)).toBe(12.3);
    expect(roundToTenth(-0.04)).toBe(0);
  });
});

describe('buildPerformanceReport', () => {
  it('tiempo del equipo por tipo de carro y de cada empleado contra el equipo (RN-2, RN-3)', () => {
    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot([
        wash({ washers: [ANA], readyEventTimes: [at('2026-08-10', 20)] }),
        wash({ washers: [BETO], readyEventTimes: [at('2026-08-10', 40)] }),
        wash({
          washers: [BETO],
          bodyTypeId: SUV.id,
          bodyTypeName: SUV.name,
          readyEventTimes: [at('2026-08-10', 60)],
        }),
        wash({ washers: [ANA], washingStartedAt: null, readyEventTimes: [] }),
      ]),
    );

    expect(report.team.washCount).toBe(4);
    expect(report.team.timedCount).toBe(3);
    expect(report.team.untimedCount).toBe(1);
    expect(report.team.avgMinutes).toBe(40);
    expect(report.team.minutesVsTeam).toBeNull();
    expect(report.team.byBodyType).toEqual([
      { bodyTypeId: SEDAN.id, bodyTypeName: SEDAN.name, timedCount: 2, avgMinutes: 30 },
      { bodyTypeId: SUV.id, bodyTypeName: SUV.name, timedCount: 1, avgMinutes: 60 },
    ]);

    const [ana, beto] = report.employees;

    expect(ana.fullName).toBe('Ana');
    expect(ana.minutesVsTeam).toBe(-10);
    expect(ana.untimedCount).toBe(1);
    // Beto: sedán +10, camioneta 0 → promedio +5.
    expect(beto.minutesVsTeam).toBe(5);
    expect(beto.byBodyType[1]).toEqual({
      bodyTypeId: SUV.id,
      bodyTypeName: SUV.name,
      timedCount: 1,
      avgMinutes: 60,
    });
  });

  it('extras: solo servicios de categorías extra, más vendido primero (RN-4)', () => {
    const product: PerformanceLineRecord = {
      kind: 'PRODUCT',
      serviceName: 'Aromatizante',
      unitPrice: 300,
      total: 600,
      isExtra: false,
    };

    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot([
        wash({ lines: [main(), extra('Tapicería', 2500), product] }),
        wash({ lines: [main(), extra('Silvines', 1500), extra('Tapicería', 2000)] }),
        wash({ lines: [main(), product] }),
      ]),
    );

    expect(report.team.withExtrasCount).toBe(2);
    expect(report.team.extrasTotal).toBe('60.00');
    expect(report.team.extras).toEqual([
      { serviceName: 'Tapicería', count: 2, total: '45.00' },
      { serviceName: 'Silvines', count: 1, total: '15.00' },
    ]);
  });

  it('ventas y comisión salen de lo congelado; los productos no son venta del que lavó (RN-7)', () => {
    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot([
        wash({
          lines: [
            main(1400),
            { kind: 'PRODUCT', serviceName: 'Cera', unitPrice: 500, total: 500, isExtra: false },
          ],
          commissions: [{ employeeId: ANA.employeeId, amount: 100 }],
        }),
      ]),
    );

    expect(report.team.salesAttributed).toBe('14.00');
    expect(report.team.commission).toBe('1.00');
    expect(report.employees[0].commission).toBe('1.00');
  });

  it('inactivos: fuera de las filas y de las cifras; sin activo el lavado no cuenta (RN-1, RN-8)', () => {
    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot([
        wash({ washers: [CARLOS], commissions: [{ employeeId: CARLOS.employeeId, amount: 100 }] }),
        wash({ washers: [] }),
        wash({ washers: [ANA] }),
      ]),
    );

    expect(report.team.washCount).toBe(1);
    expect(report.team.commission).toBe('0.00');
    expect(report.employees.map((row) => row.employeeId)).toEqual([ANA.employeeId]);
    expect(report.activeEmployees).toEqual([
      { id: ANA.employeeId, fullName: 'Ana' },
      { id: BETO.employeeId, fullName: 'Beto' },
    ]);
  });

  it('un lavado compartido del legado cuenta para cada uno y una vez para el equipo (RN-1)', () => {
    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot([
        wash({
          washers: [ANA, BETO],
          lines: [main(1001), extra('Tapicería', 2000)],
          commissions: [
            { employeeId: ANA.employeeId, amount: 150 },
            { employeeId: BETO.employeeId, amount: 150 },
          ],
        }),
      ]),
    );

    expect(report.team.washCount).toBe(1);
    expect(report.team.withExtrasCount).toBe(1);
    expect(report.team.salesAttributed).toBe('30.01');
    expect(report.team.commission).toBe('3.00');
    expect(
      report.employees.map((row) => [row.fullName, row.washCount, row.salesAttributed]),
    ).toEqual([
      ['Ana', 1, '15.00'],
      ['Beto', 1, '15.01'],
    ]);
  });

  it('un compartido con un inactivo cuenta solo la parte del activo', () => {
    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot([
        wash({
          washers: [CARLOS, ANA],
          lines: [main(2000)],
          commissions: [
            { employeeId: CARLOS.employeeId, amount: 100 },
            { employeeId: ANA.employeeId, amount: 100 },
          ],
        }),
      ]),
    );

    expect(report.team.washCount).toBe(1);
    expect(report.team.salesAttributed).toBe('10.00');
    expect(report.team.commission).toBe('1.00');
  });

  it('clientes fieles: el siguiente lavado del carro dentro de 30 días civiles (RN-5)', () => {
    const back = wash({ vehicleId: 'veh-back', chargedAt: at('2026-08-10', 120) });
    const late = wash({ vehicleId: 'veh-late', chargedAt: at('2026-08-10', 120) });
    const never = wash({ vehicleId: 'veh-never' });

    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot(
        [back, late, never],
        [
          // El segundo es posterior: manda el primero.
          {
            workOrderId: 'f-2',
            vehicleId: 'veh-back',
            createdAt: at('2026-08-25'),
            washerNames: [],
          },
          {
            workOrderId: 'f-1',
            vehicleId: 'veh-back',
            createdAt: at('2026-08-17'),
            washerNames: ['Beto'],
          },
          {
            workOrderId: 'f-3',
            vehicleId: 'veh-late',
            createdAt: at('2026-09-10'),
            washerNames: [],
          },
        ],
      ),
    );

    expect(report.team.measuredCount).toBe(3);
    expect(report.team.returnedCount).toBe(1);
    expect(report.team.avgReturnDays).toBe(7);
  });

  it('30 días justos vuelve; 31 ya no', () => {
    const edge = wash({ vehicleId: 'veh-a', chargedAt: at('2026-08-01', 120) });
    const over = wash({ vehicleId: 'veh-b', chargedAt: at('2026-08-01', 120) });

    const report = buildPerformanceReport(
      RANGE,
      SAME_RETURNS,
      snapshot(
        [edge, over],
        [
          { workOrderId: 'f-a', vehicleId: 'veh-a', createdAt: at('2026-08-31'), washerNames: [] },
          { workOrderId: 'f-b', vehicleId: 'veh-b', createdAt: at('2026-09-01'), washerNames: [] },
        ],
      ),
    );

    expect(report.team.returnedCount).toBe(1);
    expect(report.team.avgReturnDays).toBe(30);
  });

  it('con el rango corrido, fieles se mide en el otro rango y las cifras en el pedido (RN-6)', () => {
    const range = { from: '2026-09-01', to: '2026-09-26' };
    const returns = { returnsFrom: '2026-08-02', returnsTo: '2026-08-27', returnsShifted: true };
    const old = wash({ washers: [BETO], chargedAt: at('2026-08-20') });
    const recent = wash({ washers: [ANA], chargedAt: at('2026-09-10') });

    const report = buildPerformanceReport(range, returns, snapshot([old, recent]));

    expect(report).toMatchObject(returns);
    expect(report.team.washCount).toBe(1);
    expect(report.team.measuredCount).toBe(1);
    // Beto no lavó en el rango pero sí en el de fieles: tiene fila.
    expect(report.employees.map((row) => [row.fullName, row.washCount, row.measuredCount])).toEqual(
      [
        ['Ana', 1, 0],
        ['Beto', 0, 1],
      ],
    );
  });

  it('sin lavados: cifras en cero', () => {
    const report = buildPerformanceReport(RANGE, SAME_RETURNS, snapshot([]));

    expect(report.employees).toEqual([]);
    expect(report.team).toEqual({
      washCount: 0,
      salesAttributed: '0.00',
      commission: '0.00',
      timedCount: 0,
      untimedCount: 0,
      avgMinutes: null,
      byBodyType: [
        { bodyTypeId: SEDAN.id, bodyTypeName: SEDAN.name, timedCount: 0, avgMinutes: null },
        { bodyTypeId: SUV.id, bodyTypeName: SUV.name, timedCount: 0, avgMinutes: null },
      ],
      minutesVsTeam: null,
      withExtrasCount: 0,
      extrasTotal: '0.00',
      extras: [],
      measuredCount: 0,
      returnedCount: 0,
      avgReturnDays: null,
    });
  });
});

describe('buildEmployeePerformance', () => {
  it('sus lavados, más reciente primero, con tiempo, extras y la vuelta', () => {
    const first = wash({
      washers: [ANA],
      vehicleId: 'veh-1',
      chargedAt: at('2026-08-05', 120),
      washingStartedAt: at('2026-08-05'),
      readyEventTimes: [at('2026-08-05', 25)],
      lines: [main(1000), extra('Tapicería', 2500)],
    });
    const second = wash({
      washers: [ANA],
      chargedAt: at('2026-08-12', 120),
      washingStartedAt: null,
      readyEventTimes: [],
      lines: [
        main(800),
        { kind: 'SERVICE', serviceName: 'Motor', unitPrice: 500, total: 500, isExtra: false },
      ],
    });
    const other = wash({ washers: [BETO], readyEventTimes: [at('2026-08-10', 35)] });

    const detail = buildEmployeePerformance(
      RANGE,
      SAME_RETURNS,
      { id: ANA.employeeId, fullName: 'Ana' },
      snapshot(
        [first, second, other],
        [
          {
            workOrderId: 'f-1',
            vehicleId: 'veh-1',
            createdAt: at('2026-08-19'),
            washerNames: ['Beto'],
          },
        ],
      ),
    );

    expect(detail.employee).toEqual({ id: ANA.employeeId, fullName: 'Ana' });
    expect(detail.teamEmployeeCount).toBe(2);
    expect(detail.figures.washCount).toBe(2);
    expect(detail.team.washCount).toBe(3);
    expect(detail.washes.map((line) => line.workOrderId)).toEqual([
      second.workOrderId,
      first.workOrderId,
    ]);
    expect(detail.washes[0]).toMatchObject({
      mainServiceName: 'Lavado + Motor',
      extras: [],
      extrasTotal: '0.00',
      total: '13.00',
      minutes: null,
      minutesVsTeam: null,
    });
    // Equipo sedán: (25 + 35) / 2 = 30 → Ana −5.
    expect(detail.washes[1]).toMatchObject({
      extras: [{ serviceName: 'Tapicería', total: '25.00' }],
      extrasTotal: '25.00',
      total: '35.00',
      minutes: 25,
      minutesVsTeam: -5,
    });
    expect(detail.returns).toEqual([
      expect.objectContaining({ workOrderId: second.workOrderId, returnedAfterDays: null }),
      expect.objectContaining({
        workOrderId: first.workOrderId,
        returnedAfterDays: 14,
        returnedWithName: 'Beto',
      }),
    ]);
  });

  it('sin lavados: cifras en cero y listas vacías', () => {
    const detail = buildEmployeePerformance(
      RANGE,
      SAME_RETURNS,
      { id: ANA.employeeId, fullName: 'Ana' },
      snapshot([wash({ washers: [BETO] })]),
    );

    expect(detail.figures.washCount).toBe(0);
    expect(detail.figures.commission).toBe('0.00');
    expect(detail.figures.minutesVsTeam).toBeNull();
    expect(detail.washes).toEqual([]);
    expect(detail.returns).toEqual([]);
    expect(detail.team.washCount).toBe(1);
  });
});
