import type {
  PaymentMethod,
  TabActor,
  TabDetail,
  TabHolder,
  TabListItem,
  TabPayment,
  TabPaymentEntry,
} from '@elite/shared';
import type { Prisma } from '@prisma/client';

import { decimalToCents, decimalToMilli } from '../../../common/prisma/decimal';
import {
  PAYMENT_BANK_ACCOUNT_SELECT,
  paymentDetailsOf,
} from '../../banking/infrastructure/bank-account-row';
import { toQuantityString } from '../../inventory/domain/stock';
import { rejectLineVoid, type TabFigures } from '../domain/tab';

/**
 * EL mapeo de una cuenta abierta (105): la lista, el detalle y el abono de
 * «Ventas del día» la leen de acá, así el titular y las cifras se nombran igual
 * en las tres.
 */

const PERSON = { select: { id: true, fullName: true } } as const;

/** Los dos titulares posibles; uno solo viene (`tabs_one_holder`). */
export const TAB_HOLDER_INCLUDE = {
  employee: PERSON,
  customer: PERSON,
} satisfies Prisma.TabInclude;

export const TAB_LIST_INCLUDE = {
  ...TAB_HOLDER_INCLUDE,
  // Solo para contar unidades: las quitadas no cuentan.
  lines: { where: { voidedAt: null }, select: { quantity: true } },
} satisfies Prisma.TabInclude;

export const TAB_DETAIL_INCLUDE = {
  ...TAB_HOLDER_INCLUDE,
  openedBy: PERSON,
  lines: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { createdBy: PERSON, voidedBy: PERSON },
  },
  payments: {
    orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
    include: { recordedBy: PERSON, bankAccount: PAYMENT_BANK_ACCOUNT_SELECT },
  },
} satisfies Prisma.TabInclude;

/** Un abono con su cuenta y su titular, para «Ventas del día». */
export const TAB_PAYMENT_ENTRY_INCLUDE = {
  recordedBy: PERSON,
  bankAccount: PAYMENT_BANK_ACCOUNT_SELECT,
  tab: { select: { id: true, number: true, ...TAB_HOLDER_INCLUDE } },
} satisfies Prisma.PaymentInclude;

type HolderRow = Prisma.TabGetPayload<{ include: typeof TAB_HOLDER_INCLUDE }>;
type ListRow = Prisma.TabGetPayload<{ include: typeof TAB_LIST_INCLUDE }>;
type DetailRow = Prisma.TabGetPayload<{ include: typeof TAB_DETAIL_INCLUDE }>;
type PaymentEntryRow = Prisma.PaymentGetPayload<{ include: typeof TAB_PAYMENT_ENTRY_INCLUDE }>;
type PaymentRow = DetailRow['payments'][number];

export function holderOf(row: Pick<HolderRow, 'employee' | 'customer'>): TabHolder {
  if (row.employee !== null) {
    return { kind: 'EMPLOYEE', id: row.employee.id, fullName: row.employee.fullName };
  }

  if (row.customer !== null) {
    return { kind: 'CUSTOMER', id: row.customer.id, fullName: row.customer.fullName };
  }

  // El CHECK `tabs_one_holder` lo impide; si pasa, es un dato roto, no una regla.
  throw new Error('Tab without holder');
}

export function figuresOf(row: {
  total: Prisma.Decimal;
  paid: Prisma.Decimal;
  balance: Prisma.Decimal;
  closedAt: Date | null;
}): TabFigures {
  return {
    total: decimalToCents(row.total),
    paid: decimalToCents(row.paid),
    balance: decimalToCents(row.balance),
    closed: row.closedAt !== null,
  };
}

function summaryOf(row: HolderRow, units: string): TabListItem {
  return {
    id: row.id,
    number: row.number,
    status: row.closedAt === null ? 'OPEN' : 'CLOSED',
    holder: holderOf(row),
    total: row.total.toFixed(2),
    paid: row.paid.toFixed(2),
    balance: row.balance.toFixed(2),
    units,
    openedAt: row.openedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

function unitsOf(lines: readonly { quantity: Prisma.Decimal; voidedAt?: Date | null }[]): string {
  return toQuantityString(
    lines
      .filter((line) => line.voidedAt === undefined || line.voidedAt === null)
      .reduce((sum, line) => sum + decimalToMilli(line.quantity), 0),
  );
}

export function toTabListItem(row: ListRow): TabListItem {
  return summaryOf(row, unitsOf(row.lines));
}

function toPayment(row: PaymentRow | PaymentEntryRow): TabPayment {
  return {
    id: row.id,
    method: row.method as PaymentMethod,
    amount: row.amount.toFixed(2),
    paidAt: row.paidAt.toISOString(),
    recordedBy: row.recordedBy,
    ...paymentDetailsOf(row),
  };
}

export function toTabDetail(row: DetailRow): TabDetail {
  const figures = figuresOf(row);

  return {
    ...summaryOf(row, unitsOf(row.lines)),
    openedBy: row.openedBy,
    lines: row.lines.map((line) => {
      const voided = line.voidedAt !== null;
      const voidedBy: TabActor | null = line.voidedBy;

      return {
        id: line.id,
        inventoryItemId: line.inventoryItemId,
        code: line.code,
        name: line.name,
        unitPrice: line.unitPrice.toFixed(2),
        quantity: line.quantity.toFixed(3),
        total: line.total.toFixed(2),
        createdAt: line.createdAt.toISOString(),
        createdBy: line.createdBy,
        voided:
          line.voidedAt === null || voidedBy === null
            ? null
            : { at: line.voidedAt.toISOString(), by: voidedBy, reason: line.voidReason ?? '' },
        isVoidable: rejectLineVoid(figures, { total: decimalToCents(line.total), voided }) === null,
      };
    }),
    payments: row.payments.map(toPayment),
  };
}

/** `null` si el pago no es de una cuenta: el lector filtra por `tabId`, no debería pasar. */
export function toTabPaymentEntry(row: PaymentEntryRow): TabPaymentEntry | null {
  if (row.tab === null) return null;

  return {
    ...toPayment(row),
    tab: { id: row.tab.id, number: row.tab.number, holder: holderOf(row.tab) },
  };
}
