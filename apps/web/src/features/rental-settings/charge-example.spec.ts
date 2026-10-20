import { chargeExample } from './charge-example';

const BASE = {
  defaultCdwPerDay: '',
  vatRate: '0.00',
  graceHours: '1',
  bufferHours: '2',
  contractStartNumber: '733',
};

describe('ejemplo de cobro (120)', () => {
  it('sin CDW ni IVA: 3 días a $35', () => {
    expect(chargeExample(BASE)).toMatchObject({
      rentalCents: 10500,
      cdwCents: 0,
      vatCents: 0,
      totalCents: 10500,
      graceHours: 1,
      bufferHours: 2,
      nextContract: '0733',
    });
  });

  it('el CDW se suma por día', () => {
    const example = chargeExample({ ...BASE, defaultCdwPerDay: '8,50' });

    expect(example.cdwPerDayCents).toBe(850);
    expect(example.cdwCents).toBe(2550);
    expect(example.totalCents).toBe(13050);
  });

  it('el IVA va incluido: no sube el total, se separa', () => {
    const example = chargeExample({ ...BASE, defaultCdwPerDay: '5', vatRate: '13' });

    expect(example.totalCents).toBe(12000);
    expect(example.vatRate).toBe(13);
    expect(example.vatCents).toBe(12000 - Math.round(12000 / 1.13));
  });

  it('lo que no se lee cae a cero', () => {
    expect(
      chargeExample({
        ...BASE,
        vatRate: 'abc',
        graceHours: '',
        contractStartNumber: '',
      }),
    ).toMatchObject({ vatRate: 0, vatCents: 0, graceHours: 0, nextContract: '' });
  });
});
