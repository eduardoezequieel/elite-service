import type {
  CreateRenterInput,
  Page,
  Renter,
  RenterListItem,
  RentersQuery,
  UpdateRenterInput,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { pageOf, pageSkip } from '../../../common/pagination/page';
import { civilColumn } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { RenterRepository } from '../application/ports/renter.repository';
import { renterSearchOf } from '../domain/renter-list';
import { toRenter } from './renter-row';

/** Las dos fechas civiles pasan a `@db.Date`; lo demás va tal cual. */
function withDates<T extends UpdateRenterInput>(input: T) {
  const { licenseExpiresAt, birthDate, ...rest } = input;

  return {
    ...rest,
    licenseExpiresAt: civilColumn(licenseExpiresAt),
    birthDate: civilColumn(birthDate),
  };
}

/** Las cifras por cliente (`renterRentalStats`): rentas no canceladas y la última salida real ya ocurrida. */
const STATS = Prisma.sql`
  SELECT "customerId",
         COUNT(*) AS "rentalsCount",
         MAX("actualPickupAt") FILTER (WHERE "actualPickupAt" <= NOW()) AS "lastRentalAt"
  FROM rental_agreements
  WHERE status <> 'CANCELLED'
  GROUP BY "customerId"
`;

/** `ILIKE` con los comodines del texto escapados. */
function like(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Sin signos: `'0123-4567'` → `'01234567'`, para buscar por dígitos. */
function digitsOf(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g')`;
}

/** El filtro de `matchesRenterSearch` más bloqueado y activo. */
function whereOf(query: RentersQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [];

  if (query.blocked !== undefined) parts.push(Prisma.sql`c."isBlocked" = ${query.blocked}`);
  if (query.active !== undefined) parts.push(Prisma.sql`c."isActive" = ${query.active}`);

  const search = renterSearchOf(query.q);
  if (search !== null) {
    const term = like(search.term);
    const alternatives = [
      Prisma.join(
        search.words.map((word) => Prisma.sql`c."fullName" ILIKE ${like(word)}`),
        ' AND ',
      ),
      Prisma.sql`c."documentId" ILIKE ${term}`,
      Prisma.sql`c."licenseNumber" ILIKE ${term}`,
      Prisma.sql`c."mobilePhone" ILIKE ${term}`,
      Prisma.sql`c."phone" ILIKE ${term}`,
    ];
    if (search.digits !== null) {
      const digits = like(search.digits);
      alternatives.push(
        Prisma.sql`${digitsOf(Prisma.sql`c."documentId"`)} LIKE ${digits}`,
        Prisma.sql`${digitsOf(Prisma.sql`c."mobilePhone"`)} LIKE ${digits}`,
        Prisma.sql`${digitsOf(Prisma.sql`c."phone"`)} LIKE ${digits}`,
      );
    }
    parts.push(
      Prisma.sql`(${Prisma.join(
        alternatives.map((part) => Prisma.sql`(${part})`),
        ' OR ',
      )})`,
    );
  }

  return parts.length === 0 ? Prisma.sql`TRUE` : Prisma.join(parts, ' AND ');
}

@Injectable()
export class PrismaRenterRepository implements RenterRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * La página en SQL (118): el filtro, las cifras y el orden «recent» necesitan
   * el máximo de las salidas, que Prisma no ordena. Las reglas son las de
   * `domain/renter-list.ts`; después se leen las filas completas por `id`.
   */
  async list(query: RentersQuery): Promise<Page<RenterListItem>> {
    const where = whereOf(query);
    const order =
      query.sort === 'recent'
        ? Prisma.sql`s."lastRentalAt" DESC NULLS LAST, c."fullName" ASC, c.id ASC`
        : Prisma.sql`c."fullName" ASC, c.id ASC`;

    const [ids, counted] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ id: string; rentalsCount: number; lastRentalAt: Date | null }[]>`
        SELECT c.id::text AS id,
               COALESCE(s."rentalsCount", 0)::int AS "rentalsCount",
               s."lastRentalAt" AS "lastRentalAt"
        FROM rental_customers c
        LEFT JOIN (${STATS}) s ON s."customerId" = c.id
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${query.pageSize} OFFSET ${pageSkip(query)}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM rental_customers c WHERE ${where}
      `,
    ]);

    const rows = await this.prisma.rentalCustomer.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = ids.flatMap((stats) => {
      const row = byId.get(stats.id);
      if (row === undefined) return [];

      return [
        {
          ...toRenter(row),
          rentalsCount: stats.rentalsCount,
          lastRentalAt: stats.lastRentalAt === null ? null : stats.lastRentalAt.toISOString(),
        },
      ];
    });

    return pageOf(items, counted[0]?.total ?? 0, query);
  }

  async findById(id: string): Promise<Renter | null> {
    const row = await this.prisma.rentalCustomer.findUnique({ where: { id } });

    return row === null ? null : toRenter(row);
  }

  async create(data: CreateRenterInput): Promise<Renter> {
    const row = await this.prisma.rentalCustomer.create({
      data: withDates(data) satisfies Prisma.RentalCustomerUncheckedCreateInput,
    });

    return toRenter(row);
  }

  async createMany(data: readonly CreateRenterInput[]): Promise<number> {
    const result = await this.prisma.rentalCustomer.createMany({
      data: data.map((item) => withDates(item) satisfies Prisma.RentalCustomerCreateManyInput),
    });

    return result.count;
  }

  async update(id: string, changes: UpdateRenterInput): Promise<Renter> {
    const row = await this.prisma.rentalCustomer.update({
      where: { id },
      data: withDates(changes),
    });

    return toRenter(row);
  }
}
