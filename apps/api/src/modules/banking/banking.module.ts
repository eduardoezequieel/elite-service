import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BankAccountUseCases } from './application/bank-account.usecases';
import { BANK_ACCOUNT_REPOSITORY } from './application/ports/bank-account.repository';
import type { BankAccountRepository } from './application/ports/bank-account.repository';
import { PrismaBankAccountRepository } from './infrastructure/prisma-bank-account.repository';
import { BankingController } from './presentation/banking.controller';

/**
 * Cuentas bancarias del negocio (069).
 *
 * El cobro no importa este modulo: valida la cuenta de una transferencia con su
 * propio puerto (`carwash/application/ports/bank-account-directory.ts`), y los
 * pagos se leen con `infrastructure/bank-account-row.ts` como archivo suelto.
 */
@Module({
  imports: [PrismaModule],
  controllers: [BankingController],
  providers: [
    { provide: BANK_ACCOUNT_REPOSITORY, useClass: PrismaBankAccountRepository },
    {
      provide: BankAccountUseCases,
      useFactory: (accounts: BankAccountRepository): BankAccountUseCases =>
        new BankAccountUseCases(accounts),
      inject: [BANK_ACCOUNT_REPOSITORY],
    },
  ],
})
export class BankingModule {}
