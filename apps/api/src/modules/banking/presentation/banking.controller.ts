import {
  API_ERROR_CODES,
  PERMISSIONS,
  bankAccountsQuerySchema,
  createBankAccountSchema,
  updateBankAccountSchema,
} from '@elite/shared';
import type {
  BankAccount,
  BankAccountsQuery,
  CreateBankAccountInput,
  Page,
  UpdateBankAccountInput,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { BankAccountUseCases } from '../application/bank-account.usecases';

const { manage } = PERMISSIONS.banking.actions;

/**
 * `/api/banking/accounts` (069): las cuentas del negocio a las que entra una
 * transferencia. Sin `DELETE`: se desactivan (RN-3).
 *
 * El `GET` no declara permiso en el decorador porque acepta una de dos claves
 * segun el filtro (`carwash.charge` o `banking.manage`); igual exige sesion,
 * y el caso de uso decide con los permisos que resolvio el guard.
 */
@Controller('banking/accounts')
export class BankingController {
  private static readonly accountId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa cuenta no existe.',
      }),
  });

  constructor(private readonly accounts: BankAccountUseCases) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(bankAccountsQuerySchema)) query: BankAccountsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Page<BankAccount>> {
    return this.accounts.list(query, user.permissions);
  }

  @Post()
  @RequirePermissions(manage.key)
  create(
    @Body(new ZodValidationPipe(createBankAccountSchema)) input: CreateBankAccountInput,
  ): Promise<BankAccount> {
    return this.accounts.create(input);
  }

  @Patch(':id')
  @RequirePermissions(manage.key)
  update(
    @Param('id', BankingController.accountId) id: string,
    @Body(new ZodValidationPipe(updateBankAccountSchema)) input: UpdateBankAccountInput,
  ): Promise<BankAccount> {
    return this.accounts.update(id, input);
  }
}
