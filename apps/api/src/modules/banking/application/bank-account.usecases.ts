import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import type {
  BankAccount,
  BankAccountsQuery,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from '@elite/shared';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { BankAccountDuplicateError } from '../domain/bank-account';
import type { BankAccountChanges, BankAccountRepository } from './ports/bank-account.repository';

const MANAGE = PERMISSIONS.banking.actions.manage.key;
const CHARGE = PERMISSIONS.carwash.actions.charge.key;

/**
 * Las cuentas del negocio a las que entra una transferencia (069).
 *
 * Se registran, editan, desactivan y reactivan con `banking.manage`. No existe
 * borrar (RN-3): una cuenta con pagos los conserva aunque ya no se elija.
 */
export class BankAccountUseCases {
  constructor(private readonly accounts: BankAccountRepository) {}

  /**
   * `?active=true` es la lista del cobro: la lee quien cobra (`carwash.charge`)
   * o quien administra. Sin filtro salen tambien las inactivas, y eso es solo
   * de quien administra. Es un «o» entre dos claves, que el guard global no
   * expresa: por eso se decide aca, siempre por clave y nunca por rol.
   */
  async list(query: BankAccountsQuery, permissions: readonly string[]): Promise<BankAccount[]> {
    const activeOnly = query.active === true;
    const accepted = activeOnly ? [CHARGE, MANAGE] : [MANAGE];

    if (!accepted.some((key) => permissions.includes(key))) {
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'No tenés permiso para hacer esto.',
      });
    }

    return this.accounts.list(activeOnly);
  }

  async create(input: CreateBankAccountInput): Promise<BankAccount> {
    await this.assertFree(input.bank, input.number);

    return this.withDuplicate(() => this.accounts.create(input));
  }

  async update(id: string, input: UpdateBankAccountInput): Promise<BankAccount> {
    const current = await this.accounts.findById(id);

    if (current === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa cuenta no existe.',
      });
    }

    const changes: BankAccountChanges = {};

    if (input.bank !== undefined) changes.bank = input.bank;
    if (input.type !== undefined) changes.type = input.type;
    if (input.number !== undefined) changes.number = input.number;
    if (input.holderName !== undefined) changes.holderName = input.holderName;
    if (input.active !== undefined) changes.active = input.active;

    if (changes.bank !== undefined || changes.number !== undefined) {
      await this.assertFree(changes.bank ?? current.bank, changes.number ?? current.number, id);
    }

    return this.withDuplicate(() => this.accounts.update(id, changes));
  }

  /** RN-2: `(bank, number)` es unico, activa o no. */
  private async assertFree(bank: string, number: string, exceptId?: string): Promise<void> {
    if (await this.accounts.existsByBankAndNumber(bank, number, exceptId)) throw duplicate();
  }

  /** Lo que se perdio en la carrera contra otro alta: el indice unico choco. */
  private async withDuplicate(write: () => Promise<BankAccount>): Promise<BankAccount> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof BankAccountDuplicateError) throw duplicate();

      throw error;
    }
  }
}

function duplicate(): ConflictException {
  return new ConflictException({
    code: API_ERROR_CODES.BANK_ACCOUNT_DUPLICATE,
    message: 'Ya hay una cuenta registrada con ese banco y ese número.',
  });
}
