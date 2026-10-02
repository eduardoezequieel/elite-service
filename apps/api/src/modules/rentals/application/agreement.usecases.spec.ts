import {
  API_ERROR_CODES,
  agreementsQuerySchema,
  checkinSchema,
  checkoutSchema,
  createAgreementSchema,
} from '@elite/shared';
import type { RentalAgreementVehicle } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { AgreementUseCases } from './agreement.usecases';
import { AvailabilityUseCases } from './availability.usecases';
import {
  FixedClock,
  InMemoryAgreementRepository,
  InMemoryContractNumbers,
  InMemoryFleet,
  InMemoryRenters,
  InMemorySettings,
} from './testing/in-memory-rentals';

const USER = '90000000-0000-4000-8000-000000000001';
const inspection = (odometerKm: number, fuelEighths = 8) => ({ odometerKm, fuelEighths });

describe('AgreementUseCases (096)', () => {
  let clock: FixedClock;
  let fleet: InMemoryFleet;
  let renters: InMemoryRenters;
  let settings: InMemorySettings;
  let repo: InMemoryAgreementRepository;
  let agreements: AgreementUseCases;
  let availability: AvailabilityUseCases;
  let car: RentalAgreementVehicle;
  let customerId: string;

  const reserve = (overrides: Record<string, unknown> = {}) =>
    agreements.create(
      createAgreementSchema.parse({
        customerId,
        vehicleId: car.id,
        plannedPickupAt: '2026-10-10T10:00:00Z',
        plannedReturnAt: '2026-10-12T10:00:00Z',
        ...overrides,
      }),
      USER,
    );

  const checkout = (id: string, overrides: Record<string, unknown> = {}) =>
    agreements.checkout(
      id,
      checkoutSchema.parse({
        actualPickupAt: '2026-10-10T10:00:00Z',
        inspection: inspection(10_000),
        ...overrides,
      }),
      USER,
    );

  beforeEach(() => {
    clock = new FixedClock(new Date('2026-10-01T12:00:00Z'));
    fleet = new InMemoryFleet();
    renters = new InMemoryRenters();
    settings = new InMemorySettings();
    repo = new InMemoryAgreementRepository(fleet, renters, clock);
    agreements = new AgreementUseCases(
      repo,
      fleet,
      renters,
      settings,
      new InMemoryContractNumbers(repo),
      clock,
    );
    availability = new AvailabilityUseCases(repo, fleet, settings, clock);
    car = fleet.add({
      dailyRate: '35.00',
      weeklyRate: '30.00',
      freeKmPerDay: 200,
      extraKmPrice: '0.25',
    });
    customerId = renters.add({ fullName: 'Ana López' }).id;
  });

  describe('create', () => {
    it('nace RESERVED con los días de billableDays() y la tarifa por tramo', async () => {
      const created = await reserve({ plannedReturnAt: '2026-10-17T10:30:00Z' });

      expect(created).toMatchObject({
        status: 'RESERVED',
        derivedStatus: 'RESERVED',
        billableDays: 7,
        dailyRate: '30.00',
        contractNumber: null,
        pickupLocation: 'Oficina',
      });
      expect(created.totals.total).toBe('210.00');
    });

    it('usa CDW y deducible de ajustes si no vienen', async () => {
      settings.terms.defaultCdwPerDay = '5.00';
      settings.terms.defaultDeductible = '500.00';

      const created = await reserve();

      expect(created).toMatchObject({ cdwPerDay: '5.00', deductible: '500.00' });
      expect(created.totals.total).toBe('80.00');
    });

    it('choca dentro del margen y pasa justo al terminarlo (RN-2)', async () => {
      await reserve();
      const other = renters.add().id;

      const clash = await captureApiError(
        agreements.create(
          createAgreementSchema.parse({
            customerId: other,
            vehicleId: car.id,
            plannedPickupAt: '2026-10-12T10:30:00Z',
            plannedReturnAt: '2026-10-14T10:00:00Z',
          }),
          USER,
        ),
      );
      expect(clash).toMatchObject({
        status: 409,
        body: { code: API_ERROR_CODES.VEHICLE_UNAVAILABLE },
      });

      const ok = await agreements.create(
        createAgreementSchema.parse({
          customerId: other,
          vehicleId: car.id,
          plannedPickupAt: '2026-10-12T11:00:00Z',
          plannedReturnAt: '2026-10-14T10:00:00Z',
        }),
        USER,
      );
      expect(ok.status).toBe('RESERVED');
    });

    it('rechaza un cliente bloqueado y un carro en taller o retirado', async () => {
      const blocked = renters.add({ isBlocked: true, blockReason: 'Chocó' }).id;

      expect(await captureApiError(reserve({ customerId: blocked }))).toMatchObject({
        status: 409,
        body: { code: API_ERROR_CODES.RENTER_BLOCKED },
      });

      const inShop = fleet.add({ status: 'IN_SHOP' });
      const retired = fleet.add({ status: 'RETIRED' });
      for (const vehicle of [inShop, retired]) {
        expect(await captureApiError(reserve({ vehicleId: vehicle.id }))).toMatchObject({
          status: 409,
          body: { code: API_ERROR_CODES.VEHICLE_NOT_RENTABLE },
        });
      }
    });

    it('con checkoutNow entrega en el mismo paso y le da número', async () => {
      const created = await reserve({
        checkoutNow: true,
        checkout: { actualPickupAt: '2026-10-10T10:00:00Z', inspection: inspection(10_050) },
      });

      expect(created).toMatchObject({
        status: 'IN_PROGRESS',
        contractNumber: 733,
        pickupOdometerKm: 10_050,
      });
    });
  });

  describe('checkout', () => {
    it('pasa a IN_PROGRESS, guarda la inspección, numera, sube el odómetro y cobra', async () => {
      const reserved = await reserve();

      const started = await checkout(reserved.id, {
        inspection: { ...inspection(10_120, 6), damages: [{ zone: 'hood', description: 'Rayón' }] },
        deposit: '200.00',
        depositMethod: 'CASH',
        payment: { amount: '70.00', method: 'CASH' },
      });

      expect(started).toMatchObject({
        status: 'IN_PROGRESS',
        actualPickupAt: '2026-10-10T10:00:00.000Z',
        pickupOdometerKm: 10_120,
        contractNumber: 733,
        deposit: '200.00',
        depositHeld: '200.00',
      });
      expect(started.pickupInspection?.damages).toHaveLength(1);
      expect(started.totals).toMatchObject({ total: '70.00', paid: '70.00', balance: '0.00' });
      expect(fleet.rows[0]?.odometerKm).toBe(10_120);
    });

    it('el número sigue al mayor y nunca baja del inicial (RN-3)', async () => {
      settings.terms.contractStartNumber = 900;
      const first = await reserve();
      await checkout(first.id);
      const second = await reserve({
        plannedPickupAt: '2026-10-20T10:00:00Z',
        plannedReturnAt: '2026-10-21T10:00:00Z',
      });

      const numbered = await agreements.assignContractNumber(second.id);
      const again = await agreements.assignContractNumber(second.id);

      expect(numbered.contractNumber).toBe(901);
      expect(again.contractNumber).toBe(901);
    });

    it('una renta en curso no se vuelve a entregar', async () => {
      const reserved = await reserve();
      await checkout(reserved.id);

      expect(await captureApiError(checkout(reserved.id))).toMatchObject({
        status: 409,
        body: { code: API_ERROR_CODES.AGREEMENT_NOT_RESERVED },
      });
    });
  });

  it('una renta en curso con el regreso vencido sale LATE', async () => {
    const reserved = await reserve();
    await checkout(reserved.id);
    clock.current = new Date('2026-10-12T12:00:00Z');

    expect((await agreements.get(reserved.id)).derivedStatus).toBe('LATE');
    expect(
      (await agreements.list(agreementsQuerySchema.parse({ late: 'true' }))).items.map(
        (row) => row.id,
      ),
    ).toEqual([reserved.id]);
  });

  it('la lista pagina: lo más próximo a salir arriba y el total del filtro (101)', async () => {
    const early = await reserve();
    const late = await reserve({
      plannedPickupAt: '2026-10-20T10:00:00Z',
      plannedReturnAt: '2026-10-22T10:00:00Z',
    });

    const first = await agreements.list(agreementsQuerySchema.parse({ pageSize: 1 }));
    const second = await agreements.list(agreementsQuerySchema.parse({ page: 2, pageSize: 1 }));

    expect(first).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(first.items.map((row) => row.id)).toEqual([late.id]);
    expect(second.items.map((row) => row.id)).toEqual([early.id]);
  });

  describe('checkin', () => {
    it('cobra los km extra, cierra, sube el odómetro y devuelve el depósito', async () => {
      const reserved = await reserve();
      await checkout(reserved.id, { deposit: '200.00', depositMethod: 'CASH' });

      const finished = await agreements.checkin(
        reserved.id,
        checkinSchema.parse({
          actualReturnAt: '2026-10-12T10:30:00Z',
          inspection: inspection(10_550),
          payment: { amount: '50.00', method: 'CARD' },
          depositReturn: { amount: '150.00', method: 'CASH', note: 'Faltó gasolina' },
        }),
        USER,
      );

      // 2 días × 200 km = 400 libres; 550 recorridos → 150 × $0.25.
      expect(finished).toMatchObject({
        status: 'FINISHED',
        billableDays: 2,
        extraKmCharge: '37.50',
        returnOdometerKm: 10_550,
        actualReturnAt: '2026-10-12T10:30:00.000Z',
        depositReturnedAmount: '150.00',
        depositHeld: '50.00',
      });
      expect(finished.depositReturnNote).toBe('Devuelto en efectivo · Faltó gasolina');
      expect(finished.totals.total).toBe('107.50');
      expect(fleet.rows[0]?.odometerKm).toBe(10_550);
    });

    it('sin chargeExtraKm no cobra km y los días se pueden sobreescribir con nota', async () => {
      const reserved = await reserve();
      await checkout(reserved.id);

      const finished = await agreements.checkin(
        reserved.id,
        checkinSchema.parse({
          actualReturnAt: '2026-10-13T10:00:00Z',
          inspection: inspection(11_000),
          chargeExtraKm: false,
          billableDays: 2,
          billableDaysNote: 'Cortesía',
        }),
        USER,
      );

      expect(finished).toMatchObject({ billableDays: 2, extraKmCharge: '0.00' });
      expect(finished.notes).toContain('Cortesía');
    });

    it('no devuelve más depósito del que hay', async () => {
      const reserved = await reserve();
      await checkout(reserved.id, { deposit: '100.00' });

      expect(
        await captureApiError(
          agreements.checkin(
            reserved.id,
            checkinSchema.parse({
              actualReturnAt: '2026-10-12T10:00:00Z',
              inspection: inspection(10_100),
              depositReturn: { amount: '150.00' },
            }),
            USER,
          ),
        ),
      ).toMatchObject({ status: 409, body: { code: API_ERROR_CODES.DEPOSIT_EXCEEDS_HELD } });
    });

    it('una reserva no se recibe', async () => {
      const reserved = await reserve();

      expect(
        await captureApiError(
          agreements.checkin(
            reserved.id,
            checkinSchema.parse({
              actualReturnAt: '2026-10-12T10:00:00Z',
              inspection: inspection(10_100),
            }),
            USER,
          ),
        ),
      ).toMatchObject({ status: 409, body: { code: API_ERROR_CODES.AGREEMENT_NOT_IN_PROGRESS } });
    });
  });

  describe('extend', () => {
    it('crea la extensión y recalcula los días', async () => {
      const reserved = await reserve();
      await checkout(reserved.id);

      const extended = await agreements.extend(
        reserved.id,
        { newReturnAt: '2026-10-14T10:00:00Z', note: null },
        USER,
      );

      expect(extended).toMatchObject({
        billableDays: 4,
        plannedReturnAt: '2026-10-14T10:00:00.000Z',
      });
      expect(extended.extensions).toEqual([
        expect.objectContaining({
          previousReturnAt: '2026-10-12T10:00:00.000Z',
          newReturnAt: '2026-10-14T10:00:00.000Z',
          addedDays: 2,
        }),
      ]);
    });

    it('rechaza la extensión que choca con la reserva siguiente', async () => {
      const reserved = await reserve();
      await checkout(reserved.id);
      await agreements.create(
        createAgreementSchema.parse({
          customerId: renters.add().id,
          vehicleId: car.id,
          plannedPickupAt: '2026-10-13T12:00:00Z',
          plannedReturnAt: '2026-10-15T12:00:00Z',
        }),
        USER,
      );

      expect(
        await captureApiError(
          agreements.extend(reserved.id, { newReturnAt: '2026-10-13T11:30:00Z', note: null }, USER),
        ),
      ).toMatchObject({ status: 409, body: { code: API_ERROR_CODES.VEHICLE_UNAVAILABLE } });
    });
  });

  describe('swap', () => {
    it('cierra la actual, abre otra con el carro nuevo, pasa el depósito y la numera', async () => {
      const other = fleet.add({ dailyRate: '45.00', odometerKm: 5000 });
      const reserved = await reserve({ plannedReturnAt: '2026-10-14T10:00:00Z' });
      await checkout(reserved.id, { deposit: '200.00' });

      const { closed, opened } = await agreements.swap(
        reserved.id,
        { at: '2026-10-11T10:00:00Z', newVehicleId: other.id, reason: 'Falla de frenos' },
        USER,
      );

      expect(closed).toMatchObject({
        status: 'FINISHED',
        billableDays: 1,
        actualReturnAt: '2026-10-11T10:00:00.000Z',
        depositTransferredToId: opened.id,
        nextAgreementId: opened.id,
        depositHeld: '0.00',
      });
      expect(opened).toMatchObject({
        status: 'IN_PROGRESS',
        vehicleId: other.id,
        previousAgreementId: closed.id,
        deposit: '200.00',
        dailyRate: '45.00',
        billableDays: 3,
        contractNumber: 734,
        pickupOdometerKm: 5000,
      });
    });
  });

  describe('reassign', () => {
    it('cambia el carro de una reserva y no deja reasignar una en curso', async () => {
      const other = fleet.add();
      const reserved = await reserve();

      expect((await agreements.reassign(reserved.id, { vehicleId: other.id })).vehicleId).toBe(
        other.id,
      );

      await checkout(reserved.id);
      expect(
        await captureApiError(agreements.reassign(reserved.id, { vehicleId: car.id })),
      ).toMatchObject({ status: 409, body: { code: API_ERROR_CODES.AGREEMENT_NOT_RESERVED } });
    });
  });

  describe('cancel y cerradas', () => {
    it('una cerrada no acepta ninguna mutación', async () => {
      const reserved = await reserve();
      await agreements.cancel(reserved.id, { reason: 'No vino' });

      const attempts = [
        agreements.update(reserved.id, { notes: 'x' }),
        checkout(reserved.id),
        agreements.extend(reserved.id, { newReturnAt: '2026-10-20T10:00:00Z', note: null }, USER),
        agreements.reassign(reserved.id, { vehicleId: car.id }),
        agreements.cancel(reserved.id, { reason: 'otra vez' }),
        agreements.swap(
          reserved.id,
          { at: '2026-10-11T10:00:00Z', newVehicleId: fleet.add().id, reason: 'x' },
          USER,
        ),
      ];

      for (const attempt of attempts) {
        expect(await captureApiError(attempt)).toMatchObject({
          status: 409,
          body: { code: API_ERROR_CODES.AGREEMENT_CLOSED },
        });
      }
    });

    it('una en curso con pagos no se cancela; sin pagos sí', async () => {
      const paid = await reserve();
      await checkout(paid.id, { payment: { amount: '10.00', method: 'CASH' } });

      expect(await captureApiError(agreements.cancel(paid.id, { reason: 'x' }))).toMatchObject({
        status: 409,
      });

      const unpaid = await reserve({
        plannedPickupAt: '2026-10-20T10:00:00Z',
        plannedReturnAt: '2026-10-21T10:00:00Z',
      });
      await checkout(unpaid.id, { actualPickupAt: '2026-10-20T10:00:00Z' });

      expect((await agreements.cancel(unpaid.id, { reason: 'Se arrepintió' })).status).toBe(
        'CANCELLED',
      );
    });

    it('si otra persona la cerró en el medio, responde AGREEMENT_CLOSED', async () => {
      const reserved = await reserve();
      const original = repo.findById.bind(repo);
      let calls = 0;
      jest.spyOn(repo, 'findById').mockImplementation(async (id) => {
        calls += 1;
        const row = await original(id);
        if (calls === 1) repo.forceStatus(id, 'CANCELLED');
        return row;
      });

      expect(await captureApiError(agreements.update(reserved.id, { notes: 'x' }))).toMatchObject({
        status: 409,
        body: { code: API_ERROR_CODES.AGREEMENT_CLOSED },
      });
    });
  });

  describe('update', () => {
    it('mover las fechas revalida el choque y recalcula los días', async () => {
      const first = await reserve();
      const second = await reserve({
        customerId: renters.add().id,
        plannedPickupAt: '2026-10-15T10:00:00Z',
        plannedReturnAt: '2026-10-16T10:00:00Z',
      });

      expect(
        await captureApiError(
          agreements.update(second.id, { plannedPickupAt: '2026-10-12T10:30:00Z' }),
        ),
      ).toMatchObject({ status: 409, body: { code: API_ERROR_CODES.VEHICLE_UNAVAILABLE } });

      const moved = await agreements.update(first.id, { plannedReturnAt: '2026-10-13T10:00:00Z' });
      expect(moved.billableDays).toBe(3);
    });
  });

  describe('availability y calendar', () => {
    it('FREE, FREE_IF_RETURNED y BUSY', async () => {
      const free = fleet.add({ plate: 'LIBRE1' });
      const reserved = await reserve();
      await checkout(reserved.id);
      clock.current = new Date('2026-10-11T00:00:00Z');

      const rows = await availability.availability({
        from: '2026-10-13T10:00:00Z',
        to: '2026-10-14T10:00:00Z',
      });
      const of = (id: string) => rows.find((row) => row.vehicle.id === id);

      expect(of(free.id)).toMatchObject({ availability: 'FREE', blocking: null });
      expect(of(car.id)).toMatchObject({
        availability: 'FREE_IF_RETURNED',
        blocking: { id: reserved.id, customerName: 'Ana López' },
        billableDays: 1,
        dailyRate: '35.00',
        estimatedTotal: '35.00',
      });

      const busy = await availability.availability({
        from: '2026-10-11T10:00:00Z',
        to: '2026-10-12T10:00:00Z',
      });
      expect(busy.find((row) => row.vehicle.id === car.id)?.availability).toBe('BUSY');
    });

    it('el calendario trae una fila por carro con las rentas que tocan el rango', async () => {
      const reserved = await reserve();
      const cancelled = await reserve({
        customerId: renters.add().id,
        plannedPickupAt: '2026-10-13T10:00:00Z',
        plannedReturnAt: '2026-10-14T10:00:00Z',
      });
      await agreements.cancel(cancelled.id, { reason: 'x' });
      fleet.add({ status: 'RETIRED' });

      const rows = await availability.calendar({ from: '2026-10-09', to: '2026-10-15' });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.agreements.map((slot) => slot.id)).toEqual([reserved.id]);
    });
  });
});
