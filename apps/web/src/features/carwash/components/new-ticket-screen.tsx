'use client';

import { useRouter } from 'next/navigation';

import { useBodyTypes, useCreateTicket, useEmployees, useServices } from '../hooks/use-tickets';
import { TicketForm } from './ticket-form';

/**
 * Alta de emergencia desde el mostrador (RN-7).
 *
 * Misma ficha que la pista más el selector de lavador, que es opcional: si no
 * se elige a nadie, el lavado queda a nombre de «Oficina» (RN-8).
 */
export function NewTicketScreen() {
  const router = useRouter();
  const services = useServices();
  const bodyTypes = useBodyTypes();
  const employees = useEmployees();
  const create = useCreateTicket();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-display">Nuevo lavado</h1>

      <TicketForm
        services={(services.data ?? []).filter((service) => service.isActive)}
        bodyTypes={bodyTypes.data ?? []}
        employees={employees.data ?? []}
        isSubmitting={create.isPending}
        error={create.error}
        onSubmit={(values) =>
          create.mutate(values, { onSuccess: (ticket) => router.replace(`/carwash/${ticket.id}`) })
        }
      />
    </div>
  );
}
