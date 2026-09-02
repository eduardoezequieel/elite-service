import type { WorkOrderStatus } from '@elite/shared';

import { Stamp, type StampTone } from '@/components/ui/stamp';

/**
 * El estado de un lavado, siempre con su palabra escrita.
 *
 * Los cuatro estados y sus tonos viven acá y en ningún otro lado: si el color
 * lo eligiera cada pantalla, el mismo estado terminaría de dos colores según
 * dónde se lo mire.
 *
 * `VOID` va en neutro y no en rojo a propósito. Rojo es el sello de algo que
 * está mal; un lavado anulado no está mal, está cerrado.
 */
const STATUS: Record<WorkOrderStatus, { label: string; tone: StampTone }> = {
  OPEN: { label: 'Abierto', tone: 'amber' },
  READY: { label: 'Listo', tone: 'blue' },
  PAID: { label: 'Cobrado', tone: 'green' },
  VOID: { label: 'Anulado', tone: 'neutral' },
};

export function TicketStatusStamp({ status }: { status: WorkOrderStatus }) {
  const { label, tone } = STATUS[status];

  return <Stamp tone={tone} label={label} />;
}

/** El texto del estado, para donde no cabe un sello. */
export function statusLabel(status: WorkOrderStatus): string {
  return STATUS[status].label;
}
