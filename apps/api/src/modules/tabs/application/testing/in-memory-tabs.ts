import { TAB_HOLDER_CUSTOMER_LIMIT, TAB_NUMBER_PREFIX } from '@elite/shared';
import type {
  InventoryLowStockPayload,
  PaymentMethod,
  TabActor,
  TabDetail,
  TabHolder,
  TabHolderOption,
  TabHolderOptions,
  TabHolderRef,
  TabList,
  TabListItem,
  TabsQuery,
} from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import { toDecimalString, type Cents } from '../../../carwash/domain/money';
import { formatNumber } from '../../../carwash/domain/numbering';
import {
  InsufficientStockError,
  InventoryItemNotFoundError,
  ItemInactiveError,
  ItemNotSellableError,
  toQuantityString,
  type Milli,
} from '../../../inventory/domain/stock';
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
} from '../../domain/tab';
import type { TabLookups } from '../ports/tab-lookups';
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
} from '../ports/tab.repository';

/**
 * Las cuentas abiertas en memoria (106), para los tests de los casos de uso.
 * Simula la transacción: valida todo antes de escribir, así un producto sin
 * existencia no deja ni la línea ni la cuenta.
 */

export interface MemoryItem {
  id: string;
  code: string;
  name: string;
  kind: 'PRODUCT' | 'SUPPLY';
  isActive: boolean;
  price: Cents;
  stock: Milli;
}

export interface MemoryMovement {
  id: string;
  itemId: string;
  type: 'SALE' | 'SALE_RETURN';
  quantity: Milli;
  tabLineId: string;
  reversesMovementId: string | null;
  unitPrice: Cents;
}

interface MemoryLine {
  id: string;
  inventoryItemId: string;
  code: string;
  name: string;
  unitPrice: Cents;
  quantity: Milli;
  total: Cents;
  createdAt: Date;
  createdBy: TabActor;
  voided: { at: Date; by: TabActor; reason: string } | null;
}

interface MemoryPayment {
  id: string;
  method: PaymentMethod;
  amount: Cents;
  paidAt: Date;
  recordedBy: TabActor;
  cashSessionId: string;
  bankAccountId: string | null;
  reference: string | null;
  description: string | null;
}

interface MemoryTab {
  id: string;
  number: string;
  holder: TabHolder;
  total: Cents;
  paid: Cents;
  balance: Cents;
  openedAt: Date;
  openedBy: TabActor;
  lastActivityAt: Date;
  closedAt: Date | null;
  lines: MemoryLine[];
  payments: MemoryPayment[];
}

/** El mundo que comparten el repositorio y las lecturas previas. */
export class TabsWorld {
  readonly items = new Map<string, MemoryItem>();
  readonly employees = new Map<string, { fullName: string; isActive: boolean }>();
  readonly customers = new Map<
    string,
    { fullName: string; phone: string | null; plate: string | null }
  >();
  readonly users = new Map<string, string>();
  readonly activeBankAccounts = new Set<string>();
  readonly tabs: MemoryTab[] = [];
  readonly movements: MemoryMovement[] = [];
  openCashSessionId: string | null = 'cash-1';
  private sequence = 0;
  private clock = Date.UTC(2026, 9, 5, 15, 0, 0);

  nextId(prefix: string): string {
    this.sequence += 1;

    return `${prefix}-${this.sequence}`;
  }

  /** Cada escritura avanza un segundo: el orden por fecha es estable. */
  now(): Date {
    this.clock += 1000;

    return new Date(this.clock);
  }

  actor(userId: string): TabActor {
    return { id: userId, fullName: this.users.get(userId) ?? userId };
  }
}

function figures(tab: MemoryTab): TabFigures {
  return { total: tab.total, paid: tab.paid, balance: tab.balance, closed: tab.closedAt !== null };
}

function apply(tab: MemoryTab, next: TabFiguresAfter, at: Date): void {
  tab.total = next.total;
  tab.paid = next.paid;
  tab.balance = next.balance;
  tab.lastActivityAt = at;
  if (next.closes) tab.closedAt = at;
}

function units(tab: MemoryTab): string {
  return toQuantityString(
    tab.lines.filter((line) => line.voided === null).reduce((sum, line) => sum + line.quantity, 0),
  );
}

function toListItem(tab: MemoryTab): TabListItem {
  return {
    id: tab.id,
    number: tab.number,
    status: tab.closedAt === null ? 'OPEN' : 'CLOSED',
    holder: tab.holder,
    total: toDecimalString(tab.total),
    paid: toDecimalString(tab.paid),
    balance: toDecimalString(tab.balance),
    units: units(tab),
    openedAt: tab.openedAt.toISOString(),
    lastActivityAt: tab.lastActivityAt.toISOString(),
    closedAt: tab.closedAt?.toISOString() ?? null,
  };
}

function toDetail(tab: MemoryTab): TabDetail {
  return {
    ...toListItem(tab),
    openedBy: tab.openedBy,
    lines: [...tab.lines].reverse().map((line) => ({
      id: line.id,
      inventoryItemId: line.inventoryItemId,
      code: line.code,
      name: line.name,
      unitPrice: toDecimalString(line.unitPrice),
      quantity: toQuantityString(line.quantity),
      total: toDecimalString(line.total),
      createdAt: line.createdAt.toISOString(),
      createdBy: line.createdBy,
      voided:
        line.voided === null
          ? null
          : { at: line.voided.at.toISOString(), by: line.voided.by, reason: line.voided.reason },
      isVoidable:
        rejectLineVoid(figures(tab), { total: line.total, voided: line.voided !== null }) === null,
    })),
    payments: [...tab.payments].reverse().map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: toDecimalString(payment.amount),
      paidAt: payment.paidAt.toISOString(),
      recordedBy: payment.recordedBy,
      bankAccount: null,
      reference: payment.reference,
      description: payment.description,
    })),
  };
}

export class InMemoryTabRepository implements TabRepository {
  /** Corre justo antes de una escritura: para simular otra caja que ganó la carrera. */
  beforeWrite: (() => void) | null = null;

  constructor(private readonly world: TabsWorld) {}

  async findById(id: string): Promise<TabDetail | null> {
    const tab = this.world.tabs.find((candidate) => candidate.id === id);

    return tab === undefined ? null : toDetail(tab);
  }

  async list(query: TabsQuery): Promise<TabList> {
    const open = this.world.tabs.filter((tab) => tab.closedAt === null);
    const owedBy = (kind: TabHolder['kind']) =>
      open.filter((tab) => tab.holder.kind === kind).reduce((sum, tab) => sum + tab.balance, 0);
    const search = query.search?.trim().toLowerCase() ?? '';
    const sequence = search === '' ? null : tabNumberQuery(search, TAB_NUMBER_PREFIX);
    const rows = this.world.tabs
      .filter((tab) => (query.status === 'OPEN' ? tab.closedAt === null : tab.closedAt !== null))
      .filter((tab) => query.holder === undefined || tab.holder.kind === query.holder)
      .filter(
        (tab) =>
          search === '' ||
          tab.holder.fullName.toLowerCase().includes(search) ||
          (sequence !== null && tab.number === formatNumber(TAB_NUMBER_PREFIX, Number(sequence))),
      )
      .sort(
        (a, b) =>
          b.balance - a.balance ||
          b.lastActivityAt.getTime() - a.lastActivityAt.getTime() ||
          b.id.localeCompare(a.id),
      );

    return {
      summary: {
        owed: toDecimalString(owedBy('EMPLOYEE') + owedBy('CUSTOMER')),
        owedByEmployees: toDecimalString(owedBy('EMPLOYEE')),
        owedByCustomers: toDecimalString(owedBy('CUSTOMER')),
        openCount: open.length,
        employeeCount: open.filter((tab) => tab.holder.kind === 'EMPLOYEE').length,
        customerCount: open.filter((tab) => tab.holder.kind === 'CUSTOMER').length,
        closedCount: this.world.tabs.length - open.length,
      },
      tabs: slicePage(rows.map(toListItem), query),
    };
  }

  async holders(search: string | null): Promise<TabHolderOptions> {
    const text = search?.toLowerCase() ?? null;
    const matches = (...values: (string | null)[]) =>
      text === null || values.some((value) => value !== null && value.toLowerCase().includes(text));
    const openTab = (kind: TabHolder['kind'], id: string): TabHolderOption['openTab'] => {
      const tab = this.world.tabs.find(
        (candidate) =>
          candidate.closedAt === null &&
          candidate.holder.kind === kind &&
          candidate.holder.id === id,
      );

      return tab === undefined
        ? null
        : { id: tab.id, number: tab.number, balance: toDecimalString(tab.balance) };
    };
    const byName = (a: TabHolderOption, b: TabHolderOption) => a.fullName.localeCompare(b.fullName);

    const employees = [...this.world.employees.entries()]
      .filter(([, employee]) => employee.isActive && matches(employee.fullName))
      .map(([id, employee]): TabHolderOption => ({
        kind: 'EMPLOYEE',
        id,
        fullName: employee.fullName,
        detail: null,
        openTab: openTab('EMPLOYEE', id),
      }))
      .sort(byName);
    const customers = [...this.world.customers.entries()]
      .filter(([, customer]) => matches(customer.fullName, customer.phone, customer.plate))
      .map(([id, customer]): TabHolderOption => ({
        kind: 'CUSTOMER',
        id,
        fullName: customer.fullName,
        detail: customer.plate ?? customer.phone,
        openTab: openTab('CUSTOMER', id),
      }))
      .sort((a, b) => Number(b.openTab !== null) - Number(a.openTab !== null) || byName(a, b))
      .slice(0, TAB_HOLDER_CUSTOMER_LIMIT);

    return { employees, customers };
  }

  async addLines(data: AddTabLinesData): Promise<AddTabLinesResult> {
    // Todo se valida antes de escribir: la transacción es todo o nada.
    for (const requested of data.items) {
      const item = this.world.items.get(requested.inventoryItemId);

      if (item === undefined) throw new InventoryItemNotFoundError(requested.inventoryItemId);
      if (!item.isActive) throw new ItemInactiveError(item.id);
      if (item.kind !== 'PRODUCT') throw new ItemNotSellableError(item.id);
      if (item.stock < requested.quantity) {
        throw new InsufficientStockError(item.id, toQuantityString(item.stock));
      }
    }

    const tab = this.openTabFor(data.holder, data.userId);
    const at = this.world.now();
    let added = 0;

    for (const requested of data.items) {
      const item = this.world.items.get(requested.inventoryItemId);

      if (item === undefined) throw new InventoryItemNotFoundError(requested.inventoryItemId);

      const total = tabLineTotal(item.price, requested.quantity);
      const line: MemoryLine = {
        id: this.world.nextId('line'),
        inventoryItemId: item.id,
        code: item.code,
        name: item.name,
        unitPrice: item.price,
        quantity: requested.quantity,
        total,
        createdAt: at,
        createdBy: this.world.actor(data.userId),
        voided: null,
      };

      item.stock -= requested.quantity;
      tab.lines.push(line);
      this.world.movements.push({
        id: this.world.nextId('movement'),
        itemId: item.id,
        type: 'SALE',
        quantity: -requested.quantity,
        tabLineId: line.id,
        reversesMovementId: null,
        unitPrice: item.price,
      });
      added += total;
    }

    apply(tab, afterLines(figures(tab), added), at);

    return { tabId: tab.id, lowStock: [] };
  }

  async voidLine(data: VoidTabLineData): Promise<{ lowStock: InventoryLowStockPayload[] }> {
    this.beforeWrite?.();

    const tab = this.world.tabs.find((candidate) => candidate.id === data.tabId);
    const line = tab?.lines.find((candidate) => candidate.id === data.lineId);

    if (tab === undefined || line === undefined) throw new TabNotFoundError();

    const rejection = rejectLineVoid(figures(tab), {
      total: line.total,
      voided: line.voided !== null,
    });

    if (rejection !== null) throw new TabRuleError(rejection);

    const sale = this.world.movements.find(
      (movement) => movement.tabLineId === line.id && movement.type === 'SALE',
    );
    const item = this.world.items.get(line.inventoryItemId);
    const at = this.world.now();

    if (item !== undefined) item.stock += line.quantity;
    this.world.movements.push({
      id: this.world.nextId('movement'),
      itemId: line.inventoryItemId,
      type: 'SALE_RETURN',
      quantity: line.quantity,
      tabLineId: line.id,
      reversesMovementId: sale?.id ?? null,
      unitPrice: line.unitPrice,
    });
    line.voided = { at, by: this.world.actor(data.userId), reason: data.reason };
    apply(tab, afterVoid(figures(tab), line.total), at);

    return { lowStock: [] };
  }

  async pay(data: TabPaymentData): Promise<void> {
    this.beforeWrite?.();

    if (this.world.openCashSessionId !== data.cashSessionId) throw new TabCashSessionGoneError();

    const tab = this.world.tabs.find((candidate) => candidate.id === data.tabId);

    if (tab === undefined) throw new TabNotFoundError();

    const rejection = rejectTabPayment(figures(tab), data.amount);

    if (rejection !== null) throw new TabRuleError(rejection);

    if (data.bankAccountId !== null && !this.world.activeBankAccounts.has(data.bankAccountId)) {
      throw new TabBankAccountUnavailableError(data.bankAccountId);
    }

    const at = this.world.now();

    tab.payments.push({
      id: this.world.nextId('payment'),
      method: data.method,
      amount: data.amount,
      paidAt: at,
      recordedBy: this.world.actor(data.userId),
      cashSessionId: data.cashSessionId,
      bankAccountId: data.bankAccountId,
      reference: data.reference,
      description: data.description,
    });
    apply(tab, afterPayment(figures(tab), data.amount), at);
  }

  /** La abierta del titular o una nueva con el siguiente `C-NNNN` (RN-2, RN-3). */
  private openTabFor(holder: TabHolderRef, userId: string): MemoryTab {
    const existing = this.world.tabs.find(
      (tab) =>
        tab.closedAt === null && tab.holder.kind === holder.kind && tab.holder.id === holder.id,
    );

    if (existing !== undefined) return existing;

    const fullName =
      holder.kind === 'EMPLOYEE'
        ? (this.world.employees.get(holder.id)?.fullName ?? holder.id)
        : (this.world.customers.get(holder.id)?.fullName ?? holder.id);
    const at = this.world.now();
    const tab: MemoryTab = {
      id: this.world.nextId('tab'),
      number: formatNumber(TAB_NUMBER_PREFIX, this.world.tabs.length + 1),
      holder: { kind: holder.kind, id: holder.id, fullName },
      total: 0,
      paid: 0,
      balance: 0,
      openedAt: at,
      openedBy: this.world.actor(userId),
      lastActivityAt: at,
      closedAt: null,
      lines: [],
      payments: [],
    };

    this.world.tabs.push(tab);

    return tab;
  }
}

export class InMemoryTabLookups implements TabLookups {
  constructor(private readonly world: TabsWorld) {}

  async findHolder(ref: TabHolderRef): Promise<TabHolder | null> {
    if (ref.kind === 'EMPLOYEE') {
      const employee = this.world.employees.get(ref.id);

      return employee === undefined || !employee.isActive
        ? null
        : { kind: 'EMPLOYEE', id: ref.id, fullName: employee.fullName };
    }

    const customer = this.world.customers.get(ref.id);

    return customer === undefined
      ? null
      : { kind: 'CUSTOMER', id: ref.id, fullName: customer.fullName };
  }

  async findOpenCashSessionId(): Promise<string | null> {
    return this.world.openCashSessionId;
  }

  async findActiveBankAccountIds(ids: readonly string[]): Promise<string[]> {
    return ids.filter((id) => this.world.activeBankAccounts.has(id));
  }
}
