import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateFineInput,
  FineResolution,
  FineResolveQuery,
  FinesQuery,
  Page,
  RentalFine,
} from '@elite/shared';

import { NotFoundError, ValidationError } from '../../../common/errors/application-error';
import { businessDayBounds } from '../../inventory/domain/business-day';
import { agreementHolding } from '../domain/billing-rules';
import { toRentalFine } from './billing-view';
import type { AgreementReader, AgreementSpan } from './ports/agreement-reader';
import type { RentalFineRepository } from './ports/rental-fine.repository';
import type { BillingActor } from './rental-payment.usecases';

/**
 * Las multas de tránsito (098 RN-4). Se ligan a la renta que tenía el carro en
 * `occurredAt`; sin renta quedan como gasto del carro, que la 099 lee de
 * `rental_fines` con `chargedToCustomer = false`.
 */
export class RentalFineUseCases {
  constructor(
    private readonly agreements: AgreementReader,
    private readonly fines: RentalFineRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(query: FinesQuery): Promise<Page<RentalFine>> {
    const page = await this.fines.list(
      {
        vehicleId: query.vehicleId,
        agreementId: query.agreementId,
        from: query.from === undefined ? undefined : businessDayBounds(query.from).start,
        to: query.to === undefined ? undefined : businessDayBounds(query.to).end,
      },
      query,
    );

    return { ...page, items: page.items.map(toRentalFine) };
  }

  async resolve(query: FineResolveQuery): Promise<FineResolution> {
    const holder = await this.holderOf(query.vehicleId, new Date(query.occurredAt));

    return { agreement: holder === null ? null : agreementRef(holder) };
  }

  async create(input: CreateFineInput, actor: BillingActor): Promise<RentalFine> {
    if (!(await this.fines.vehicleExists(input.vehicleId))) {
      throw new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese carro no existe.' });
    }

    const occurredAt = new Date(input.occurredAt);
    const holder = await this.holderOf(input.vehicleId, occurredAt);

    if (input.chargeToCustomer && holder === null) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message:
          'Nadie tenía rentado ese carro en esa fecha: la multa solo puede quedar como gasto del carro.',
        details: { chargeToCustomer: 'No hay renta en esa fecha.' },
      });
    }

    const fine = await this.fines.create({
      vehicleId: input.vehicleId,
      agreementId: holder?.id ?? null,
      occurredAt,
      amount: input.amount,
      description: input.description,
      chargedToCustomer: input.chargeToCustomer,
      createdByUserId: actor.id,
    });

    return toRentalFine(fine);
  }

  private async holderOf(vehicleId: string, occurredAt: Date): Promise<AgreementSpan | null> {
    const spans = await this.agreements.listHoldingVehicle(vehicleId);

    return agreementHolding(spans, occurredAt, this.clock());
  }
}

function agreementRef(span: AgreementSpan) {
  return { id: span.id, contractNumber: span.contractNumber, customerName: span.customerName };
}
