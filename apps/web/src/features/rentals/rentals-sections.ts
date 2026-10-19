/** Los tres tabs de la pestaña Rentas (117), cada uno con su URL. */
export const RENTALS_SECTIONS = [
  { value: 'free', label: 'Libre', href: '/rentals/available' },
  { value: 'current', label: 'Rentas', href: '/rentals/agreements' },
  { value: 'history', label: 'Historial', href: '/rentals/agreements/history' },
] as const;

export type RentalsSection = (typeof RENTALS_SECTIONS)[number]['value'];

/** El tab de la ruta. Lo que no es la lista ni el Historial, es Libre. */
export function rentalsSectionFor(pathname: string): RentalsSection {
  return RENTALS_SECTIONS.find((section) => section.href === pathname)?.value ?? 'free';
}
