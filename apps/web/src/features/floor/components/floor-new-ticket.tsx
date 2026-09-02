'use client';

import { useRouter } from 'next/navigation';

import { TicketForm } from '@/features/carwash/components/ticket-form';
import { useCreateFloorTicket, useFloorBodyTypes, useFloorServices } from '../hooks/use-floor';

/**
 * Anotar un carro desde la pista.
 *
 * Sin selector de lavador: en la pista, quien abre es quien lava, y el backend
 * lo toma de la sesión, no del cuerpo (RN-8).
 */
export function FloorNewTicket() {
  const router = useRouter();
  const services = useFloorServices();
  const bodyTypes = useFloorBodyTypes();
  const create = useCreateFloorTicket();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-display">Anotar carro</h1>

      <TicketForm
        services={services.data ?? []}
        bodyTypes={bodyTypes.data ?? []}
        isSubmitting={create.isPending}
        error={create.error}
        onSubmit={(values) =>
          create.mutate(values, { onSuccess: (ticket) => router.replace(`/floor/${ticket.id}`) })
        }
      />
    </div>
  );
}
