import {
  API_ERROR_CODES,
  PERMISSIONS,
  agreementsQuerySchema,
  availabilityQuerySchema,
  calendarQuerySchema,
  cancelSchema,
  checkinSchema,
  checkoutSchema,
  createAgreementSchema,
  extendSchema,
  reassignSchema,
  swapSchema,
  updateAgreementSchema,
} from '@elite/shared';
import type {
  AgreementSwapResult,
  AgreementsQuery,
  AvailabilityQuery,
  AvailabilityRow,
  CalendarQuery,
  CalendarRow,
  CancelInput,
  CheckinInput,
  CheckoutInput,
  CreateAgreementInput,
  ExtendInput,
  ReassignInput,
  RentalAgreement,
  SwapInput,
  UpdateAgreementInput,
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
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { AgreementUseCases } from '../application/agreement.usecases';
import { AvailabilityUseCases } from '../application/availability.usecases';

const { read, manage } = PERMISSIONS.rentals.actions;

/**
 * `/api/rentals` (096): rentas, disponibilidad y calendario. Lecturas con
 * `rentals.read`; toda mutación con `rentals.manage`. Sin lógica: valida,
 * llama al caso de uso y devuelve.
 */
@Controller('rentals')
export class RentalsController {
  private static readonly agreementId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Esa renta no existe.' }),
  });

  constructor(
    private readonly agreements: AgreementUseCases,
    private readonly availability: AvailabilityUseCases,
  ) {}

  @Get('agreements')
  @RequirePermissions(read.key)
  list(
    @Query(new ZodValidationPipe(agreementsQuerySchema)) query: AgreementsQuery,
  ): Promise<RentalAgreement[]> {
    return this.agreements.list(query);
  }

  @Get('agreements/:id')
  @RequirePermissions(read.key)
  get(@Param('id', RentalsController.agreementId) id: string): Promise<RentalAgreement> {
    return this.agreements.get(id);
  }

  @Post('agreements')
  @RequirePermissions(manage.key)
  create(
    @Body(new ZodValidationPipe(createAgreementSchema)) input: CreateAgreementInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalAgreement> {
    return this.agreements.create(input, user.id);
  }

  @Patch('agreements/:id')
  @RequirePermissions(manage.key)
  update(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(updateAgreementSchema)) input: UpdateAgreementInput,
  ): Promise<RentalAgreement> {
    return this.agreements.update(id, input);
  }

  @Post('agreements/:id/checkout')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  checkout(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(checkoutSchema)) input: CheckoutInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalAgreement> {
    return this.agreements.checkout(id, input, user.id);
  }

  @Post('agreements/:id/checkin')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  checkin(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(checkinSchema)) input: CheckinInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalAgreement> {
    return this.agreements.checkin(id, input, user.id);
  }

  @Post('agreements/:id/extend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  extend(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(extendSchema)) input: ExtendInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalAgreement> {
    return this.agreements.extend(id, input, user.id);
  }

  @Post('agreements/:id/swap')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  swap(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(swapSchema)) input: SwapInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AgreementSwapResult> {
    return this.agreements.swap(id, input, user.id);
  }

  @Post('agreements/:id/reassign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  reassign(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(reassignSchema)) input: ReassignInput,
  ): Promise<RentalAgreement> {
    return this.agreements.reassign(id, input);
  }

  @Post('agreements/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  cancel(
    @Param('id', RentalsController.agreementId) id: string,
    @Body(new ZodValidationPipe(cancelSchema)) input: CancelInput,
  ): Promise<RentalAgreement> {
    return this.agreements.cancel(id, input);
  }

  @Post('agreements/:id/contract-number')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(manage.key)
  contractNumber(@Param('id', RentalsController.agreementId) id: string): Promise<RentalAgreement> {
    return this.agreements.assignContractNumber(id);
  }

  @Get('availability')
  @RequirePermissions(read.key)
  findAvailability(
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<AvailabilityRow[]> {
    return this.availability.availability(query);
  }

  @Get('calendar')
  @RequirePermissions(read.key)
  calendar(
    @Query(new ZodValidationPipe(calendarQuerySchema)) query: CalendarQuery,
  ): Promise<CalendarRow[]> {
    return this.availability.calendar(query);
  }
}
