import type { PaymentMethod } from '@elite/shared';

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

/** Un pago de la caja del día, con su contrato y su cliente. */
export interface CashPaymentRecord extends BillingPaymentRecord {
  contractNumber: number | null;
  customerName: string;
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
  /** Los pagos con `paidAt` en `[start, end)`, anulados incluidos, por hora. */
  listPaidBetween(start: Date, end: Date): Promise<CashPaymentRecord[]>;
}

export const RENTAL_PAYMENT_REPOSITORY = Symbol('rental-billing.RentalPaymentRepository');
