import type { Page, PageQuery } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { pageSkip } from '../../../common/pagination/page';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  BillingAgreementRecord,
  BillingPaymentRecord,
} from '../application/ports/agreement-reader';
import type {
  CashPaymentRecord,
  DepositReturn,
  NewRentalPayment,
  PaymentVoid,
  RentalPaymentRepository,
} from '../application/ports/rental-payment.repository';
import { agreementInclude, toAgreementRecord, toPaymentRecord } from './billing-rows';

/**
 * Pagos y depósito (098). Cada escritura bloquea su fila (`FOR UPDATE`), la
 * vuelve a leer y corre la regla del caso de uso adentro: dos cobros a la vez
 * sobre la misma renta se ordenan y el segundo ve el saldo que dejó el primero.
 */
@Injectable()
export class PrismaRentalPaymentRepository implements RentalPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  addPayment(
    agreementId: string,
    payment: NewRentalPayment,
    check: (agreement: BillingAgreementRecord) => void,
  ): Promise<BillingPaymentRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const agreement = await lockedAgreement(tx, agreementId);

      if (agreement === null) return null;

      check(agreement);

      const row = await tx.rentalPayment.create({ data: { agreementId, ...payment } });

      return toPaymentRecord(row);
    });
  }

  voidPayment(
    paymentId: string,
    data: PaymentVoid,
    check: (payment: BillingPaymentRecord) => void,
  ): Promise<BillingPaymentRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM rental_payments WHERE id = ${paymentId}::uuid FOR UPDATE
      `;

      if (locked.length === 0) return null;

      const current = await tx.rentalPayment.findUniqueOrThrow({ where: { id: paymentId } });

      check(toPaymentRecord(current));

      const row = await tx.rentalPayment.update({
        where: { id: paymentId },
        data: {
          voidedAt: data.voidedAt,
          voidReason: data.reason,
          voidedByUserId: data.voidedByUserId,
        },
      });

      return toPaymentRecord(row);
    });
  }

  returnDeposit(
    agreementId: string,
    data: DepositReturn,
    check: (agreement: BillingAgreementRecord) => void,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const agreement = await lockedAgreement(tx, agreementId);

      if (agreement === null) return false;

      check(agreement);

      await tx.rentalAgreement.update({
        where: { id: agreementId },
        data: {
          depositReturnedAmount: data.amount,
          depositReturnedAt: data.returnedAt,
          depositReturnNote: data.note,
        },
      });

      return true;
    });
  }

  async listPaidBetween(start: Date, end: Date): Promise<CashPaymentRecord[]> {
    const rows = await this.prisma.rentalPayment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      include: {
        agreement: { select: { contractNumber: true, customer: { select: { fullName: true } } } },
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
    });

    return rows.map(({ agreement, ...row }) => ({
      ...toPaymentRecord(row),
      contractNumber: agreement.contractNumber,
      customerName: agreement.customer.fullName,
    }));
  }

  async listByAgreement(agreementId: string, page: PageQuery): Promise<Page<BillingPaymentRecord>> {
    const where: Prisma.RentalPaymentWhereInput = { agreementId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.rentalPayment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
        skip: pageSkip(page),
        take: page.pageSize,
      }),
      this.prisma.rentalPayment.count({ where }),
    ]);

    return { items: rows.map(toPaymentRecord), page: page.page, pageSize: page.pageSize, total };
  }
}

/** La renta bloqueada y releída dentro de la transacción, o `null` si no existe. */
async function lockedAgreement(
  tx: Prisma.TransactionClient,
  agreementId: string,
): Promise<BillingAgreementRecord | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM rental_agreements WHERE id = ${agreementId}::uuid FOR UPDATE
  `;

  if (locked.length === 0) return null;

  const row = await tx.rentalAgreement.findUniqueOrThrow({
    where: { id: agreementId },
    include: agreementInclude,
  });

  return toAgreementRecord(row);
}
