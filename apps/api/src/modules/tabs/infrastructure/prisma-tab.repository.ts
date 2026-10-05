import { TAB_HOLDER_CUSTOMER_LIMIT, TAB_NUMBER_PREFIX } from '@elite/shared';
import type {
  InventoryLowStockPayload,
  TabDetail,
  TabHolderOption,
  TabHolderOptions,
  TabHolderRef,
  TabList,
  TabsQuery,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { decimalToCents, decimalToMilli } from '../../../common/prisma/decimal';
import { lastSequence, SEQUENCE_ATTEMPTS } from '../../../common/prisma/last-sequence';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn, uniqueViolationOnIndex } from '../../../common/prisma/unique-violation';
import { fromDecimalString, toDecimalString } from '../../carwash/domain/money';
import { formatNumber, nextNumber } from '../../carwash/domain/numbering';
import { InventoryItemNotFoundError, toQuantityString } from '../../inventory/domain/stock';
import { recordStockMovement } from '../../inventory/infrastructure/stock-ledger';
import {
  TabBankAccountUnavailableError,
  TabCashSessionGoneError,
  TabNotFoundError,
  TabRuleError,
  type AddTabLinesData,
  type AddTabLinesResult,
  type TabPaymentData,
  type TabRepository,
  type VoidTabLineData,
} from '../application/ports/tab.repository';
import {
  afterLines,
  afterPayment,
  afterVoid,
  rejectLineVoid,
  rejectTabPayment,
  tabLineTotal,
  tabNumberQuery,
  type TabFigures,
  type TabFiguresAfter,
} from '../domain/tab';
import { TAB_DETAIL_INCLUDE, TAB_LIST_INCLUDE, toTabDetail, toTabListItem } from './tab-row';

/** Los únicos parciales de la migración: una cuenta abierta por titular (RN-2). */
const ONE_OPEN_INDEXES = ['tabs_one_open_per_employee', 'tabs_one_open_per_customer'];

interface LockedTabRow {
  id: string;
  total: string;
  paid: string;
  balance: string;
  closed: boolean;
}

interface LockedItemRow {
  code: string;
  name: string;
  price: string;
}

const OPEN_TAB_SELECT = {
  where: { closedAt: null },
  select: { id: true, number: true, balance: true },
} as const;

const CUSTOMER_OPTION_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  vehicles: {
    where: { isCurrent: true },
    orderBy: { fromDate: 'desc' },
    take: 1,
    select: { vehicle: { select: { plate: true } } },
  },
  tabs: OPEN_TAB_SELECT,
} satisfies Prisma.CustomerSelect;

type CustomerOptionRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_OPTION_SELECT }>;

function openTabOf(tabs: readonly { id: string; number: string; balance: Prisma.Decimal }[]) {
  const tab = tabs[0];

  return tab === undefined
    ? null
    : { id: tab.id, number: tab.number, balance: tab.balance.toFixed(2) };
}

function toCustomerOption(row: CustomerOptionRow): TabHolderOption {
  return {
    kind: 'CUSTOMER',
    id: row.id,
    fullName: row.fullName,
    detail: row.vehicles[0]?.vehicle.plate ?? row.phone ?? null,
    openTab: openTabOf(row.tabs),
  };
}

function figuresOfLocked(row: LockedTabRow): TabFigures {
  return {
    total: fromDecimalString(row.total),
    paid: fromDecimalString(row.paid),
    balance: fromDecimalString(row.balance),
    closed: row.closed,
  };
}

/** Las columnas de cifras que escribe cada cambio; el CHECK de la migración las vuelve a mirar. */
function figuresData(next: TabFiguresAfter, at: Date): Prisma.TabUpdateInput {
  return {
    total: toDecimalString(next.total),
    paid: toDecimalString(next.paid),
    balance: toDecimalString(next.balance),
    lastActivityAt: at,
    ...(next.closes ? { closedAt: at } : {}),
  };
}

/**
 * Las cuentas abiertas en Prisma (105).
 *
 * Toda escritura bloquea la fila de la cuenta (`FOR UPDATE`) y recalcula las
 * cifras con las reglas del dominio: anotar, quitar y abonar a la vez sobre la
 * misma cuenta se ordenan, y el saldo nunca se pisa. La existencia va por
 * `recordStockMovement`, en la misma transacción (065).
 */
@Injectable()
export class PrismaTabRepository implements TabRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TabDetail | null> {
    const row = await this.prisma.tab.findUnique({ where: { id }, include: TAB_DETAIL_INCLUDE });

    return row === null ? null : toTabDetail(row);
  }

  async list(query: TabsQuery): Promise<TabList> {
    const where = listWhere(query);
    const openEmployees = {
      closedAt: null,
      employeeId: { not: null },
    } satisfies Prisma.TabWhereInput;
    const openCustomers = {
      closedAt: null,
      customerId: { not: null },
    } satisfies Prisma.TabWhereInput;

    const [rows, total, employees, customers, closedCount] = await this.prisma.$transaction([
      this.prisma.tab.findMany({
        where,
        // Por saldo y, a igual saldo (las cerradas, en cero), lo último que se movió.
        orderBy: [{ balance: 'desc' }, { lastActivityAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
        include: TAB_LIST_INCLUDE,
      }),
      this.prisma.tab.count({ where }),
      this.prisma.tab.aggregate({
        where: openEmployees,
        _sum: { balance: true },
        _count: { _all: true },
      }),
      this.prisma.tab.aggregate({
        where: openCustomers,
        _sum: { balance: true },
        _count: { _all: true },
      }),
      this.prisma.tab.count({ where: { closedAt: { not: null } } }),
    ]);

    const owedByEmployees =
      employees._sum.balance === null ? 0 : decimalToCents(employees._sum.balance);
    const owedByCustomers =
      customers._sum.balance === null ? 0 : decimalToCents(customers._sum.balance);

    return {
      summary: {
        owed: toDecimalString(owedByEmployees + owedByCustomers),
        owedByEmployees: toDecimalString(owedByEmployees),
        owedByCustomers: toDecimalString(owedByCustomers),
        openCount: employees._count._all + customers._count._all,
        employeeCount: employees._count._all,
        customerCount: customers._count._all,
        closedCount,
      },
      tabs: pageOf(rows.map(toTabListItem), total, query),
    };
  }

  async holders(search: string | null): Promise<TabHolderOptions> {
    const text =
      search === null ? undefined : { contains: search, mode: Prisma.QueryMode.insensitive };
    const customerWhere: Prisma.CustomerWhereInput =
      text === undefined
        ? {}
        : {
            OR: [
              { fullName: text },
              { phone: text },
              { vehicles: { some: { isCurrent: true, vehicle: { plate: text } } } },
            ],
          };

    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, ...(text === undefined ? {} : { fullName: text }) },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: { id: true, fullName: true, tabs: OPEN_TAB_SELECT },
    });
    // Primero quien ya debe: es a quien más se le anota.
    const withTab = await this.prisma.customer.findMany({
      where: { AND: [customerWhere, { tabs: { some: { closedAt: null } } }] },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: TAB_HOLDER_CUSTOMER_LIMIT,
      select: CUSTOMER_OPTION_SELECT,
    });
    const rest =
      withTab.length >= TAB_HOLDER_CUSTOMER_LIMIT
        ? []
        : await this.prisma.customer.findMany({
            where: { AND: [customerWhere, { tabs: { none: { closedAt: null } } }] },
            orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            take: TAB_HOLDER_CUSTOMER_LIMIT - withTab.length,
            select: CUSTOMER_OPTION_SELECT,
          });

    return {
      employees: employees.map((row) => ({
        kind: 'EMPLOYEE',
        id: row.id,
        fullName: row.fullName,
        detail: null,
        openTab: openTabOf(row.tabs),
      })),
      customers: [...withTab, ...rest].map(toCustomerOption),
    };
  }

  /**
   * Anota en una sola transacción (RN-2 a RN-4): la cuenta abierta del titular
   * —o una nueva con su correlativo—, una línea por producto con el precio de la
   * fila bloqueada y un `SALE` por línea. Si un producto no alcanza, no queda
   * nada. Un choque en el correlativo o en «una abierta por titular» (dos cajas
   * abriéndole cuenta a la misma persona a la vez) vuelve a correr la
   * transacción entera: la segunda vez encuentra la cuenta de la otra.
   */
  async addLines(data: AddTabLinesData): Promise<AddTabLinesResult> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.addLinesInTransaction(data);
      } catch (error) {
        const raced =
          uniqueViolationOn(error, 'number') ||
          ONE_OPEN_INDEXES.some((index) => uniqueViolationOnIndex(error, index));

        if (attempt < SEQUENCE_ATTEMPTS && raced) continue;
        throw error;
      }
    }
  }

  async voidLine(data: VoidTabLineData): Promise<{ lowStock: InventoryLowStockPayload[] }> {
    return this.prisma.$transaction(async (tx) => {
      const tab = await lockTab(tx, data.tabId);
      const line = await tx.tabLine.findFirst({
        where: { id: data.lineId, tabId: data.tabId },
        select: {
          inventoryItemId: true,
          quantity: true,
          unitPrice: true,
          total: true,
          voidedAt: true,
        },
      });

      if (line === null) throw new TabNotFoundError();

      const figures = figuresOfLocked(tab);
      const lineTotal = decimalToCents(line.total);
      const rejection = rejectLineVoid(figures, {
        total: lineTotal,
        voided: line.voidedAt !== null,
      });

      if (rejection !== null) throw new TabRuleError(rejection);

      const sale = await tx.inventoryMovement.findFirst({
        where: { tabLineId: data.lineId, type: 'SALE' },
        select: { id: true },
      });

      if (sale === null) throw new Error(`Tab line ${data.lineId} has no SALE movement`);

      const now = new Date();
      // Vuelve aunque el artículo ya esté desactivado, como toda devolución (065).
      const returned = await recordStockMovement(tx, {
        itemId: line.inventoryItemId,
        type: 'SALE_RETURN',
        quantity: decimalToMilli(line.quantity),
        tabLineId: data.lineId,
        reversesMovementId: sale.id,
        unitPrice: line.unitPrice.toFixed(2),
        reason: data.reason,
        createdByUserId: data.userId,
      });

      await tx.tabLine.update({
        where: { id: data.lineId },
        data: { voidedAt: now, voidedByUserId: data.userId, voidReason: data.reason },
      });
      await tx.tab.update({
        where: { id: data.tabId },
        data: figuresData(afterVoid(figures, lineTotal), now),
      });

      return { lowStock: returned.lowStock === null ? [] : [returned.lowStock] };
    });
  }

  async pay(data: TabPaymentData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // El turno, bloqueado como en el cobro (059): un cierre de caja simultáneo
      // espera a este abono o este ve la caja ya cerrada.
      const open = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM cash_sessions
        WHERE id = ${data.cashSessionId}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (open.length === 0) throw new TabCashSessionGoneError();

      const tab = await lockTab(tx, data.tabId);
      const figures = figuresOfLocked(tab);
      const rejection = rejectTabPayment(figures, data.amount);

      if (rejection !== null) throw new TabRuleError(rejection);

      if (data.bankAccountId !== null) {
        const account = await tx.bankAccount.findFirst({
          where: { id: data.bankAccountId, active: true },
          select: { id: true },
        });

        if (account === null) throw new TabBankAccountUnavailableError(data.bankAccountId);
      }

      const now = new Date();

      await tx.payment.create({
        data: {
          tabId: data.tabId,
          method: data.method,
          amount: toDecimalString(data.amount),
          paidAt: now,
          recordedByUserId: data.userId,
          cashSessionId: data.cashSessionId,
          bankAccountId: data.bankAccountId,
          reference: data.reference,
          description: data.description,
        },
      });
      await tx.tab.update({
        where: { id: data.tabId },
        data: figuresData(afterPayment(figures, data.amount), now),
      });
    });
  }

  private addLinesInTransaction(data: AddTabLinesData): Promise<AddTabLinesResult> {
    return this.prisma.$transaction(async (tx) => {
      const tabId = await lockOrOpenTab(tx, data.holder, data.userId);
      const lowStock: InventoryLowStockPayload[] = [];
      let added = 0;

      for (const item of data.items) {
        // El precio se lee de la fila ya bloqueada (RN-4): un cambio de precio en
        // paralelo espera a que esta anotación termine.
        const rows = await tx.$queryRaw<LockedItemRow[]>`
          SELECT code, name, price::text AS price FROM inventory_items
          WHERE id = ${item.inventoryItemId}::uuid
          FOR UPDATE
        `;
        const locked = rows[0];

        if (locked === undefined) throw new InventoryItemNotFoundError(item.inventoryItemId);

        const unitPrice = fromDecimalString(locked.price);
        const total = tabLineTotal(unitPrice, item.quantity);
        const line = await tx.tabLine.create({
          data: {
            tabId,
            inventoryItemId: item.inventoryItemId,
            code: locked.code,
            name: locked.name,
            unitPrice: toDecimalString(unitPrice),
            quantity: toQuantityString(item.quantity),
            total: toDecimalString(total),
            createdByUserId: data.userId,
          },
          select: { id: true },
        });
        // Solo productos activos con existencia (065 RN-19): si no, la
        // transacción entera se deshace y no queda ni la línea ni la cuenta.
        const sold = await recordStockMovement(tx, {
          itemId: item.inventoryItemId,
          type: 'SALE',
          quantity: -item.quantity,
          tabLineId: line.id,
          createdByUserId: data.userId,
          requireActive: true,
          requireSellable: true,
          freezeItemPrice: true,
        });

        if (sold.lowStock !== null) lowStock.push(sold.lowStock);
        added += total;
      }

      const tab = await lockTab(tx, tabId);

      await tx.tab.update({
        where: { id: tabId },
        data: figuresData(afterLines(figuresOfLocked(tab), added), new Date()),
      });

      return { tabId, lowStock };
    });
  }
}

/** La fila de la cuenta, bloqueada hasta el commit. */
async function lockTab(tx: Prisma.TransactionClient, tabId: string): Promise<LockedTabRow> {
  const rows = await tx.$queryRaw<LockedTabRow[]>`
    SELECT id, total::text AS total, paid::text AS paid, balance::text AS balance,
           "closedAt" IS NOT NULL AS closed
    FROM tabs
    WHERE id = ${tabId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];

  if (row === undefined) throw new TabNotFoundError();

  return row;
}

/**
 * La cuenta abierta del titular, bloqueada, o una nueva con su correlativo
 * `C-0001` (RN-2, RN-3). La columna sale de una lista cerrada, nunca del texto
 * del cliente.
 */
async function lockOrOpenTab(
  tx: Prisma.TransactionClient,
  holder: TabHolderRef,
  userId: string,
): Promise<string> {
  const column = Prisma.raw(holder.kind === 'EMPLOYEE' ? '"employeeId"' : '"customerId"');
  const open = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM tabs
    WHERE ${column} = ${holder.id}::uuid AND "closedAt" IS NULL
    FOR UPDATE
  `;
  const existing = open[0];

  if (existing !== undefined) return existing.id;

  const last = await lastSequence(tx, 'tabs', TAB_NUMBER_PREFIX);
  const created = await tx.tab.create({
    data: {
      number: nextNumber(TAB_NUMBER_PREFIX, last),
      ...(holder.kind === 'EMPLOYEE' ? { employeeId: holder.id } : { customerId: holder.id }),
      openedByUserId: userId,
    },
    select: { id: true },
  });

  return created.id;
}

/** El filtro de la lista: estado, tipo de titular y búsqueda por nombre o número. */
function listWhere(query: TabsQuery): Prisma.TabWhereInput {
  const search = query.search?.trim() ?? '';
  const sequence = search === '' ? null : tabNumberQuery(search, TAB_NUMBER_PREFIX);
  const text = { contains: search, mode: Prisma.QueryMode.insensitive };

  return {
    closedAt: query.status === 'OPEN' ? null : { not: null },
    ...(query.holder === 'EMPLOYEE' ? { employeeId: { not: null } } : {}),
    ...(query.holder === 'CUSTOMER' ? { customerId: { not: null } } : {}),
    ...(search === ''
      ? {}
      : {
          OR: [
            { employee: { fullName: text } },
            { customer: { fullName: text } },
            ...(sequence === null
              ? []
              : [{ number: formatNumber(TAB_NUMBER_PREFIX, Number(sequence)) }]),
          ],
        }),
  };
}
