import { redirect } from 'next/navigation';

import { commissionsRedirectHref } from '@/features/carwash/performance';

/**
 * Comisiones vive desde la 067 en la pestaña Comisiones de Rendimiento. La
 * ruta vieja queda para los enlaces guardados: redirige con el mismo rango.
 */
export default async function CarwashCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { start, end } = await searchParams;

  redirect(commissionsRedirectHref({ start, end }));
}
