import type { ReactNode } from 'react';

import { RentalsFrame } from '@/features/rentals/components/rentals-frame';

/**
 * Layout de la pestaña Rentas: Libre, Rentas e Historial (117).
 *
 * El marco —título, «Nueva renta» y tabs— vive acá, como el de Ventas (106):
 * cambiar de tab solo cambia el hijo. Nueva renta y la ficha de una renta
 * quedan fuera del grupo: son subpantallas con su regreso. El permiso lo pide
 * cada página.
 */
export default function RentalsTabsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RentalsFrame>{children}</RentalsFrame>;
}
