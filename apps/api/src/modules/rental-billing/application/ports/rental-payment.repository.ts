import type { Page, PageQuery, PaymentMethod } from '@elite/shared';

import type { BillingAgreementRecord, BillingPaymentRecord } from './agreement-reader';

export interface NewRentalPayment {
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
  note: string | null;
  receivedByUserId: string;
}

export interface PaymentVoid {
  reason: string;
  voidedByUserId: string;
  voidedAt: Date;
}

export interface DepositReturn {
  amount: string;
  note: string | null;
  returnedAt: Date;
}

/**
 * Los pagos y la devolución del depósito (098). Las escrituras reciben la
 * regla como `check`: el repositorio la vuelve a correr sobre la fila
 * bloqueada dentro de su transacción, así dos cobros a la vez no pasan juntos
 * del saldo. Si `check` lanza, no se escribe nada y el error sale tal cual.
 */
export interface RentalPaymentRepository {
  /** `null`: la renta no existe. */
  addPayment(
    agreementId: string,
    payment: NewRentalPayment,
    check: (agreement: BillingAgreementRecord) => void,
  ): Promise<BillingPaymentRecord | null>;
  /** `null`: el pago no existe. */
  voidPayment(
    paymentId: string,
    data: PaymentVoid,
    check: (payment: BillingPaymentRecord) => void,
  ): Promise<BillingPaymentRecord | null>;
  /** `false`: la renta no existe. */
  returnDeposit(
    agreementId: string,
    data: DepositReturn,
    check: (agreement: BillingAgreementRecord) => void,
  ): Promise<boolean>;
  /** Una página de los pagos de una renta (101), anulados incluidos, el último primero. */
  listByAgreement(agreementId: string, page: PageQuery): Promise<Page<BillingPaymentRecord>>;
}

export const RENTAL_PAYMENT_REPOSITORY = Symbol('rental-billing.RentalPaymentRepository');
