import { fineFormSchema } from './fine-form';

const VEHICLE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const valid = {
  vehicleId: VEHICLE,
  occurredLocal: '2026-10-01T14:30',
  amount: '57.14',
  description: 'Exceso de velocidad',
  chargeToCustomer: true,
};

describe('fineFormSchema (098)', () => {
  it('pasa la hora local a un instante y normaliza el monto', () => {
    expect(fineFormSchema.parse({ ...valid, amount: '57.1' })).toEqual({
      vehicleId: VEHICLE,
      occurredAt: '2026-10-01T20:30:00.000Z',
      amount: '57.10',
      description: 'Exceso de velocidad',
      chargeToCustomer: true,
    });
  });

  it('baja cada error a su campo', () => {
    const result = fineFormSchema.safeParse({
      ...valid,
      vehicleId: '',
      occurredLocal: '',
      amount: '0',
    });

    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['vehicleId', 'occurredLocal', 'amount']));
  });
});
