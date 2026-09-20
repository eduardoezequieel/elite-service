import { MAX_MONEY, chargeTicketSchema, createServiceSchema } from '@elite/shared';

/**
 * El tope de los montos del contrato, probado desde donde se aplica: el
 * `ZodValidationPipe` de esta carpeta corre estos mismos schemas en cada
 * request. Sin tope, un campo de veinte digitos llegaba hasta Postgres y
 * reventaba contra la columna `Decimal(12,2)`.
 */
describe('tope de los montos del contrato', () => {
  const service = (defaultPrice: string) => ({
    name: 'Pulido',
    categoryId: '7f1d2f4e-2b3a-4c5d-8e9f-0a1b2c3d4e5f',
    defaultPrice,
  });

  it.each(['0', '8', '8.5', '8.50', '99999.99', '099999.99'])('acepta %s', (value) => {
    expect(createServiceSchema.safeParse(service(value)).success).toBe(true);
  });

  it.each(['100000.00', '2392313213123123123213', '9999999999.99'])('rechaza %s', (value) => {
    const result = createServiceSchema.safeParse(service(value));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(`El monto no puede pasar de $${MAX_MONEY}.`);
  });

  it('el mismo tope vale para el cobro, no solo para el catálogo', () => {
    expect(chargeTicketSchema.safeParse({ method: 'CASH', amount: '100000.00' }).success).toBe(
      false,
    );
    expect(chargeTicketSchema.safeParse({ method: 'CASH', amount: '14.00' }).success).toBe(true);
  });
});
