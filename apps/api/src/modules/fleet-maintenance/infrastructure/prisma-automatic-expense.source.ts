import type { FleetExpenseRow } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { businessDateOf, businessDayBounds } from '../../inventory/domain/business-day';
import type {
  AutomaticExpenseSource,
  ExpenseFilter,
} from '../application/ports/fleet-expense.repository';
import { VEHICLE_REF_SELECT, toVehicleRef } from './expense-row';

type RangeFilter = Omit<ExpenseFilter, 'type'>;

interface WashRow {
  id: string;
  number: string;
  chargedAt: Date;
  vehicleId: string;
  plate: string | null;
  make: string;
  model: string;
  year: number | null;
  amount: string;
}

/** `[desde, hasta)` en instantes, con los días civiles del taller. */
function instantRange(filter: RangeFilter): { start?: Date; end?: Date } {
  return {
    start: filter.from === undefined ? undefined : businessDayBounds(filter.from).start,
    end: filter.to === undefined ? undefined : businessDayBounds(filter.to).end,
  };
}

/**
 * Los gastos que llegan solos (099 RN-4), leídos directo con Prisma: el módulo
 * no importa `carwash` ni `rentals`.
 */
@Injectable()
export class PrismaAutomaticExpenseSource implements AutomaticExpenseSource {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lavados `PAID` del carwash cuya placa es la de un carro de la flota. Las
   * dos placas se comparan sin mayúsculas, espacios ni guiones: el lavado
   * guarda `P53-DBC` como lo escribe la máscara del mostrador, y la flota
   * `P53DBC`. El monto es la suma de los pagos de esa orden (su parte de la
   * cuenta, 059) y la fecha, la del cobro.
   */
  async carwashWashes(filter: RangeFilter): Promise<FleetExpenseRow[]> {
    const { start, end } = instantRange(filter);

    const rows = await this.prisma.$queryRaw<WashRow[]>`
      SELECT wo.id::text AS id,
             wo.number AS number,
             wo."chargedAt" AS "chargedAt",
             fv.id::text AS "vehicleId",
             fv.plate AS plate,
             fv.make AS make,
             fv.model AS model,
             fv.year AS year,
             COALESCE(SUM(p.amount), 0)::numeric(12, 2)::text AS amount
        FROM work_orders wo
        JOIN vehicles v ON v.id = wo."vehicleId"
        JOIN fleet_vehicles fv
          ON fv.plate IS NOT NULL
         AND regexp_replace(upper(fv.plate), '[^A-Z0-9]', '', 'g')
           = regexp_replace(upper(v.plate), '[^A-Z0-9]', '', 'g')
        LEFT JOIN payments p ON p."workOrderId" = wo.id
       WHERE wo.status = 'PAID'
         AND wo."chargedAt" IS NOT NULL
         ${filter.vehicleId === undefined ? Prisma.empty : Prisma.sql`AND fv.id = ${filter.vehicleId}::uuid`}
         ${start === undefined ? Prisma.empty : Prisma.sql`AND wo."chargedAt" >= ${start}`}
         ${end === undefined ? Prisma.empty : Prisma.sql`AND wo."chargedAt" < ${end}`}
       GROUP BY wo.id, fv.id
      HAVING COALESCE(SUM(p.amount), 0) > 0
       ORDER BY wo."chargedAt" DESC`;

    return rows.map((row) => ({
      id: row.id,
      source: 'CARWASH',
      vehicle: toVehicleRef({
        id: row.vehicleId,
        plate: row.plate,
        make: row.make,
        model: row.model,
        year: row.year,
      }),
      type: 'WASH',
      amount: row.amount,
      incurredAt: businessDateOf(row.chargedAt),
      odometerKm: null,
      description: `Lavado ${row.number}`,
      maintenanceLogId: null,
      reference: row.number,
      editable: false,
    }));
  }

  /** Multas que no se le cargaron al cliente: las paga la rentadora. */
  async unchargedFines(filter: RangeFilter): Promise<FleetExpenseRow[]> {
    const { start, end } = instantRange(filter);

    const rows = await this.prisma.rentalFine.findMany({
      where: {
        chargedToCustomer: false,
        ...(filter.vehicleId === undefined ? {} : { vehicleId: filter.vehicleId }),
        ...(start === undefined && end === undefined
          ? {}
          : {
              occurredAt: {
                ...(start === undefined ? {} : { gte: start }),
                ...(end === undefined ? {} : { lt: end }),
              },
            }),
      },
      include: { vehicle: { select: VEHICLE_REF_SELECT } },
      orderBy: { occurredAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      source: 'FINE',
      vehicle: toVehicleRef(row.vehicle),
      type: 'FINE',
      amount: row.amount.toFixed(2),
      incurredAt: businessDateOf(row.occurredAt),
      odometerKm: null,
      description: row.description,
      maintenanceLogId: null,
      reference: null,
      editable: false,
    }));
  }
}
