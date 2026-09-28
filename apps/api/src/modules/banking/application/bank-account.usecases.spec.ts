import { API_ERROR_CODES, PERMISSIONS, createBankAccountSchema } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { bankAccountLabel, maskAccountNumber } from '../domain/bank-account';
import { BankAccountUseCases } from './bank-account.usecases';
import { InMemoryBankAccountRepository } from './testing/in-memory-bank-account.repository';

const MANAGE = PERMISSIONS.banking.actions.manage.key;
const CHARGE = PERMISSIONS.carwash.actions.charge.key;

const AGRICOLA = {
  bank: 'AGRICOLA',
  type: 'CHECKING',
  number: '0012345678',
  holderName: 'Elite Service S.A. de C.V.',
} as const;

describe('BankAccountUseCases (069)', () => {
  let repo: InMemoryBankAccountRepository;
  let accounts: BankAccountUseCases;

  beforeEach(() => {
    repo = new InMemoryBankAccountRepository();
    accounts = new BankAccountUseCases(repo);
  });

  it('crea una cuenta activa con el nombre del banco resuelto', async () => {
    const created = await accounts.create(AGRICOLA);

    expect(created).toMatchObject({
      bank: 'AGRICOLA',
      bankName: 'Banco Agrícola',
      type: 'CHECKING',
      number: '0012345678',
      active: true,
    });
    expect(await accounts.list({ active: true }, [MANAGE])).toHaveLength(1);
  });

  it('409 BANK_ACCOUNT_DUPLICATE con el mismo banco y número (RN-2)', async () => {
    await accounts.create(AGRICOLA);

    const error = await captureApiError(accounts.create({ ...AGRICOLA, holderName: 'Otro' }));

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_DUPLICATE);
  });

  it('el mismo número en otro banco no choca', async () => {
    await accounts.create(AGRICOLA);

    await expect(accounts.create({ ...AGRICOLA, bank: 'BAC' })).resolves.toMatchObject({
      bank: 'BAC',
    });
  });

  it('el número se guarda sin guiones (RN-2)', async () => {
    const input = createBankAccountSchema.parse({ ...AGRICOLA, number: '001-234-5678' });

    expect((await accounts.create(input)).number).toBe('0012345678');
  });

  it('editar hacia el banco y número de otra cuenta responde 409; a los suyos, no', async () => {
    const first = await accounts.create(AGRICOLA);
    const second = await accounts.create({ ...AGRICOLA, number: '9988776655' });

    await expect(accounts.update(first.id, { number: '0012345678' })).resolves.toMatchObject({
      id: first.id,
    });

    const error = await captureApiError(accounts.update(second.id, { number: '0012345678' }));

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_DUPLICATE);
  });

  it('desactivar la saca de la lista del cobro; reactivar la devuelve (RN-3)', async () => {
    const created = await accounts.create(AGRICOLA);

    await accounts.update(created.id, { active: false });

    expect(await accounts.list({ active: true }, [CHARGE])).toEqual([]);
    expect(await accounts.list({}, [MANAGE])).toHaveLength(1);

    await accounts.update(created.id, { active: true });

    expect(await accounts.list({ active: true }, [CHARGE])).toHaveLength(1);
  });

  it('404 al editar una cuenta que no existe', async () => {
    const error = await captureApiError(
      accounts.update('00000000-0000-4000-8000-999999999999', { active: false }),
    );

    expect(error.status).toBe(404);
    expect(error.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  describe('permisos de la lista', () => {
    it('?active=true la lee quien cobra o quien administra', async () => {
      await expect(accounts.list({ active: true }, [CHARGE])).resolves.toEqual([]);
      await expect(accounts.list({ active: true }, [MANAGE])).resolves.toEqual([]);
    });

    it('sin filtro, solo banking.manage', async () => {
      const error = await captureApiError(accounts.list({}, [CHARGE]));

      expect(error.status).toBe(403);
      expect(error.body.code).toBe(API_ERROR_CODES.FORBIDDEN);
    });

    it('sin ninguna de las dos claves, 403 aun con el filtro', async () => {
      const error = await captureApiError(
        accounts.list({ active: true }, [PERMISSIONS.carwash.actions.read.key]),
      );

      expect(error.status).toBe(403);
    });
  });
});

describe('bankAccountLabel (069 RN-7)', () => {
  it('banco, tipo y los últimos cuatro dígitos', () => {
    expect(bankAccountLabel(AGRICOLA)).toBe('Banco Agrícola · Corriente · ···5678');
    expect(bankAccountLabel({ bank: 'BAC', type: 'SAVINGS', number: '112233' })).toBe(
      'BAC Credomatic · Ahorro · ···2233',
    );
  });

  it('un código fuera de la lista sale tal cual', () => {
    expect(bankAccountLabel({ bank: 'VIEJO', type: 'SAVINGS', number: '123456' })).toBe(
      'VIEJO · Ahorro · ···3456',
    );
  });

  it('un número corto no se enmascara', () => {
    expect(maskAccountNumber('1234')).toBe('1234');
  });
});
