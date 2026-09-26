import type { WorkOrderStatus } from '@elite/shared';
import { Ban, Banknote, CircleCheck, Clock, Droplets } from 'lucide-react';
import type { ReactNode } from 'react';

import { Stamp, type StampSize, type StampTone } from '@/components/ui/stamp';

/**
 * El estado de un lavado, siempre con su palabra escrita.
 *
 * Los cinco estados, sus tonos y sus iconos viven acá y en ningún otro lado: si
 * el color lo eligiera cada pantalla, el mismo estado terminaría de dos colores
 * según dónde se lo mire.
 *
 * El ciclo se lee de un vistazo: `OPEN` espera con el reloj, `WASHING` late en
 * naranja con la gota porque el carro está en la bahía ahora mismo, `READY` es
 * el verde de «cobrable» con su check, `PAID` cierra en azul con el billete —el
 * dinero ya entró, 064— y `VOID` va en el rojo de peligro.
 *
 * **Todos llevan icono** (053). Ninguno se queda con el punto suelto: el chip de
 * estado es siempre icono + palabra. El icono nunca reemplaza a la palabra.
 */
const STATUS: Record<WorkOrderStatus, { label: string; tone: StampTone; icon: ReactNode }> = {
  OPEN: { label: 'En espera', tone: 'queue', icon: <Clock /> },
  WASHING: { label: 'Lavando', tone: 'washing', icon: <Droplets /> },
  READY: { label: 'Listo', tone: 'ready', icon: <CircleCheck /> },
  PAID: { label: 'Cobrado', tone: 'paid', icon: <Banknote /> },
  VOID: { label: 'Anulado', tone: 'void', icon: <Ban /> },
};

export function TicketStatusStamp({ status, size }: { status: WorkOrderStatus; size?: StampSize }) {
  const { label, tone, icon } = STATUS[status];

  return <Stamp tone={tone} label={label} icon={icon} size={size} />;
}

/** Palabra, tono e icono del estado, para quien lo dibuja fuera del sello (063). */
export function statusLook(status: WorkOrderStatus): {
  label: string;
  tone: StampTone;
  icon: ReactNode;
} {
  return STATUS[status];
}

/** El texto del estado, para donde no cabe un sello. */
export function statusLabel(status: WorkOrderStatus): string {
  return STATUS[status].label;
}
