import type { Ticket } from '@elite/shared';

import type { ComboboxOption } from '@/lib/combobox';

/** Valor de «sin recorte» en todos los Combobox del popover. */
export const ALL_FILTER = 'all';

/** Empleado / pago / diferencia: la fila no tiene ese dato. */
export const NONE_FILTER = 'none';

/** Pago todavía no cobrado. */
export const PENDING_FILTER = 'pending';

export function isAll(value: string): boolean {
  return value === ALL_FILTER;
}

export function countActiveFilters(values: readonly string[]): number {
  return values.filter((value) => !isAll(value)).length;
}

export function matchesValue(actual: string | null | undefined, selected: string): boolean {
  if (isAll(selected)) return true;

  return actual === selected;
}

export function matchesActivity(isActive: boolean, selected: string): boolean {
  if (isAll(selected)) return true;
  if (selected === 'active') return isActive;
  if (selected === 'inactive') return !isActive;

  return true;
}

/** Primera aparición de cada valor, en el orden de las filas. */
export function uniqueOptions<T>(
  items: readonly T[],
  valueOf: (item: T) => string | null | undefined,
  labelOf: (item: T) => string,
): ComboboxOption[] {
  const seen = new Map<string, string>();

  for (const item of items) {
    const value = valueOf(item);
    if (value === null || value === undefined || value === '') continue;
    if (!seen.has(value)) seen.set(value, labelOf(item));
  }

  return [...seen.entries()].map(([value, label]) => ({ value, label }));
}

export function withAllOption(allLabel: string, options: readonly ComboboxOption[]): ComboboxOption[] {
  return [{ value: ALL_FILTER, label: allLabel }, ...options];
}

export function activityOptions(
  allLabel: string,
  activeLabel: string,
  inactiveLabel: string,
): ComboboxOption[] {
  return withAllOption(allLabel, [
    { value: 'active', label: activeLabel },
    { value: 'inactive', label: inactiveLabel },
  ]);
}

export type TicketListFilters = {
  bodyTypeId: string;
  serviceId: string;
  washerId: string;
  payment: string;
  status: string;
};

const DEFAULT_TICKET_FILTERS: TicketListFilters = {
  bodyTypeId: ALL_FILTER,
  serviceId: ALL_FILTER,
  washerId: ALL_FILTER,
  payment: ALL_FILTER,
  status: ALL_FILTER,
};

export function ticketMatchesFilters(
  ticket: Ticket,
  filters: Partial<TicketListFilters>,
): boolean {
  const next = { ...DEFAULT_TICKET_FILTERS, ...filters };

  if (!matchesValue(ticket.bodyType.id, next.bodyTypeId)) return false;
  if (!isAll(next.serviceId)) {
    const hit = ticket.items.some(
      (item) => (item.serviceId ?? item.serviceName) === next.serviceId,
    );
    if (!hit) return false;
  }
  if (!isAll(next.washerId)) {
    if (next.washerId === NONE_FILTER) {
      if (ticket.washers.length > 0) return false;
    } else if (!ticket.washers.some((washer) => washer.id === next.washerId)) {
      return false;
    }
  }
  if (!isAll(next.payment)) {
    if (next.payment === PENDING_FILTER) {
      if (ticket.payment !== null) return false;
    } else if (ticket.payment?.method !== next.payment) {
      return false;
    }
  }
  if (!matchesValue(ticket.status, next.status)) return false;

  return true;
}

export function ticketBodyTypeOptions(tickets: readonly Ticket[]): ComboboxOption[] {
  return uniqueOptions(
    tickets,
    (ticket) => ticket.bodyType.id,
    (ticket) => ticket.bodyType.name,
  );
}

export function ticketServiceOptions(tickets: readonly Ticket[]): ComboboxOption[] {
  return uniqueOptions(
    tickets.flatMap((ticket) => ticket.items),
    (item) => item.serviceId ?? item.serviceName,
    (item) => item.serviceName,
  );
}

export function ticketWasherOptions(tickets: readonly Ticket[]): ComboboxOption[] {
  const named = uniqueOptions(
    tickets.flatMap((ticket) => ticket.washers),
    (washer) => washer.id,
    (washer) => washer.fullName,
  );
  const unassigned = tickets.some((ticket) => ticket.washers.length === 0);

  return unassigned ? [{ value: NONE_FILTER, label: 'Sin asignar' }, ...named] : named;
}

export const FILTERS_GAP = 8;
export const FILTERS_EDGE = 12;
export const FILTERS_WIDTH = 330;

export type FiltersBox = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type FiltersViewport = {
  width: number;
  height: number;
};

/**
 * Coloca la tarjeta: ancho fijo, alineada al borde derecho del botón, 8px de
 * gap. Si no cabe abajo, se da vuelta.
 */
export function placeFiltersPanel(
  trigger: FiltersBox,
  panel: { width: number; height: number },
  viewport: FiltersViewport,
): { top: number; left: number; width: number } {
  const width = Math.min(panel.width, Math.max(viewport.width - FILTERS_EDGE * 2, 0));
  const maxLeft = Math.max(viewport.width - width - FILTERS_EDGE, FILTERS_EDGE);
  const preferred = trigger.left + trigger.width - width;
  const left = Math.min(Math.max(preferred, FILTERS_EDGE), maxLeft);

  const below = viewport.height - trigger.bottom - FILTERS_GAP - FILTERS_EDGE;
  const above = trigger.top - FILTERS_GAP - FILTERS_EDGE;
  const top =
    panel.height <= below || below >= above
      ? trigger.bottom + FILTERS_GAP
      : trigger.top - FILTERS_GAP - panel.height;

  return { top: Math.max(top, FILTERS_EDGE), left, width };
}
