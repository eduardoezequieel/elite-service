import { redirect } from 'next/navigation';

import { commissionsRedirectHref } from '@/features/carwash/performance';

/**
 * El detalle de comisiones de un empleado (061) es desde la 067 la pestaña
 * Comisiones de Rendimiento con ese empleado elegido: mismo empleado, mismo
 * rango.
 */
export default async function CarwashEmployeeCommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employeeId } = await params;
  const { start, end } = await searchParams;

  redirect(commissionsRedirectHref({ employee: employeeId, start, end }));
}
