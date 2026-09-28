import { Prisma } from '@prisma/client';

import { retryOnSequenceClash, SEQUENCE_ATTEMPTS } from './last-sequence';

function clashOn(field: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [field] },
  });
}

describe('retryOnSequenceClash (073)', () => {
  it('reintenta cuando choca el correlativo y devuelve el alta que entra', async () => {
    const run = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(clashOn('number'))
      .mockResolvedValueOnce('CW-10001');

    await expect(retryOnSequenceClash('work_orders', run)).resolves.toBe('CW-10001');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it(`al fallo numero ${SEQUENCE_ATTEMPTS} sale el error tal cual`, async () => {
    const clash = clashOn('number');
    const run = jest.fn<Promise<string>, []>().mockRejectedValue(clash);

    await expect(retryOnSequenceClash('charges', run)).rejects.toBe(clash);
    expect(run).toHaveBeenCalledTimes(SEQUENCE_ATTEMPTS);
  });

  it('un choque en otra columna no se reintenta', async () => {
    const clash = clashOn('email');
    const run = jest.fn<Promise<string>, []>().mockRejectedValue(clash);

    await expect(retryOnSequenceClash('services', run)).rejects.toBe(clash);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
