import type { FleetExpenseSource, MaintenanceStatus } from '@elite/shared';

import type { StampTone } from '@/components/ui/stamp';

/**
 * Cómo se lee en pantalla el mantenimiento de la flota (099). Puro: lo que
 * llega del API ya trae el estado; acá se cuenta y se rotula.
 */

/** El tono de cada estado; la palabra la pone `MAINTENANCE_STATUS_LABELS`. */
export const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, StampTone> = {
  OK: 'green',
  SOON: 'amber',
  DUE: 'red',
  NO_DATA: 'neutral',
};

export const EXPENSE_SOURCE_TONE: Record<FleetExpenseSource, StampTone> = {
  MANUAL: 'neutral',
  CARWASH: 'paid',
  FINE: 'amber',
};

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** «Cada 5000 km o 90 días». */
export function intervalLabel(task: { intervalKm: number | null; intervalDays: number | null }) {
  const parts = [
    task.intervalKm === null ? null : `${task.intervalKm} km`,
    task.intervalDays === null ? null : count(task.intervalDays, 'día', 'días'),
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? '—' : `Cada ${parts.join(' o ')}`;
}

/** «Vence en 5 días», «Vence hoy», «Venció hace 3 días». */
export function documentLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Venció hace ${count(-daysLeft, 'día', 'días')}`;
  if (daysLeft === 0) return 'Vence hoy';

  return `Vence en ${count(daysLeft, 'día', 'días')}`;
}

/** El enlace de WhatsApp con el texto ya escrito; el número lo elige quien lo manda. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
