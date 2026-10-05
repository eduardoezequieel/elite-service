import type { ReactNode } from 'react';

import { SalesFrame } from '@/features/sales/components/sales-frame';

/**
 * Layout de las pestañas de Ventas: Ventas del día y Cuentas abiertas (105).
 *
 * El marco —cabecera, «Nueva venta» y pestañas— vive acá, como el de
 * Inventario (092): cambiar de pestaña solo cambia el hijo y la cabecera no
 * repite la entrada en cascada. Nueva venta, la ficha de una venta y el detalle
 * de una cuenta quedan fuera del grupo: son subpantallas con su regreso.
 * El permiso lo pide cada página.
 */
export default function SalesTabsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SalesFrame>{children}</SalesFrame>;
}
