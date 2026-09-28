import type { ReactNode } from 'react';

import { InventoryFrame } from '@/features/inventory/components/inventory-frame';

/**
 * Layout de las tres pestañas de Inventario: Existencias, Movimientos y
 * Consumos del personal (spec 092).
 *
 * El marco —cabecera, acciones y pestañas— vive acá y no en cada página a
 * propósito: si cada pantalla montara el suyo, Next lo desmontaría y lo volvería
 * a montar al cambiar de pestaña, y la cabecera repetiría la entrada en cascada
 * de la 088. Con el marco en el layout, cambiar de pestaña solo cambia el hijo.
 *
 * Las fichas `/inventory/[id]` y `/inventory/consumption/[employeeId]` quedan
 * **fuera de este grupo**: son subpantallas con su propio regreso, sin marco.
 * El permiso lo sigue pidiendo cada página con su `RequirePermission`.
 */
export default function InventoryTabsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <InventoryFrame>{children}</InventoryFrame>;
}
