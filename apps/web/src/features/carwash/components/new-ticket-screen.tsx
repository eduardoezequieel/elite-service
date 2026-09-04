'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { listCustomers, matchCustomer } from '@/features/customers/api';
import { referenceOf } from '../reference';
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
  const { toast } = useToast();
  const services = useServices();
  const bodyTypes = useBodyTypes();
  const employees = useEmployees();
  const create = useCreateTicket();

  return (
    <>
      <ScreenHeader
        title="Nuevo lavado"
        subtitle="Toma menos de un minuto. El total se calcula solo."
      >
        <Button variant="outline" asChild>
          <Link href="/carwash">Cancelar</Link>
        </Button>
      </ScreenHeader>

      <TicketForm
        services={(services.data ?? []).filter((service) => service.isActive)}
        bodyTypes={bodyTypes.data ?? []}
        employees={employees.data ?? []}
        customerScope="carwash"
        searchCustomers={(query) => listCustomers({ q: query })}
        matchCustomer={matchCustomer}
        isSubmitting={create.isPending}
        error={create.error}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (ticket) => {
              toast({ title: `Lavado #${referenceOf(ticket.number)} abierto` });
              router.replace(`/carwash/${ticket.id}`);
            },
          })
        }
      />
    </>
  );
}
