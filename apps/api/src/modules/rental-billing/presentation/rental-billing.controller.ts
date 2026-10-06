import {
  API_ERROR_CODES,
  PERMISSIONS,
  createFineSchema,
  createPaymentSchema,
  depositReturnSchema,
  fineResolveQuerySchema,
  finesQuerySchema,
  pageQuerySchema,
  voidPaymentSchema,
} from '@elite/shared';
import type {
  BillingAgreementView,
  CreateFineInput,
  CreatePaymentInput,
  DepositReturnInput,
  DepositsHeldList,
  FineResolution,
  FineResolveQuery,
  FinesQuery,
  Page,
  PageQuery,
  ReceivablesList,
  RentalFine,
  RentalPayment,
  VoidPaymentInput,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalCashUseCases } from '../application/rental-cash.usecases';
import { RentalFineUseCases } from '../application/rental-fine.usecases';
import { RentalPaymentUseCases } from '../application/rental-payment.usecases';

const { read, charge } = PERMISSIONS.rentals.actions;

function idPipe(message: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message }),
  });
}

/**
 * El dinero de la rentadora (098): pagos, anulación, depósito, multas y
 * cuentas por cobrar. La caja es un turno (109) y vive en `RentalCashController`.
 * Todo con `rentals.charge`; ver multas con `rentals.read`. Comparte el prefijo
 * `/rentals` con el controller de la 096.
 */
@Controller('rentals')
export class RentalBillingController {
  private static readonly agreementId = idPipe('Esa renta no existe.');
  private static readonly paymentId = idPipe('Ese pago no existe.');

  constructor(
    private readonly payments: RentalPaymentUseCases,
    private readonly fines: RentalFineUseCases,
    private readonly cash: RentalCashUseCases,
  ) {}

  @Post('agreements/:id/payments')
  @RequirePermissions(charge.key)
  addPayment(
    @Param('id', RentalBillingController.agreementId) id: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) input: CreatePaymentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalPayment> {
    return this.payments.addPayment(id, input, user);
  }

  @Get('agreements/:id/payments')
  @RequirePermissions(read.key)
  listPayments(
    @Param('id', RentalBillingController.agreementId) id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Page<RentalPayment>> {
    return this.payments.listPayments(id, query);
  }

  @Post('payments/:paymentId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(charge.key)
  voidPayment(
    @Param('paymentId', RentalBillingController.paymentId) paymentId: string,
    @Body(new ZodValidationPipe(voidPaymentSchema)) input: VoidPaymentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalPayment> {
    return this.payments.voidPayment(paymentId, input, user);
  }

  @Post('agreements/:id/deposit-return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(charge.key)
  returnDeposit(
    @Param('id', RentalBillingController.agreementId) id: string,
    @Body(new ZodValidationPipe(depositReturnSchema)) input: DepositReturnInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BillingAgreementView> {
    return this.payments.returnDeposit(id, input, user);
  }

  @Get('fines')
  @RequirePermissions(read.key)
  listFines(
    @Query(new ZodValidationPipe(finesQuerySchema)) query: FinesQuery,
  ): Promise<Page<RentalFine>> {
    return this.fines.list(query);
  }

  /** A quién se le cargaría una multa, antes de guardarla (`FineDialog`). */
  @Get('fines/resolve')
  @RequirePermissions(read.key)
  resolveFine(
    @Query(new ZodValidationPipe(fineResolveQuerySchema)) query: FineResolveQuery,
  ): Promise<FineResolution> {
    return this.fines.resolve(query);
  }

  @Post('fines')
  @RequirePermissions(charge.key)
  createFine(
    @Body(new ZodValidationPipe(createFineSchema)) input: CreateFineInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalFine> {
    return this.fines.create(input, user);
  }

  @Get('receivables')
  @RequirePermissions(charge.key)
  receivables(
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<ReceivablesList> {
    return this.cash.receivables(query);
  }

  @Get('deposits-held')
  @RequirePermissions(charge.key)
  depositsHeld(
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<DepositsHeldList> {
    return this.cash.depositsHeld(query);
  }
}
