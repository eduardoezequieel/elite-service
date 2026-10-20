import type { AvailabilityRow } from '@elite/shared';

import {
  fieldsOfRange,
  freeCars,
  firstBlockedStep,
  isPickable,
  leavesToday,
  newRentalBody,
  newRentalMoney,
  newRentalStart,
  newRentalStepError,
  notBeforeNow,
  returnsChip,
  withTime,
  type NewRentalValues,
  type StepContext,
} from './new-rental';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const VEHICLE = '22222222-2222-4222-8222-222222222222';
const TODAY = '2026-10-19';
const PRICE = { dailyRate: '35.00', billableDays: 3 };

function values(changes: Partial<NewRentalValues> = {}): NewRentalValues {
  return {
    ...newRentalStart({ vehicleId: VEHICLE, customerId: CUSTOMER }, TODAY).values,
    ...changes,
  };
}

const OK: StepContext = {
  now: '2026-10-19T08:00',
  price: PRICE,
  customer: { licenseExpired: false, blocked: false },
};

describe('arranque (118)', () => {
  it('sin carro en Carro; con carro en Cliente; con carro y cliente en Contrato', () => {
    expect(newRentalStart({}, TODAY).step).toBe(1);
    expect(newRentalStart({ vehicleId: VEHICLE }, TODAY).step).toBe(2);
    expect(newRentalStart({ vehicleId: VEHICLE, customerId: CUSTOMER }, TODAY).step).toBe(3);
    expect(newRentalStart({}, TODAY).values).toMatchObject({
      plannedPickupAt: '2026-10-19T11:00',
      plannedReturnAt: '2026-10-20T11:00',
      insurance: false,
    });
  });
});

describe('fechas y horas (118)', () => {
  it('el rango conserva las horas y un solo día vuelve al siguiente', () => {
    expect(
      fieldsOfRange(
        { from: '2026-10-22', to: '2026-10-22' },
        '2026-10-19T09:30',
        '2026-10-20T18:00',
      ),
    ).toEqual({ pickupAt: '2026-10-22T09:30', returnAt: '2026-10-23T18:00' });
    expect(withTime('2026-10-19T11:00', '15:45')).toBe('2026-10-19T15:45');
    expect(withTime('2026-10-19T11:00', '')).toBe('2026-10-19T11:00');
  });

  it('la salida no queda antes de ahora; el regreso, detrás de ella', () => {
    expect(notBeforeNow('2026-10-19T11:00', '2026-10-20T11:00', '2026-10-19T21:00')).toEqual({
      plannedPickupAt: '2026-10-19T21:00',
      plannedReturnAt: '2026-10-20T11:00',
    });
    expect(notBeforeNow('2026-10-19T11:00', '2026-10-19T20:00', '2026-10-19T21:00')).toEqual({
      plannedPickupAt: '2026-10-19T21:00',
      plannedReturnAt: '2026-10-20T21:00',
    });
    expect(notBeforeNow('2026-10-22T09:00', '2026-10-23T09:00', '2026-10-19T21:00')).toEqual({
      plannedPickupAt: '2026-10-22T09:00',
      plannedReturnAt: '2026-10-23T09:00',
    });
    expect(newRentalStart({}, TODAY, '2026-10-19T21:00').values.plannedPickupAt).toBe(
      '2026-10-19T21:00',
    );
  });

  it('sale hoy (o antes) pregunta si se lo lleva', () => {
    expect(leavesToday('2026-10-19T15:00', TODAY)).toBe(true);
    expect(leavesToday('2026-10-20T09:00', TODAY)).toBe(false);
  });
});

describe('dinero (118, 124)', () => {
  it('la cobertura suma el cargo escrito; el descuento resta', () => {
    expect(newRentalMoney(values(), PRICE)).toEqual({
      cdwPerDay: '0.00',
      subtotal: '105.00',
      discount: '0.00',
      total: '105.00',
    });
    expect(
      newRentalMoney(values({ insurance: true, cdwPerDay: '5', discount: '10,5' }), PRICE),
    ).toEqual({
      cdwPerDay: '5.00',
      subtotal: '120.00',
      discount: '10.50',
      total: '109.50',
    });
  });

  it('un cargo de cero (o vacío) no suma nada', () => {
    for (const cdwPerDay of ['0', '']) {
      expect(newRentalMoney(values({ insurance: true, cdwPerDay }), PRICE).total).toBe('105.00');
    }
  });
});

describe('lo que frena cada paso (118)', () => {
  it('Carro: fechas y carro', () => {
    expect(newRentalStepError(1, values({ plannedReturnAt: '2026-10-19T10:00' }), OK)).toBe(
      'Revise las fechas',
    );
    expect(newRentalStepError(1, values({ vehicleId: '' }), OK)).toBe('Elija un carro');
    expect(newRentalStepError(1, values(), { ...OK, now: '2026-10-19T21:00' })).toBe(
      'La salida ya pasó',
    );
    expect(newRentalStepError(1, values(), OK)).toBeNull();
  });

  it('Cliente: elegido, sin bloqueo y con la licencia al día (RN-2)', () => {
    expect(newRentalStepError(2, values(), { ...OK, customer: null })).toBe('Elija un cliente');
    expect(
      newRentalStepError(2, values(), {
        ...OK,
        customer: { licenseExpired: true, blocked: false },
      }),
    ).toBe('La licencia está vencida');
    expect(
      newRentalStepError(2, values(), {
        ...OK,
        customer: { licenseExpired: false, blocked: true },
      }),
    ).toBe('No rentar');
  });

  it('Contrato: descuento leíble, no negativo, hasta el subtotal (RN-1); deducible con cobertura', () => {
    expect(newRentalStepError(3, values({ discount: 'diez' }), OK)).toBe('Revise el descuento');
    expect(newRentalStepError(3, values({ discount: '-1' }), OK)).toBe('Revise el descuento');
    expect(newRentalStepError(3, values({ discount: '105.01' }), OK)).toBe(
      'El descuento no puede pasar de $105',
    );
    expect(newRentalStepError(3, values({ discount: '105' }), OK)).toBeNull();
    expect(newRentalStepError(3, values({ insurance: true, cdwPerDay: '5' }), OK)).toBe(
      'Falta cuánto paga si choca',
    );
    expect(
      newRentalStepError(3, values({ insurance: true, cdwPerDay: 'x', deductible: '500' }), OK),
    ).toBe('Revise el cargo por día');
    expect(
      newRentalStepError(
        3,
        values({ insurance: true, cdwPerDay: '5', deductible: '500', discount: '120' }),
        OK,
      ),
    ).toBeNull();
    expect(
      newRentalStepError(3, values({ insurance: true, cdwPerDay: '0', deductible: '500' }), OK),
    ).toBeNull();
    expect(newRentalStepError(3, values({ hasAdditionalDriver: true }), OK)).toBe(
      'Falta el nombre del conductor',
    );
  });

  it('Contrato: con garantía hace falta su método', () => {
    expect(newRentalStepError(3, values({ deposit: '-5' }), OK)).toBe('Revise la garantía');
    expect(newRentalStepError(3, values({ deposit: '100' }), OK)).toBe(
      'Falta el método de la garantía',
    );
    expect(newRentalStepError(3, values({ deposit: '100', depositMethod: 'CASH' }), OK)).toBeNull();
    expect(newRentalStepError(3, values({ deposit: '0' }), OK)).toBeNull();
  });

  it('saltar adelante se frena en el primer paso pendiente', () => {
    expect(firstBlockedStep(4, values({ vehicleId: '' }), OK)).toEqual({
      step: 1,
      message: 'Elija un carro',
    });
    expect(firstBlockedStep(4, values(), OK)).toBeNull();
  });
});

describe('el alta (118)', () => {
  it('con cobertura: el cargo y el deducible escritos, cobertura aceptada (124)', () => {
    const body = newRentalBody(
      values({ insurance: true, cdwPerDay: '7.5', deductible: '500', discount: '10' }),
    );

    expect(body.ok && body.value).toMatchObject({
      customerId: CUSTOMER,
      vehicleId: VEHICLE,
      coverage: 'ACCEPTED',
      cdwPerDay: '7.50',
      deductible: '500.00',
      discount: '10.00',
      plannedPickupAt: '2026-10-19T17:00:00.000Z',
    });
  });

  it('con cobertura y el cargo vacío viaja cero, no el de ajustes', () => {
    const body = newRentalBody(values({ insurance: true, cdwPerDay: '', deductible: '500' }));

    expect(body.ok && body.value).toMatchObject({ coverage: 'ACCEPTED', cdwPerDay: '0.00' });
  });

  it('sin cobertura: CDW en cero y cobertura declinada, sin deducible', () => {
    const body = newRentalBody(values({ cdwPerDay: '5', deductible: '500' }));

    expect(body.ok && body.value).toMatchObject({ coverage: 'DECLINED', cdwPerDay: '0.00' });
    expect(body.ok && body.value.deductible).toBeUndefined();
  });

  it('sin garantía no viaja el método que quedó elegido', () => {
    const body = newRentalBody(values({ deposit: '', depositMethod: 'CASH' }));

    expect(body.ok && body.value.depositMethod).toBeNull();
  });
});

describe('los carros libres del paso Carro (118)', () => {
  function row(
    plate: string,
    model: string,
    category: 'SEDAN' | 'SUV',
    total: string,
    availability: AvailabilityRow['availability'] = 'FREE',
  ): AvailabilityRow {
    return {
      vehicle: { id: plate, plate, make: 'Toyota', model, year: 2022, category },
      availability,
      blocking: null,
      billableDays: 2,
      dailyRate: '35.00',
      estimatedTotal: total,
    } as unknown as AvailabilityRow;
  }
  const rows = [
    row('P300', 'Corolla', 'SEDAN', '90.00'),
    row('P100', 'RAV4', 'SUV', '70.00'),
    row('P200', 'Yaris', 'SEDAN', '70.00'),
    row('P400', 'Hilux', 'SUV', '50.00', 'BUSY'),
  ];
  const plates = (list: AvailabilityRow[]) => list.map((item) => item.vehicle.plate);

  it('sin los ocupados, del más barato al más caro y por placa', () => {
    expect(plates(freeCars(rows, '', ''))).toEqual(['P100', 'P200', 'P300']);
  });

  it('filtra por tipo y por placa o modelo, sin tildes ni mayúsculas', () => {
    expect(plates(freeCars(rows, '', 'SUV'))).toEqual(['P100']);
    expect(plates(freeCars(rows, 'corolla', ''))).toEqual(['P300']);
    expect(plates(freeCars(rows, 'p2', 'SEDAN'))).toEqual(['P200']);
    expect(freeCars(rows, 'hilux', '')).toEqual([]);
  });

  it('los que vuelven antes de la salida entran después de los libres, por precio y placa', () => {
    const mixed = [
      ...rows,
      row('P600', 'Yaris', 'SEDAN', '40.00', 'FREE_IF_RETURNED'),
      row('P500', 'Yaris', 'SEDAN', '40.00', 'FREE_IF_RETURNED'),
      row('P050', 'Hiace', 'SUV', '20.00', 'FREE_IF_RETURNED'),
    ];

    expect(plates(freeCars(mixed, '', ''))).toEqual([
      'P100',
      'P200',
      'P300',
      'P050',
      'P500',
      'P600',
    ]);
    expect(plates(freeCars(mixed, '', 'SUV'))).toEqual(['P100', 'P050']);
  });

  it('elegible: libre o libre si regresa; ocupado no', () => {
    expect(isPickable({ availability: 'FREE' })).toBe(true);
    expect(isPickable({ availability: 'FREE_IF_RETURNED' })).toBe(true);
    expect(isPickable({ availability: 'BUSY' })).toBe(false);
  });

  it('el chip dice el día del regreso planificado, o la etiqueta si no hay renta', () => {
    const back = {
      ...row('P500', 'Yaris', 'SEDAN', '40.00', 'FREE_IF_RETURNED'),
      blocking: { plannedReturnAt: '2026-10-17T15:00:00.000Z' },
    } as unknown as AvailabilityRow;

    expect(returnsChip(back)).toBe('Vuelve sáb 17 oct');
    expect(returnsChip(row('P501', 'Yaris', 'SEDAN', '40.00', 'FREE_IF_RETURNED'))).toBe(
      'Libre si regresa a tiempo',
    );
    expect(returnsChip(row('P100', 'RAV4', 'SUV', '70.00'))).toBeNull();
  });
});
