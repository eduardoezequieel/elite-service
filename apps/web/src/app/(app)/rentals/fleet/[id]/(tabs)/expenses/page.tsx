import { redirect } from 'next/navigation';

/** Gastos se juntó con Servicio en «Servicio y gastos» (122): los enlaces viejos no se rompen. */
export default async function FleetVehicleExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/rentals/fleet/${id}/maintenance`);
}
