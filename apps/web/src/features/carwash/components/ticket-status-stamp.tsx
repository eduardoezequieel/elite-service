import type { WorkOrderStatus } from '@elite/shared';

import { Stamp, type StampTone } from '@/components/ui/stamp';

/**
 * El estado de un lavado, siempre con su palabra escrita.
 *
 * Los cuatro estados y sus tonos viven acá y en ningún otro lado: si el color
 * lo eligiera cada pantalla, el mismo estado terminaría de dos colores según
 * dónde se lo mire.
 *
 * El ciclo se lee de un vistazo: `OPEN` late en naranja porque el carro está en
 * la bahía ahora mismo, `READY` es el verde de «cobrable», `PAID` se apaga
 * porque ya está cerrado y `VOID` va en el rojo de peligro. Las palabras no
 * cambian.
 */
const STATUS: Record<WorkOrderStatus, { label: string; tone: StampTone }> = {
  OPEN: { label: 'Abierto', tone: 'washing' },
  READY: { label: 'Listo', tone: 'ready' },
  PAID: { label: 'Cobrado', tone: 'paid' },
  VOID: { label: 'Anulado', tone: 'void' },
};

export function TicketStatusStamp({ status }: { status: WorkOrderStatus }) {
  const { label, tone } = STATUS[status];

  return <Stamp tone={tone} label={label} />;
}

/** El texto del estado, para donde no cabe un sello. */
export function statusLabel(status: WorkOrderStatus): string {
  return STATUS[status].label;
}
