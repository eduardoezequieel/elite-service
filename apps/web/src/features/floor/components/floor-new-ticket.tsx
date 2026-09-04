'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { TicketForm } from '@/features/carwash/components/ticket-form';
import { referenceOf } from '@/features/carwash/reference';
import { listFloorCustomers, matchFloorCustomer } from '../api';
import {
  useCreateFloorTicket,
  useFloorBodyTypes,
  useFloorEmployees,
  useFloorServices,
  useFloorSession,
} from '../hooks/use-floor';

/**
 * Anotar un carro desde la pista.
 *
 * Quien abre queda marcado y no se saca; puede sumar a otros (009).
 */
export function FloorNewTicket() {
  const router = useRouter();
  const { toast } = useToast();
  const session = useFloorSession();
  const services = useFloorServices();
  const bodyTypes = useFloorBodyTypes();
  const employees = useFloorEmployees();
  const create = useCreateFloorTicket();
  const opener = session.data?.employee;

  return (
    <>
      <ScreenHeader title="Anotar carro">
        <Button variant="outline" asChild>
          <Link href="/floor">Cancelar</Link>
        </Button>
      </ScreenHeader>

      {opener === undefined ? (
        <p className="text-text-dim text-body">Cargando…</p>
      ) : (
        <TicketForm
          services={services.data ?? []}
          bodyTypes={bodyTypes.data ?? []}
          employees={[
            { id: opener.id, fullName: opener.fullName },
            ...(employees.data ?? []).filter((employee) => employee.id !== opener.id),
          ]}
          lockedWasherIds={[opener.id]}
          allowEmptyWashers={false}
          // Las dos vistas comparten la ficha y cada una le pasa su propia
          // búsqueda: la pista habla con `/floor/*`, la oficina con `/customers`.
          customerScope="floor"
          searchCustomers={(query) => listFloorCustomers(query)}
          matchCustomer={matchFloorCustomer}
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
      )}
    </>
  );
}
