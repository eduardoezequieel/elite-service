'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { TicketForm } from '@/features/carwash/components/ticket-form';
import { referenceOf } from '@/features/carwash/reference';
import { useCreateFloorTicket, useFloorBodyTypes, useFloorServices } from '../hooks/use-floor';

/**
 * Anotar un carro desde la pista.
 *
 * Sin selector de lavador: en la pista, quien abre es quien lava, y el backend
 * lo toma de la sesión, no del cuerpo (RN-8).
 */
export function FloorNewTicket() {
  const router = useRouter();
  const { toast } = useToast();
  const services = useFloorServices();
  const bodyTypes = useFloorBodyTypes();
  const create = useCreateFloorTicket();

  return (
    <>
      <ScreenHeader title="Anotar carro">
        <Button variant="outline" asChild>
          <Link href="/floor">Cancelar</Link>
        </Button>
      </ScreenHeader>

      <TicketForm
        services={services.data ?? []}
        bodyTypes={bodyTypes.data ?? []}
        isSubmitting={create.isPending}
        error={create.error}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (ticket) => {
              toast({ title: `Lavado #${referenceOf(ticket.number)} abierto` });
              router.replace(`/floor/${ticket.id}`);
            },
          })
        }
      />
    </>
  );
}
