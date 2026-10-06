import { Module } from '@nestjs/common';

import { AGREEMENT_READER } from './application/ports/agreement-reader';
import type { AgreementReader } from './application/ports/agreement-reader';
import { RENTAL_CASH_SESSION_REPOSITORY } from './application/ports/rental-cash-session.repository';
import type { RentalCashSessionRepository } from './application/ports/rental-cash-session.repository';
import { RENTAL_FINE_REPOSITORY } from './application/ports/rental-fine.repository';
import type { RentalFineRepository } from './application/ports/rental-fine.repository';
import { RENTAL_PAYMENT_REPOSITORY } from './application/ports/rental-payment.repository';
import type { RentalPaymentRepository } from './application/ports/rental-payment.repository';
import { USER_DIRECTORY } from './application/ports/user-directory';
import type { UserDirectory } from './application/ports/user-directory';
import { RentalCashUseCases } from './application/rental-cash.usecases';
import { RentalFineUseCases } from './application/rental-fine.usecases';
import { RentalPaymentUseCases } from './application/rental-payment.usecases';
import { PrismaAgreementReader } from './infrastructure/prisma-agreement.reader';
import { PrismaRentalCashSessionRepository } from './infrastructure/prisma-rental-cash-session.repository';
import { PrismaRentalFineRepository } from './infrastructure/prisma-rental-fine.repository';
import { PrismaRentalPaymentRepository } from './infrastructure/prisma-rental-payment.repository';
import { PrismaUserDirectory } from './infrastructure/prisma-user.directory';
import { RentalBillingController } from './presentation/rental-billing.controller';
import { RentalCashController } from './presentation/rental-cash.controller';

/**
 * El dinero de la rentadora (098, 109): pagos, depósitos, multas, cuentas por
 * cobrar y el turno de caja. Lee `rental_agreements` directo, sin importar el
 * módulo de rentas (096). Nada compartido con la caja del lavado.
 */
@Module({
  controllers: [RentalBillingController, RentalCashController],
  providers: [
    { provide: AGREEMENT_READER, useClass: PrismaAgreementReader },
    { provide: RENTAL_PAYMENT_REPOSITORY, useClass: PrismaRentalPaymentRepository },
    { provide: RENTAL_CASH_SESSION_REPOSITORY, useClass: PrismaRentalCashSessionRepository },
    { provide: RENTAL_FINE_REPOSITORY, useClass: PrismaRentalFineRepository },
    { provide: USER_DIRECTORY, useClass: PrismaUserDirectory },
    {
      provide: RentalPaymentUseCases,
      useFactory: (
        agreements: AgreementReader,
        payments: RentalPaymentRepository,
        users: UserDirectory,
      ): RentalPaymentUseCases => new RentalPaymentUseCases(agreements, payments, users),
      inject: [AGREEMENT_READER, RENTAL_PAYMENT_REPOSITORY, USER_DIRECTORY],
    },
    {
      provide: RentalFineUseCases,
      useFactory: (agreements: AgreementReader, fines: RentalFineRepository): RentalFineUseCases =>
        new RentalFineUseCases(agreements, fines),
      inject: [AGREEMENT_READER, RENTAL_FINE_REPOSITORY],
    },
    {
      provide: RentalCashUseCases,
      useFactory: (
        agreements: AgreementReader,
        sessions: RentalCashSessionRepository,
      ): RentalCashUseCases => new RentalCashUseCases(agreements, sessions),
      inject: [AGREEMENT_READER, RENTAL_CASH_SESSION_REPOSITORY],
    },
  ],
  exports: [RentalPaymentUseCases],
})
export class RentalBillingModule {}
