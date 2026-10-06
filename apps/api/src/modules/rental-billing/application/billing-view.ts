import { agreementTotals, centsToMoney, moneyToCents } from '@elite/shared';
import type {
  AgreementTotals,
  BillingAgreementView,
  RentalFine,
  RentalPayment,
} from '@elite/shared';

import { depositHeldCents } from '../domain/billing-rules';
import type { DepositState } from '../domain/billing-rules';
import type {
  BillingAgreementRecord,
  BillingFineRecord,
  BillingPaymentRecord,
} from './ports/agreement-reader';
import type { UserDirectory } from './ports/user-directory';

/** Lo que se muestra si el usuario que cobró ya no existe. */
const UNKNOWN_USER = 'Usuario eliminado';

/** Σ multas cargadas al cliente (`finesCharged` de `agreementTotals`). */
export function finesChargedOf(fines: readonly BillingFineRecord[]): string {
  return centsToMoney(
    fines
      .filter((fine) => fine.chargedToCustomer)
      .reduce((sum, fine) => sum + moneyToCents(fine.amount), 0),
  );
}

/** Total, pagado y saldo de una renta, siempre con `agreementTotals` de shared. */
export function totalsOf(agreement: BillingAgreementRecord): AgreementTotals {
  return agreementTotals({
    dailyRate: agreement.dailyRate,
    cdwPerDay: agreement.cdwPerDay,
    billableDays: agreement.billableDays,
    extraCharges: agreement.extraCharges,
    extraKmCharge: agreement.extraKmCharge,
    finesCharged: finesChargedOf(agreement.fines),
    discount: agreement.discount,
    payments: agreement.payments,
  });
}

export function depositStateOf(agreement: BillingAgreementRecord): DepositState {
  return {
    depositCents: moneyToCents(agreement.deposit),
    returnedCents:
      agreement.depositReturnedAmount === null
        ? null
        : moneyToCents(agreement.depositReturnedAmount),
    transferredToId: agreement.depositTransferredToId,
  };
}

export function heldDepositOf(agreement: BillingAgreementRecord): number {
  return depositHeldCents(depositStateOf(agreement));
}

/** Los ids de usuario que nombran unos pagos. */
export function paymentUserIds(payments: readonly BillingPaymentRecord[]): string[] {
  const ids = new Set<string>();

  for (const payment of payments) {
    ids.add(payment.receivedByUserId);
    if (payment.voidedByUserId !== null) ids.add(payment.voidedByUserId);
  }

  return [...ids];
}

export function toRentalPayment(
  payment: BillingPaymentRecord,
  names: ReadonlyMap<string, string>,
): RentalPayment {
  return {
    id: payment.id,
    agreementId: payment.agreementId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt.toISOString(),
    note: payment.note,
    receivedByUserId: payment.receivedByUserId,
    receivedByName: names.get(payment.receivedByUserId) ?? UNKNOWN_USER,
    voidedAt: payment.voidedAt?.toISOString() ?? null,
    voidReason: payment.voidReason,
    voidedByUserId: payment.voidedByUserId,
    voidedByName:
      payment.voidedByUserId === null ? null : (names.get(payment.voidedByUserId) ?? UNKNOWN_USER),
    cashSessionId: payment.cashSessionId,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toRentalFine(fine: BillingFineRecord): RentalFine {
  return {
    id: fine.id,
    vehicleId: fine.vehicleId,
    vehicle: fine.vehicle,
    agreementId: fine.agreementId,
    agreement: fine.agreement,
    occurredAt: fine.occurredAt.toISOString(),
    amount: fine.amount,
    description: fine.description,
    chargedToCustomer: fine.chargedToCustomer,
    createdByUserId: fine.createdByUserId,
    createdAt: fine.createdAt.toISOString(),
  };
}

/** La cuenta de una renta, con los nombres de quien cobró ya resueltos. */
export async function toBillingView(
  agreement: BillingAgreementRecord,
  users: UserDirectory,
): Promise<BillingAgreementView> {
  const names = await users.namesOf(paymentUserIds(agreement.payments));

  return {
    id: agreement.id,
    contractNumber: agreement.contractNumber,
    status: agreement.status,
    vehicleId: agreement.vehicleId,
    deposit: agreement.deposit,
    depositReturnedAmount: agreement.depositReturnedAmount,
    depositTransferredToId: agreement.depositTransferredToId,
    totals: totalsOf(agreement),
    payments: agreement.payments.map((payment) => toRentalPayment(payment, names)),
    fines: agreement.fines.map(toRentalFine),
  };
}
