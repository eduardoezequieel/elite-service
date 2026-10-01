import type { Prisma, RentalFine, RentalPayment } from '@prisma/client';

import type {
  BillingAgreementRecord,
  BillingFineRecord,
  BillingPaymentRecord,
} from '../application/ports/agreement-reader';

/**
 * Cómo se leen de la base una renta para su cuenta, un pago y una multa
 * (098). Vive aparte para que el lector de rentas, los pagos y las multas
 * armen lo mismo, y para que la 096 pueda reusar `fineInclude` y los mapeos.
 */

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export const fineInclude = {
  vehicle: { select: { plate: true, make: true, model: true } },
  agreement: {
    select: { id: true, contractNumber: true, customer: { select: { fullName: true } } },
  },
} satisfies Prisma.RentalFineInclude;

export type FineRow = Prisma.RentalFineGetPayload<{ include: typeof fineInclude }>;

export const agreementInclude = {
  customer: { select: { fullName: true } },
  payments: { orderBy: { paidAt: 'asc' } },
  fines: { include: fineInclude, orderBy: { occurredAt: 'desc' } },
} satisfies Prisma.RentalAgreementInclude;

export type AgreementRow = Prisma.RentalAgreementGetPayload<{ include: typeof agreementInclude }>;

export function toPaymentRecord(row: RentalPayment): BillingPaymentRecord {
  return {
    id: row.id,
    agreementId: row.agreementId,
    amount: money(row.amount),
    method: row.method,
    reference: row.reference,
    paidAt: row.paidAt,
    note: row.note,
    receivedByUserId: row.receivedByUserId,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    voidedByUserId: row.voidedByUserId,
    createdAt: row.createdAt,
  };
}

export function toFineRecord(
  row: RentalFine & Pick<FineRow, 'vehicle' | 'agreement'>,
): BillingFineRecord {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    agreementId: row.agreementId,
    agreement:
      row.agreement === null
        ? null
        : {
            id: row.agreement.id,
            contractNumber: row.agreement.contractNumber,
            customerName: row.agreement.customer.fullName,
          },
    occurredAt: row.occurredAt,
    amount: money(row.amount),
    description: row.description,
    chargedToCustomer: row.chargedToCustomer,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export function toAgreementRecord(row: AgreementRow): BillingAgreementRecord {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    status: row.status,
    vehicleId: row.vehicleId,
    customerName: row.customer.fullName,
    plannedPickupAt: row.plannedPickupAt,
    plannedReturnAt: row.plannedReturnAt,
    actualPickupAt: row.actualPickupAt,
    actualReturnAt: row.actualReturnAt,
    dailyRate: money(row.dailyRate),
    cdwPerDay: money(row.cdwPerDay),
    billableDays: row.billableDays,
    extraCharges: money(row.extraCharges),
    extraKmCharge: money(row.extraKmCharge),
    discount: money(row.discount),
    deposit: money(row.deposit),
    depositReturnedAmount:
      row.depositReturnedAmount === null ? null : money(row.depositReturnedAmount),
    depositTransferredToId: row.depositTransferredToId,
    payments: row.payments.map(toPaymentRecord),
    fines: row.fines.map(toFineRecord),
  };
}
