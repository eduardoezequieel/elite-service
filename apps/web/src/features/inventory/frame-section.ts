export type InventorySection = 'stock' | 'movements';

/**
 * La pestaña activa del marco de Inventario sale de la ruta (spec 092): el
 * marco vive en el layout del grupo `(tabs)` y ya no recibe la sección de cada
 * página. Todo lo que no es Movimientos es Existencias.
 */
export function sectionFor(pathname: string): InventorySection {
  if (pathname === '/inventory/movements') return 'movements';
  return 'stock';
}
