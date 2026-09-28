import {
  allocateLines,
  cashPortionOf,
  hasTransferWithoutAccount,
  rejectChargeAccount,
  settleCash,
  splitByLargestRemainder,
  sumCents,
  transferAccountIdsOf,
} from './charge';
import type { ChargeLine } from './charge';

const cash = (amount: number): ChargeLine => ({ method: 'CASH', amount });
const card = (amount: number): ChargeLine => ({ method: 'CARD', amount });

describe('splitByLargestRemainder (059 RN-5)', () => {
  it('reparte exacto cuando la proporción divide', () => {
    expect(splitByLargestRemainder(1000, [200, 300, 500])).toEqual([200, 300, 500]);
  });

  it('los centavos que sobran van a los de mayor resto y la suma es el renglón', () => {
    const shares = splitByLargestRemainder(1000, [100, 100, 100]);

    expect(shares).toEqual([334, 333, 333]);
    expect(sumCents(shares)).toBe(1000);
  });

  it('un centavo suelto entre dos pesos distintos cae en el de mayor resto', () => {
    // 1 centavo entre $0.01 y $0.02: los restos son 1/3 y 2/3.
    expect(splitByLargestRemainder(1, [1, 2])).toEqual([0, 1]);
  });

  it('nunca pierde ni inventa centavos, reparta como reparta', () => {
    const weights = [733, 1267, 499, 1];

    for (let amount = 0; amount <= 2500; amount += 7) {
      const shares = splitByLargestRemainder(amount, weights);

      expect(sumCents(shares)).toBe(amount);
      expect(shares.every((share) => share >= 0)).toBe(true);
    }
  });

  it('sin peso total el monto no se pierde: va entero al primero', () => {
    expect(splitByLargestRemainder(500, [0, 0])).toEqual([500, 0]);
  });

  it('sin lavados no reparte nada', () => {
    expect(splitByLargestRemainder(500, [])).toEqual([]);
  });
});

describe('allocateLines (059 RN-5)', () => {
  it('$10.00 en un solo método entre tres lavados de $2 / $3 / $5', () => {
    const allocation = allocateLines([cash(1000)], [200, 300, 500]);

    expect(allocation).toEqual([[cash(200)], [cash(300)], [cash(500)]]);
  });

  it('parte cada renglón por separado y cada uno cuadra con su monto', () => {
    const lines = [card(600), cash(400)];
    const allocation = allocateLines(lines, [200, 300, 500]);

    expect(allocation).toEqual([
      [card(120), cash(80)],
      [card(180), cash(120)],
      [card(300), cash(200)],
    ]);

    lines.forEach((line, index) => {
      expect(sumCents(allocation.map((ticket) => ticket[index].amount))).toBe(line.amount);
    });
  });

  it('la venta suelta es una parte más: 2 lavados + productos con pago partido (066)', () => {
    // Lavados $14.00 y $10.00, venta $3.00: cuenta de $27.00, $20 tarjeta + $7 efectivo.
    const lines = [card(2000), cash(700)];
    const allocation = allocateLines(lines, [1400, 1000, 300]);

    expect(allocation).toEqual([
      [card(1037), cash(363)],
      [card(741), cash(259)],
      [card(222), cash(78)],
    ]);
    allocation.forEach((bucket, index) => {
      expect(sumCents(bucket.map((line) => line.amount))).toBe([1400, 1000, 300][index]);
    });
  });

  it('con resto, la suma de las partes sigue siendo exactamente el renglón', () => {
    const lines = [cash(1000)];
    const allocation = allocateLines(lines, [333, 333, 334]);

    expect(sumCents(allocation.map((ticket) => ticket[0].amount))).toBe(1000);
  });

  it('un lavado en cero conserva su renglón, aunque le toque cero', () => {
    const allocation = allocateLines([cash(500)], [500, 0]);

    expect(allocation).toEqual([[cash(500)], [cash(0)]]);
  });

  it('el caso normal —un lavado, un pago— pasa por el mismo camino', () => {
    expect(allocateLines([cash(1400)], [1400])).toEqual([[cash(1400)]]);
  });

  it('cada parte de un renglón lleva la misma cuenta y referencia (069)', () => {
    const details = { bankAccountId: 'acc-1', reference: '998877', description: null };
    const allocation = allocateLines([{ method: 'TRANSFER', amount: 1000, details }], [400, 600]);

    expect(allocation).toEqual([
      [{ method: 'TRANSFER', amount: 400, details }],
      [{ method: 'TRANSFER', amount: 600, details }],
    ]);
  });
});

describe('cuentas de las transferencias (069 RN-8)', () => {
  const transfer = (bankAccountId: string | null): ChargeLine => ({
    method: 'TRANSFER',
    amount: 100,
    details: { bankAccountId, reference: 'R1', description: null },
  });

  it('junta las cuentas sin repetir y solo de transferencias', () => {
    expect(transferAccountIdsOf([transfer('a'), cash(100), transfer('a'), transfer('b')])).toEqual([
      'a',
      'b',
    ]);
  });

  it('detecta una transferencia sin cuenta, con o sin detalles', () => {
    expect(hasTransferWithoutAccount([transfer('a'), cash(100)])).toBe(false);
    expect(hasTransferWithoutAccount([transfer(null)])).toBe(true);
    expect(hasTransferWithoutAccount([{ method: 'TRANSFER', amount: 100 }])).toBe(true);
  });
});

describe('rejectChargeAccount (059 RN-3, RN-10)', () => {
  it('acepta la cuenta cuando los renglones suman el total', () => {
    expect(rejectChargeAccount([4000, 2050], [card(4000), cash(2050)], null)).toBeNull();
  });

  it('rechaza si los renglones suman de menos', () => {
    expect(rejectChargeAccount([6050], [cash(5900)], null)).toBe('AMOUNT_MISMATCH');
  });

  it('rechaza si los renglones suman de más', () => {
    expect(rejectChargeAccount([6050], [cash(6100)], null)).toBe('AMOUNT_MISMATCH');
  });

  it('una cuenta en cero no se cobra: se anula como cortesía', () => {
    expect(rejectChargeAccount([0, 0], [cash(0)], null)).toBe('EMPTY_TOTAL');
  });

  it('lo entregado no puede ser menor que el efectivo a cobrar', () => {
    expect(rejectChargeAccount([4350], [cash(4350)], 4000)).toBe('CASH_TENDERED_SHORT');
  });

  it('lo entregado se mide contra el efectivo, no contra el total', () => {
    // $43.50: $40 con tarjeta y $3.50 en efectivo. Con $5 alcanza de sobra.
    expect(rejectChargeAccount([4350], [card(4000), cash(350)], 500)).toBeNull();
  });

  it('sin nada en efectivo, lo entregado no estorba', () => {
    expect(rejectChargeAccount([4350], [card(4350)], 100)).toBeNull();
  });
});

describe('settleCash (059 RN-10)', () => {
  it('$50.00 sobre $43.50 en efectivo deja $6.50 de vuelto', () => {
    expect(settleCash([cash(4350)], 5000)).toEqual({ cashTendered: 5000, changeGiven: 650 });
  });

  it('sin monto entregado se asume pago justo y no hay vuelto', () => {
    expect(settleCash([cash(4350)], null)).toEqual({ cashTendered: null, changeGiven: null });
  });

  it('pagó justo: entregado igual al efectivo, vuelto cero', () => {
    expect(settleCash([cash(4350)], 4350)).toEqual({ cashTendered: 4350, changeGiven: 0 });
  });

  it('sin efectivo en el cobro no se guarda lo entregado', () => {
    expect(settleCash([card(4350)], 5000)).toEqual({ cashTendered: null, changeGiven: null });
  });

  it('el vuelto se calcula sobre la parte en efectivo, no sobre el total', () => {
    expect(settleCash([card(4000), cash(350)], 500)).toEqual({
      cashTendered: 500,
      changeGiven: 150,
    });
  });
});

describe('cashPortionOf', () => {
  it('suma solo los renglones en efectivo', () => {
    expect(cashPortionOf([card(4000), cash(350), cash(150)])).toBe(500);
  });
});
