import type { AgreementStatus } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { civilToDate } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  AgreementChanges,
  AgreementListFilter,
  AgreementRepository,
  AgreementTermsWrite,
  CheckinWrite,
  CheckoutWrite,
  ExtendWrite,
  NewAgreementData,
  OccupancyCheck,
  PaymentWrite,
  SwapWrite,
} from '../application/ports/agreement.repository';
import { AgreementStatusChangedError } from '../domain/agreement';
import type { AgreementRecord } from '../domain/agreement';
import { AGREEMENT_INCLUDE, jsonColumn, toAgreementRecord } from './agreement-row';

type Tx = Prisma.TransactionClient;

const OCCUPYING: AgreementStatus[] = ['RESERVED', 'IN_PROGRESS'];

/** Las condiciones de la renta a columnas: la fecha civil a `@db.Date` y el conductor a JSON. */
function termsData<T extends Partial<AgreementTermsWrite>>(terms: T) {
  const { authorizationDate, additionalDriver, ...rest } = terms;

  return {
    ...rest,
    ...(authorizationDate === undefined
      ? {}
      : { authorizationDate: authorizationDate === null ? null : civilToDate(authorizationDate) }),
    ...(additionalDriver === undefined ? {} : { additionalDriver: jsonColumn(additionalDriver) }),
  };
}

/** El tramo de una renta (RN-2) toca `[from, to)`, escrito como filtro de Prisma. */
function touchingWhere(from: Date, to: Date, now: Date): Prisma.RentalAgreementWhereInput {
  return {
    AND: [
      {
        OR: [{ actualPickupAt: { lt: to } }, { actualPickupAt: null, plannedPickupAt: { lt: to } }],
      },
      {
        OR: [
          // En curso: hasta el regreso planificado o hasta ahora si va atrasada.
          now.getTime() > from.getTime()
            ? { status: 'IN_PROGRESS' }
            : { status: 'IN_PROGRESS', plannedReturnAt: { gt: from } },
          { status: 'FINISHED', actualReturnAt: { gt: from } },
          { status: 'FINISHED', actualReturnAt: null, plannedReturnAt: { gt: from } },
          { status: { in: ['RESERVED', 'CANCELLED'] }, plannedReturnAt: { gt: from } },
        ],
      },
    ],
  };
}

function searchWhere(q: string): Prisma.RentalAgreementWhereInput {
  const term = q.trim();
  const digits = /^#?\d{1,9}$/.test(term) ? Number(term.replace('#', '')) : null;

  return {
    OR: [
      { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      { vehicle: { plate: { contains: term.toUpperCase().replace(/\s+/g, '') } } },
      ...(digits === null ? [] : [{ contractNumber: digits }]),
    ],
  };
}

/**
 * Las rentas en Postgres (096). Toda escritura corre en una transacción que
 * bloquea la fila de la renta (y comprueba que siga en el estado esperado) y
 * la del carro (y corre el chequeo de choque con lo que lee adentro).
 */
@Injectable()
export class PrismaAgreementRepository implements AgreementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: AgreementListFilter): Promise<AgreementRecord[]> {
    const and: Prisma.RentalAgreementWhereInput[] = [];

    if (filter.statuses !== undefined) and.push({ status: { in: [...filter.statuses] } });
    if (filter.lateBefore !== undefined) {
      and.push({ status: 'IN_PROGRESS', plannedReturnAt: { lt: filter.lateBefore } });
    }
    if (filter.customerId !== undefined) and.push({ customerId: filter.customerId });
    if (filter.vehicleId !== undefined) and.push({ vehicleId: filter.vehicleId });
    if (filter.touching !== undefined) {
      and.push(touchingWhere(filter.touching.from, filter.touching.to, filter.touching.now));
    }
    if (filter.q !== undefined && filter.q.trim() !== '') and.push(searchWhere(filter.q));

    const rows = await this.prisma.rentalAgreement.findMany({
      where: { AND: and },
      include: AGREEMENT_INCLUDE,
      orderBy: [{ plannedPickupAt: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map(toAgreementRecord);
  }

  async findById(id: string): Promise<AgreementRecord | null> {
    const row = await this.prisma.rentalAgreement.findUnique({
      where: { id },
      include: AGREEMENT_INCLUDE,
    });

    return row === null ? null : toAgreementRecord(row);
  }

  async listOccupying(vehicleIds?: readonly string[]): Promise<AgreementRecord[]> {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: {
        status: { in: OCCUPYING },
        ...(vehicleIds === undefined ? {} : { vehicleId: { in: [...vehicleIds] } }),
      },
      include: AGREEMENT_INCLUDE,
      orderBy: { plannedPickupAt: 'asc' },
    });

    return rows.map(toAgreementRecord);
  }

  async listTouching(from: Date, to: Date, now: Date): Promise<AgreementRecord[]> {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: { AND: [{ status: { not: 'CANCELLED' } }, touchingWhere(from, to, now)] },
      include: AGREEMENT_INCLUDE,
      orderBy: { plannedPickupAt: 'asc' },
    });

    return rows.map(toAgreementRecord);
  }

  create(data: NewAgreementData, check: OccupancyCheck): Promise<AgreementRecord> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertFree(tx, check);
      const id = await this.insert(tx, data);

      return this.read(tx, id);
    });
  }

  update(
    id: string,
    from: AgreementStatus,
    changes: AgreementChanges,
    check: OccupancyCheck | null,
  ): Promise<AgreementRecord> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAgreement(tx, id, from);
      if (check !== null) await this.assertFree(tx, check);

      const { plannedPickupAt, plannedReturnAt, vehicleId, ...terms } = changes;

      await tx.rentalAgreement.update({
        where: { id },
        data: {
          ...termsData(terms),
          ...(plannedPickupAt === undefined ? {} : { plannedPickupAt }),
          ...(plannedReturnAt === undefined ? {} : { plannedReturnAt }),
          ...(vehicleId === undefined ? {} : { vehicleId }),
        },
      });

      return this.read(tx, id);
    });
  }

  checkout(id: string, data: CheckoutWrite, check: OccupancyCheck): Promise<AgreementRecord> {
    return this.prisma.$transaction(async (tx) => {
      const vehicleId = await this.lockAgreement(tx, id, 'RESERVED');
      await this.assertFree(tx, check);
      await this.applyCheckout(tx, id, vehicleId, data);

      return this.read(tx, id);
    });
  }

  checkin(id: string, data: CheckinWrite): Promise<AgreementRecord> {
    return this.prisma.$transaction(async (tx) => {
      const vehicleId = await this.lockAgreement(tx, id, 'IN_PROGRESS');

      await tx.rentalAgreement.update({
        where: { id },
        data: {
          status: 'FINISHED',
          actualReturnAt: data.actualReturnAt,
          returnInspection: jsonColumn(data.inspection),
          returnOdometerKm: data.inspection.odometerKm,
          billableDays: data.billableDays,
          extraKmCharge: data.extraKmCharge,
          notes: data.notes,
          ...(data.depositReturn === undefined
            ? {}
            : {
                depositReturnedAmount: data.depositReturn.amount,
                depositReturnedAt: data.actualReturnAt,
                depositReturnNote: data.depositReturn.note,
              }),
        },
      });
      await this.bumpOdometer(tx, vehicleId, data.inspection.odometerKm);
      if (data.payment !== undefined) await this.pay(tx, id, data.payment);

      return this.read(tx, id);
    });
  }

  extend(id: string, data: ExtendWrite, check: OccupancyCheck): Promise<AgreementRecord> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAgreement(tx, id, 'IN_PROGRESS');
      await this.assertFree(tx, check);

      await tx.rentalExtension.create({
        data: {
          agreementId: id,
          previousReturnAt: data.previousReturnAt,
          newReturnAt: data.newReturnAt,
          addedDays: data.addedDays,
          note: data.note,
          createdByUserId: data.createdByUserId,
        },
      });
      await tx.rentalAgreement.update({
        where: { id },
        data: {
          plannedReturnAt: data.newReturnAt,
          billableDays: data.billableDays,
          ...(data.dailyRate === undefined ? {} : { dailyRate: data.dailyRate }),
        },
      });

      return this.read(tx, id);
    });
  }

  swap(
    id: string,
    data: SwapWrite,
    check: OccupancyCheck,
  ): Promise<{ closed: AgreementRecord; opened: AgreementRecord }> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAgreement(tx, id, 'IN_PROGRESS');
      await this.assertFree(tx, check);

      const openedId = await this.insert(tx, data.opened, {
        previousAgreementId: id,
        swapReason: data.reason,
      });

      await tx.rentalAgreement.update({
        where: { id },
        data: {
          status: 'FINISHED',
          actualReturnAt: data.at,
          billableDays: data.closedBillableDays,
          swapReason: data.reason,
          depositTransferredToId: openedId,
        },
      });

      return { closed: await this.read(tx, id), opened: await this.read(tx, openedId) };
    });
  }

  cancel(id: string, from: AgreementStatus, reason: string, at: Date): Promise<AgreementRecord> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAgreement(tx, id, from);
      await tx.rentalAgreement.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: at },
      });

      return this.read(tx, id);
    });
  }

  // -------------------------------------------------------------------------

  /** Bloquea la renta y comprueba que siga en `from`. Devuelve su carro. */
  private async lockAgreement(tx: Tx, id: string, from: AgreementStatus): Promise<string> {
    const rows = await tx.$queryRaw<{ status: string; vehicleId: string }[]>`
      SELECT status::text AS status, "vehicleId"::text AS "vehicleId"
      FROM rental_agreements WHERE id = ${id}::uuid FOR UPDATE
    `;
    const row = rows[0];

    if (row === undefined || row.status !== from) throw new AgreementStatusChangedError(id);

    return row.vehicleId;
  }

  /** Bloquea el carro, lee lo que lo ocupa y corre el chequeo de choque (RN-2). */
  private async assertFree(tx: Tx, check: OccupancyCheck): Promise<void> {
    await tx.$queryRaw`SELECT id FROM fleet_vehicles WHERE id = ${check.vehicleId}::uuid FOR UPDATE`;

    const occupying = await tx.rentalAgreement.findMany({
      where: {
        vehicleId: check.vehicleId,
        status: { in: OCCUPYING },
        ...(check.excludeIds.length === 0 ? {} : { id: { notIn: [...check.excludeIds] } }),
      },
      include: AGREEMENT_INCLUDE,
    });

    check.assertFree(occupying.map(toAgreementRecord));
  }

  private async insert(
    tx: Tx,
    data: NewAgreementData,
    link: { previousAgreementId?: string; swapReason?: string } = {},
  ): Promise<string> {
    const {
      checkout,
      customerId,
      vehicleId,
      plannedPickupAt,
      plannedReturnAt,
      createdByUserId,
      ...terms
    } = data;

    const created = await tx.rentalAgreement.create({
      data: {
        ...termsData(terms),
        customerId,
        vehicleId,
        plannedPickupAt,
        plannedReturnAt,
        createdByUserId,
        ...link,
      },
      select: { id: true },
    });

    if (checkout !== undefined) await this.applyCheckout(tx, created.id, vehicleId, checkout);

    return created.id;
  }

  private async applyCheckout(
    tx: Tx,
    id: string,
    vehicleId: string,
    data: CheckoutWrite,
  ): Promise<void> {
    await tx.rentalAgreement.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualPickupAt: data.actualPickupAt,
        pickupInspection: jsonColumn(data.inspection),
        pickupOdometerKm: data.odometerKm,
        billableDays: data.billableDays,
        ...(data.deposit === undefined ? {} : { deposit: data.deposit }),
        ...(data.depositMethod === undefined ? {} : { depositMethod: data.depositMethod }),
      },
    });
    await this.bumpOdometer(tx, vehicleId, data.odometerKm);
    if (data.payment !== undefined) await this.pay(tx, id, data.payment);
  }

  /** El odómetro del carro solo sube: un km mal escrito no lo hace retroceder. */
  private async bumpOdometer(tx: Tx, vehicleId: string, km: number): Promise<void> {
    await tx.fleetVehicle.updateMany({
      where: { id: vehicleId, odometerKm: { lt: km } },
      data: { odometerKm: km },
    });
  }

  private async pay(tx: Tx, agreementId: string, payment: PaymentWrite): Promise<void> {
    await tx.rentalPayment.create({
      data: {
        agreementId,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        note: payment.note,
        receivedByUserId: payment.receivedByUserId,
      },
    });
  }

  private async read(tx: Tx, id: string): Promise<AgreementRecord> {
    const row = await tx.rentalAgreement.findUniqueOrThrow({
      where: { id },
      include: AGREEMENT_INCLUDE,
    });

    return toAgreementRecord(row);
  }
}
