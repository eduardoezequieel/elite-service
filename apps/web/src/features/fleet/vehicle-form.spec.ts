import type { FleetVehicle } from '@elite/shared';

import {
  EMPTY_FLEET_VEHICLE_FORM,
  createFleetVehicleFormSchema,
  fleetVehicleDraft,
  upcomingExpiries,
} from './vehicle-form';

const FILLED = {
  ...EMPTY_FLEET_VEHICLE_FORM,
  plate: 'p53 dbc',
  make: 'Toyota',
  model: 'Yaris',
  year: '2022',
  dailyRate: '35,50',
  insuranceExpiresAt: '05/03/2027',
};

describe('formulario de flota (095)', () => {
  it('arma el cuerpo con placa normalizada, montos y fechas del contrato', () => {
    const parsed = createFleetVehicleFormSchema.parse(FILLED);

    expect(parsed).toMatchObject({
      plate: 'P53DBC',
      year: 2022,
      dailyRate: '35.50',
      insuranceExpiresAt: '2027-03-05',
      odometerKm: 0,
      weeklyRate: null,
    });
  });

  it('sin placa viaja como null', () => {
    expect(createFleetVehicleFormSchema.parse({ ...FILLED, plate: '' }).plate).toBeNull();
  });

  it('una fecha mal escrita marca su campo', () => {
    const result = createFleetVehicleFormSchema.safeParse({ ...FILLED, purchasedAt: '31/02/2026' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['purchasedAt'],
      message: 'Escribí la fecha como dd/mm/aaaa.',
    });
  });

  it('sin financiamiento, sus campos se borran', () => {
    const draft = fleetVehicleDraft({ ...FILLED, financed: false, installment: '200' });

    expect(draft.installment).toBeNull();
    expect(fleetVehicleDraft({ ...FILLED, financed: true, installment: '200' }).installment).toBe(
      '200',
    );
  });
});

describe('upcomingExpiries', () => {
  const vehicle: Pick<FleetVehicle, 'insuranceExpiresAt' | 'registrationExpiresAt'> = {
    insuranceExpiresAt: '2026-10-05',
    registrationExpiresAt: '2026-09-30',
  };

  it('marca lo vencido y lo que vence dentro del aviso', () => {
    expect(upcomingExpiries(vehicle, '2026-10-01', 7)).toEqual([
      { label: 'Seguro', date: '2026-10-05', overdue: false },
      { label: 'Tarjeta de circulación', date: '2026-09-30', overdue: true },
    ]);
  });

  it('lo lejano y lo sin fecha no avisan', () => {
    expect(
      upcomingExpiries(
        { insuranceExpiresAt: '2027-01-01', registrationExpiresAt: null },
        '2026-10-01',
        7,
      ),
    ).toEqual([]);
  });
});
