import type { ReactNode } from 'react';

import { InventoryFrame } from '@/features/inventory/components/inventory-frame';

/**
 * Layout de las pestañas de Inventario: Existencias y Movimientos (spec 092).
 * La de Consumos del personal (070) se retiró con la spec 106.
 *
 * El marco —cabecera, acciones y pestañas— vive acá y no en cada página a
 * propósito: si cada pantalla montara el suyo, Next lo desmontaría y lo volvería
 * a montar al cambiar de pestaña, y la cabecera repetiría la entrada en cascada
 * de la 088. Con el marco en el layout, cambiar de pestaña solo cambia el hijo.
 *
 * La ficha `/inventory/[id]` queda **fuera de este grupo**: es una subpantalla
 * con su propio regreso, sin marco.
 * El permiso lo sigue pidiendo cada página con su `RequirePermission`.
 */
export default function InventoryTabsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <InventoryFrame>{children}</InventoryFrame>;
}
