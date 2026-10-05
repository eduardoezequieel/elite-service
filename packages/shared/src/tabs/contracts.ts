/**
 * spec 105 — Cuentas abiertas: lo que devuelve `/api/tabs`.
 *
 * Una cuenta es lo que alguien —un empleado o un cliente— se lleva y paga
 * después. El producto sale del inventario al anotarlo y el dinero entra a la
 * caja al abonar. Dinero con dos decimales y cantidades con tres, como cadena
 * decimal.
 */

import type { Page, PaymentMethodDetails, PaymentMethod } from '../contracts';

/** Prefijo del correlativo de una cuenta: `C-0001` (RN-3). */
export const TAB_NUMBER_PREFIX = 'C';

/** De quién es la cuenta: exactamente uno de los dos (RN-1). */
export const TAB_HOLDER_KINDS = ['EMPLOYEE', 'CUSTOMER'] as const;
export type TabHolderKind = (typeof TAB_HOLDER_KINDS)[number];

/** Abierta mientras debe; se cierra sola cuando un abono deja el saldo en cero (RN-8). */
export const TAB_STATUSES = ['OPEN', 'CLOSED'] as const;
export type TabStatus = (typeof TAB_STATUSES)[number];

/** Tope de productos distintos que se anotan de una vez. */
export const TAB_MAX_LINES = 50;

/** Tope de clientes que trae el selector de titular (`GET /tabs/holders`). */
export const TAB_HOLDER_CUSTOMER_LIMIT = 20;

/** El titular de una cuenta. */
export interface TabHolder {
  kind: TabHolderKind;
  id: string;
  fullName: string;
}

/** Quien abrió, anotó, quitó o cobró: un usuario de oficina (RN-9). */
export interface TabActor {
  id: string;
  fullName: string;
}

/** Una fila de la lista de cuentas. */
export interface TabListItem {
  id: string;
  /** `C-0001`. */
  number: string;
  status: TabStatus;
  holder: TabHolder;
  /** «Anotado»: suma de las líneas no quitadas. */
  total: string;
  /** «Abonado»: suma de los abonos. */
  paid: string;
  /** «Debe»: `total − paid`, nunca negativo (RN-6). */
  balance: string;
  /** Unidades anotadas sin las quitadas, tres decimales. */
  units: string;
  /** ISO. */
  openedAt: string;
  /** ISO: la última línea, quitada o abono. */
  lastActivityAt: string;
  /** ISO. `null` mientras está abierta. */
  closedAt: string | null;
}

/** Los totales de arriba de la lista: de todas las cuentas, sin filtro ni búsqueda. */
export interface TabsSummary {
  /** «Por cobrar»: suma de los saldos de las abiertas. */
  owed: string;
  /** De las abiertas de empleados. */
  owedByEmployees: string;
  /** De las abiertas de clientes. */
  owedByCustomers: string;
  openCount: number;
  employeeCount: number;
  customerCount: number;
  closedCount: number;
}

/** `GET /tabs`: los totales y una página de cuentas (102). */
export interface TabList {
  summary: TabsSummary;
  tabs: Page<TabListItem>;
}

/** Cómo se quitó una línea (RN-5). */
export interface TabLineVoid {
  /** ISO. */
  at: string;
  by: TabActor;
  reason: string;
}

/** Un producto anotado: snapshot del artículo y precio congelado al anotar (RN-4). */
export interface TabLine {
  id: string;
  inventoryItemId: string;
  /** Snapshot del código, `INV-0003`. */
  code: string;
  /** Snapshot del nombre. */
  name: string;
  /** Precio de venta del artículo al anotar. */
  unitPrice: string;
  /** Tres decimales. */
  quantity: string;
  /** `unitPrice × quantity`, dos decimales. */
  total: string;
  /** ISO. */
  createdAt: string;
  createdBy: TabActor;
  /** `null` si no se quitó. */
  voided: TabLineVoid | null;
  /**
   * `true` si todavía se puede quitar: cuenta abierta, línea sin quitar y el
   * saldo no quedaría bajo cero (RN-5). Lo calcula el API; la web no repite la regla.
   */
  isVoidable: boolean;
}

/** Un abono (RN-7). Es una fila de `payments` del turno de caja en que se cobró. */
export interface TabPayment extends PaymentMethodDetails {
  id: string;
  method: PaymentMethod;
  amount: string;
  /** ISO. */
  paidAt: string;
  recordedBy: TabActor;
}

/** `GET /tabs/:id`: la cuenta con sus líneas y abonos, lo más nuevo primero. */
export interface TabDetail extends TabListItem {
  openedBy: TabActor;
  lines: TabLine[];
  payments: TabPayment[];
}

/** La cuenta abierta de alguien, para el selector de titular. */
export interface TabHolderOpenTab {
  id: string;
  number: string;
  balance: string;
}

/** Alguien a quien se le puede anotar (`GET /tabs/holders`). */
export interface TabHolderOption extends TabHolder {
  /** Texto secundario: placa o teléfono del cliente. `null` en un empleado. */
  detail: string | null;
  /** Su cuenta abierta, si tiene: la web la muestra y «Abrir cuenta» lleva a ella. */
  openTab: TabHolderOpenTab | null;
}

/**
 * `GET /tabs/holders?search=`: el selector de titular. Empleados activos (todos
 * los que coinciden) y hasta `TAB_HOLDER_CUSTOMER_LIMIT` clientes, los que
 * tienen cuenta abierta primero. Es un selector, no una lista: no se pagina.
 */
export interface TabHolderOptions {
  employees: TabHolderOption[];
  customers: TabHolderOption[];
}

/** Un abono visto desde «Ventas del día»: con su cuenta y su titular. */
export interface TabPaymentEntry extends TabPayment {
  tab: { id: string; number: string; holder: TabHolder };
}
