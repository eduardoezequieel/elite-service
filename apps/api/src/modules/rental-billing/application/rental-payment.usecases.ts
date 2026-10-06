import { API_ERROR_CODES, centsToMoney, moneyToCents } from '@elite/shared';
import type {
  BillingAgreementView,
  CreatePaymentInput,
  DepositReturnInput,
  Page,
  PageQuery,
  RentalPayment,
  VoidPaymentInput,
} from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import { acceptsPayments, depositReturnFits, paymentFits } from '../domain/billing-rules';
import {
  depositStateOf,
  heldDepositOf,
  paymentUserIds,
  toBillingView,
  toRentalPayment,
  totalsOf,
} from './billing-view';
import type { AgreementReader, BillingPaymentRecord } from './ports/agreement-reader';
import {
  CashSessionClosedError,
  CashSessionGoneError,
} from './ports/rental-cash-session.repository';
import type { RentalPaymentRepository } from './ports/rental-payment.repository';
import type { UserDirectory } from './ports/user-directory';
import { cashNotOpenForCharge } from './rental-cash.usecases';

/** Quién hace la operación: el usuario de la sesión, nunca el cuerpo del request. */
export interface BillingActor {
  id: string;
}

/**
 * Pagos sobre una renta, su anulación y la devolución del depósito (098 RN-1,
 * RN-2). El saldo sale siempre de `agreementTotals` y se vuelve a revisar
 * dentro de la transacción que escribe.
 */
export class RentalPaymentUseCases {
  constructor(
    private readonly agreements: AgreementReader,
    private readonly payments: RentalPaymentRepository,
    private readonly users: UserDirectory,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async addPayment(
    agreementId: string,
    input: CreatePaymentInput,
    actor: BillingActor,
  ): Promise<RentalPayment> {
    const amountCents = moneyToCents(input.amount);

    try {
      const created = await this.payments.addPayment(
        agreementId,
        {
          amount: input.amount,
          method: input.method,
          reference: input.reference ?? null,
          paidAt: input.paidAt === undefined ? this.clock() : new Date(input.paidAt),
          note: input.note ?? null,
          receivedByUserId: actor.id,
        },
        (agreement) => {
          if (!acceptsPayments(agreement.status)) throw agreementClosed();

          const balanceCents = moneyToCents(totalsOf(agreement).balance);

          if (!paymentFits(amountCents, balanceCents)) throw exceedsBalance(balanceCents);
        },
      );

      if (created === null) throw agreementNotFound();

      return this.present(created);
    } catch (error) {
      if (error instanceof CashSessionGoneError) throw cashNotOpenForCharge();

      throw error;
    }
  }

  async voidPayment(
    paymentId: string,
    input: VoidPaymentInput,
    actor: BillingActor,
  ): Promise<RentalPayment> {
    try {
      const voided = await this.payments.voidPayment(
        paymentId,
        { reason: input.reason, voidedByUserId: actor.id, voidedAt: this.clock() },
        (payment) => {
          if (payment.voidedAt !== null) {
            throw new ConflictError({
              code: API_ERROR_CODES.CONFLICT,
              message: 'Ese pago ya estaba anulado.',
              details: { paymentId },
            });
          }
        },
      );

      if (voided === null) {
        throw new NotFoundError({
          code: API_ERROR_CODES.NOT_FOUND,
          message: 'Ese pago no existe.',
        });
      }

      return this.present(voided);
    } catch (error) {
      if (error instanceof CashSessionClosedError) {
        throw new ConflictError({
          code: API_ERROR_CODES.CASH_SESSION_CLOSED,
          message: 'Ese turno ya cerró: el pago no se puede anular.',
        });
      }

      throw error;
    }
  }

  async returnDeposit(
    agreementId: string,
    input: DepositReturnInput,
    // La tabla no guarda quién devolvió: queda en la firma para cuando la tenga.
    _actor: BillingActor,
  ): Promise<BillingAgreementView> {
    const amountCents = moneyToCents(input.amount);
    const note = input.note ?? null;
    const found = await this.payments.returnDeposit(
      agreementId,
      { amount: input.amount, note, returnedAt: this.clock() },
      (agreement) => {
        const state = depositStateOf(agreement);

        if (!depositReturnFits(state, amountCents)) {
          throw new ConflictError({
            code: API_ERROR_CODES.DEPOSIT_EXCEEDS_HELD,
            message:
              heldDepositOf(agreement) === 0
                ? 'Esta renta no tiene depósito en custodia: ya se devolvió o no hubo.'
                : `No se puede devolver más que el depósito ($${agreement.deposit}).`,
            details: { held: centsToMoney(heldDepositOf(agreement)) },
          });
        }

        if (amountCents < state.depositCents && note === null) {
          throw new ValidationError({
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: 'Si se retiene una parte del depósito, escribí por qué.',
            details: { note: 'Escribí por qué se retiene una parte.' },
          });
        }
      },
    );

    if (!found) throw agreementNotFound();

    const agreement = await this.agreements.findById(agreementId);

    if (agreement === null) throw agreementNotFound();

    return toBillingView(agreement, this.users);
  }

  /** Los pagos de una renta, de a una página (101). 404 si la renta no existe. */
  async listPayments(agreementId: string, query: PageQuery): Promise<Page<RentalPayment>> {
    if ((await this.agreements.findById(agreementId)) === null) throw agreementNotFound();

    const page = await this.payments.listByAgreement(agreementId, query);
    const names = await this.users.namesOf(paymentUserIds(page.items));

    return { ...page, items: page.items.map((payment) => toRentalPayment(payment, names)) };
  }

  private async present(payment: BillingPaymentRecord): Promise<RentalPayment> {
    const names = await this.users.namesOf(paymentUserIds([payment]));

    return toRentalPayment(payment, names);
  }
}

function agreementNotFound(): NotFoundError {
  return new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Esa renta no existe.' });
}

function agreementClosed(): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.AGREEMENT_CLOSED,
    message: 'La renta está cancelada: no recibe pagos.',
  });
}

function exceedsBalance(balanceCents: number): ConflictError {
  const balance = centsToMoney(Math.max(0, balanceCents));

  return new ConflictError({
    code: API_ERROR_CODES.PAYMENT_EXCEEDS_BALANCE,
    message:
      balanceCents <= 0
        ? 'Esta renta no tiene saldo pendiente.'
        : `El pago pasa del saldo de la renta ($${balance}).`,
    details: { balance },
  });
}
