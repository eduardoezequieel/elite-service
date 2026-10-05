/**
 * Cómo se leen y se arman las cuentas abiertas en pantalla (106), sin React.
 *
 * Las reglas de verdad las aplica el API —el saldo, si una línea se puede
 * quitar, si el abono pasa del saldo—; esto es lo que la pantalla decide
 * sola: qué filtro pide qué, cómo se agrupa la línea de tiempo por día, qué
 * dice el botón de cobrar, cuánto queda debiendo y qué cuerpo se manda.
 *
 * Dinero en centavos enteros y cantidades en milésimas, como la venta suelta.
 */

import type {
  AddTabLinesInput,
  PayTabInput,
  PaymentMethod,
  TabDetail,
  TabHolderKind,
  TabHolderOption,
  TabHolderOptions,
  TabLine,
  TabListItem,
  TabPayment,
  TabsQuery,
  TabsSummary,
} from '@elite/shared';

import { addDays, dayLabel, todayCivil, type CivilDate } from '@/lib/civil-date';
import { pageParam, singleParam, type SearchValue } from '@/lib/list-params';
import { centsToAmount, formatCents, parseCents, toCents } from '@/lib/money';
import { formatQuantity, milliToQuantity, quantityMilli } from '@/lib/quantity';

import { paymentDetailsInput, type PaymentDetailsDraft } from '../carwash/payment-details';
import { isOverStock, type CartLine } from '../sales/sale-cart';

// ---------------------------------------------------------------------------
// Lista: filtros, vacíos y filas
// ---------------------------------------------------------------------------

export const TABS_FILTERS = [
  { value: 'ALL', label: 'Todas' },
  { value: 'EMPLOYEE', label: 'Trabajadores' },
  { value: 'CUSTOMER', label: 'Clientes' },
  { value: 'CLOSED', label: 'Cerradas' },
] as const;

export type TabsFilter = (typeof TABS_FILTERS)[number]['value'];

/** El filtro de la URL, o «Todas» si no trae uno conocido. */
export function tabsFilterFrom(value: string | null): TabsFilter {
  return TABS_FILTERS.find((option) => option.value === value)?.value ?? 'ALL';
}

/** Lo que el chip le pide a `GET /tabs`. Los tres primeros son de las abiertas. */
export function tabsFilterQuery(filter: TabsFilter): Pick<TabsQuery, 'status' | 'holder'> {
  if (filter === 'CLOSED') return { status: 'CLOSED' };
  if (filter === 'EMPLOYEE') return { status: 'OPEN', holder: 'EMPLOYEE' };
  if (filter === 'CUSTOMER') return { status: 'OPEN', holder: 'CUSTOMER' };

  return { status: 'OPEN' };
}

/** El número de cada chip, de los totales de arriba (sin búsqueda). */
export function tabsFilterCount(summary: TabsSummary, filter: TabsFilter): number {
  if (filter === 'CLOSED') return summary.closedCount;
  if (filter === 'EMPLOYEE') return summary.employeeCount;
  if (filter === 'CUSTOMER') return summary.customerCount;

  return summary.openCount;
}

/** Lo que la lista guarda en la URL (056): volver del detalle la deja como estaba. */
export interface TabsListState {
  filter: TabsFilter;
  search: string;
  page: number;
}

/** El estado de la URL, más la cuenta a resaltar si se vuelve de anotar. */
export function tabsListFrom(params: Record<string, SearchValue>): TabsListState & {
  highlight: string | null;
} {
  return {
    filter: tabsFilterFrom(singleParam(params.filter)),
    search: singleParam(params.q) ?? '',
    page: pageParam(params.page),
    highlight: singleParam(params[TAB_HIGHLIGHT_PARAM]),
  };
}

/** La query de la lista. Lo que vale por defecto no se escribe; el resaltado tampoco. */
export function tabsListQuery(state: TabsListState): string {
  const params = new URLSearchParams();

  if (state.filter !== 'ALL') params.set('filter', state.filter);
  if (state.search.trim() !== '') params.set('q', state.search.trim());
  if (state.page > 1) params.set('page', String(state.page));

  return params.toString();
}

/** El vacío de la lista: la búsqueda manda, después el chip. */
export function tabsEmptyTitle(filter: TabsFilter, search: string): string {
  if (search.trim() !== '') return 'Sin resultados';
  if (filter === 'CLOSED') return 'Ninguna cerrada';

  return 'Nadie debe nada';
}

export const HOLDER_KIND_LABELS: Record<TabHolderKind, string> = {
  EMPLOYEE: 'Trabajador',
  CUSTOMER: 'Cliente',
};

/** Una cerrada que se pagó dice «Pagada»; una que se cerró quitando todo, «Cerrada». */
export function closedLabel(tab: Pick<TabListItem, 'paid'>): 'Pagada' | 'Cerrada' {
  return (toCents(tab.paid) ?? 0) > 0 ? 'Pagada' : 'Cerrada';
}

/** «Juan» de «Juan Pérez»: el botón y el título le hablan a la persona. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** «1 producto», «3 productos», «1.5 productos». */
export function unitsLabel(units: string): string {
  return quantityMilli(units) === 1000 ? '1 producto' : `${formatQuantity(units)} productos`;
}

/** «×2» junto al producto; una unidad no lo lleva. */
export function quantityMark(quantity: string): string | null {
  return quantityMilli(quantity) === 1000 ? null : `×${formatQuantity(quantity)}`;
}

// ---------------------------------------------------------------------------
// Detalle: la línea de tiempo por día
// ---------------------------------------------------------------------------

export type TimelineEntry =
  | { kind: 'line'; at: string; line: TabLine }
  | { kind: 'payment'; at: string; payment: TabPayment };

export interface TimelineDay {
  day: CivilDate;
  /** «Hoy», «Ayer», «Lunes 29 de septiembre». */
  label: string;
  /** Lo anotado ese día, sin lo quitado. Los abonos no suman. */
  totalCents: number;
  /** Lo más nuevo primero. */
  entries: TimelineEntry[];
}

/** El título de un día de la línea de tiempo, contado desde hoy en el taller. */
export function dayHeading(day: CivilDate, today: CivilDate): string {
  if (day === today) return 'Hoy';
  if (day === addDays(today, -1)) return 'Ayer';

  return dayLabel(day);
}

/** Líneas y abonos juntos, agrupados por día civil del taller, lo más nuevo arriba. */
export function tabTimeline(
  tab: Pick<TabDetail, 'lines' | 'payments'>,
  today: CivilDate = todayCivil(),
): TimelineDay[] {
  const entries: TimelineEntry[] = [
    ...tab.lines.map((line): TimelineEntry => ({ kind: 'line', at: line.createdAt, line })),
    ...tab.payments.map((payment): TimelineEntry => ({
      kind: 'payment',
      at: payment.paidAt,
      payment,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const days = new Map<CivilDate, TimelineDay>();

  for (const entry of entries) {
    const day = todayCivil(new Date(entry.at));
    const group = days.get(day) ?? {
      day,
      label: dayHeading(day, today),
      totalCents: 0,
      entries: [],
    };

    group.entries.push(entry);
    if (entry.kind === 'line' && entry.line.voided === null) {
      group.totalCents += toCents(entry.line.total) ?? 0;
    }
    days.set(day, group);
  }

  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

// ---------------------------------------------------------------------------
// Cobrar: monto, atajos, botón y cuerpo
// ---------------------------------------------------------------------------

/** Por qué el monto no sirve todavía, o `null`. El saldo lo vuelve a revisar el API. */
export function chargeAmountBlocker(amountCents: number, balanceCents: number): string | null {
  if (amountCents <= 0) return 'Escribí el monto';
  if (amountCents > balanceCents) return 'Pasa de lo que debe';

  return null;
}

/** Los atajos del monto: todo, y $5 o $10 si debe más que eso. */
export function chargeQuickAmounts(balanceCents: number): { label: string; cents: number }[] {
  return [
    { label: `Todo · ${formatCents(balanceCents)}`, cents: balanceCents },
    ...[500, 1000]
      .filter((cents) => balanceCents > cents)
      .map((cents) => ({ label: formatCents(cents), cents })),
  ];
}

/** Lo que queda debiendo tras abonar. Nunca negativo. */
export function remainingAfter(balanceCents: number, amountCents: number): number {
  return Math.max(0, balanceCents - amountCents);
}

/** «Cobrar $3.75 y cerrar» si paga todo, «Abonar $2.00» si es parte. */
export function chargeVerb(amountCents: number, balanceCents: number): string {
  return amountCents >= balanceCents
    ? `Cobrar ${formatCents(amountCents)} y cerrar`
    : `Abonar ${formatCents(amountCents)}`;
}

/** El vuelto en efectivo, solo en pantalla. `null` si no se tecleó o no alcanza. */
export function cashChangeCents(received: string, amountCents: number): number | null {
  if (received.trim() === '') return null;

  const cents = parseCents(received);

  return cents >= amountCents && cents > 0 ? cents - amountCents : null;
}

/** El cuerpo de `POST /tabs/:id/payments`, con los datos que pide el método (069). */
export function payTabInput(input: {
  method: PaymentMethod;
  amountCents: number;
  details: PaymentDetailsDraft;
}): PayTabInput {
  return {
    method: input.method,
    amount: centsToAmount(input.amountCents),
    ...paymentDetailsInput(input.method, input.details),
  };
}

// ---------------------------------------------------------------------------
// Anotar: titular, «Queda debiendo» y cuerpo
// ---------------------------------------------------------------------------

/** Trabajadores primero y después clientes: el orden en que se dibuja y se recorre. */
export function holdersInOrder(options: TabHolderOptions | undefined): TabHolderOption[] {
  return options === undefined ? [] : [...options.employees, ...options.customers];
}

/** Lo que va a deber después de anotar: su saldo abierto más lo de ahora. */
export function owedAfterCents(
  openTab: Pick<TabListItem, 'balance'> | null,
  addCents: number,
): number {
  return (openTab === null ? 0 : (toCents(openTab.balance) ?? 0)) + addCents;
}

/** Por qué no se puede anotar todavía, con la frase del botón. `null` cuando se puede. */
export function tabLinesBlocker(input: {
  lines: readonly CartLine[];
  hasHolder: boolean;
}): string | null {
  if (input.lines.length === 0) return 'Agregá un producto';

  const over = input.lines.find(isOverStock);

  if (over !== undefined) {
    return `Hay ${formatQuantity(milliToQuantity(over.stock))} de ${over.name}`;
  }

  if (!input.hasHolder) return 'Elegí a quién';

  return null;
}

/** El cuerpo de `POST /tabs/lines`. Sin precio: es el del artículo al anotar (RN-4). */
export function addTabLinesInput(
  holder: { kind: TabHolderKind; id: string },
  lines: readonly CartLine[],
): AddTabLinesInput {
  return {
    holder: { kind: holder.kind, id: holder.id },
    items: lines.map((line) => ({
      inventoryItemId: line.itemId,
      quantity: milliToQuantity(line.quantity),
    })),
  };
}

// ---------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------

/** El parámetro que resalta una fila de Cuentas abiertas al volver de anotar. */
export const TAB_HIGHLIGHT_PARAM = 'highlight';

/** Cuentas abiertas con la cuenta de recién resaltada. */
export function tabsListHref(highlightId?: string): string {
  return highlightId === undefined
    ? '/sales/tabs'
    : `/sales/tabs?${new URLSearchParams({ [TAB_HIGHLIGHT_PARAM]: highlightId }).toString()}`;
}

/** A quién va «Nueva venta» cuando no es una venta suelta. */
export type NewSaleTarget =
  | { kind: 'sale' }
  /** «Anotar productos» desde el detalle: el titular viene fijo y se vuelve a la cuenta. */
  | { kind: 'tab'; tabId: string }
  /** «Abrir y anotar»: arranca en «Anotar a cuenta» con la persona puesta. */
  | { kind: 'holder'; holder: { kind: TabHolderKind; id: string } };

const HOLDER_KINDS: readonly TabHolderKind[] = ['EMPLOYEE', 'CUSTOMER'];

/** Lee `?tab=` o `?holderKind=&holderId=` de la URL de «Nueva venta». */
export function newSaleTargetFrom(params: { get: (key: string) => string | null }): NewSaleTarget {
  const tabId = params.get('tab');

  if (tabId !== null && tabId.trim() !== '') return { kind: 'tab', tabId };

  const kind = params.get('holderKind');
  const id = params.get('holderId');
  const holderKind = HOLDER_KINDS.find((candidate) => candidate === kind);

  if (holderKind !== undefined && id !== null && id.trim() !== '') {
    return { kind: 'holder', holder: { kind: holderKind, id } };
  }

  return { kind: 'sale' };
}

/** La URL de «Nueva venta» para anotarle a alguien. */
export function newSaleHref(target: NewSaleTarget): string {
  if (target.kind === 'tab') {
    return `/sales/new?${new URLSearchParams({ tab: target.tabId }).toString()}`;
  }
  if (target.kind === 'holder') {
    const query = new URLSearchParams({
      holderKind: target.holder.kind,
      holderId: target.holder.id,
    });

    return `/sales/new?${query.toString()}`;
  }

  return '/sales/new';
}
