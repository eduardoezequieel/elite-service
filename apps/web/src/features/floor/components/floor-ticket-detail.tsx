'use client';

import type { Ticket } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { WashersField } from '@/features/carwash/components/washers-field';
import { washerNames } from '@/features/carwash/washers';
import { readyUndoToast } from '@/features/carwash/ready-undo';
import {
  useFloorEmployees,
  useFloorTicket,
  useFloorTicketAction,
  useSetFloorWashers,
} from '../hooks/use-floor';

function FloorWashers({ ticket }: { ticket: Ticket }) {
  const employees = useFloorEmployees();
  const put = useSetFloorWashers(ticket.id);
  const editable =
    ticket.status === 'OPEN' || ticket.status === 'WASHING' || ticket.status === 'READY';
  const options = [
    ...(employees.data ?? []),
    ...ticket.washers.filter(
      (washer) => !(employees.data ?? []).some((employee) => employee.id === washer.id),
    ),
  ];

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-text-faint text-label">Lavaron</p>
      {editable ? (
        <WashersField
          employees={options}
          value={ticket.washers.map((washer) => washer.id)}
          onChange={(employeeIds) => put.mutate({ employeeIds })}
          allowEmpty={false}
          disabled={put.isPending}
        />
      ) : (
        <p className="text-text text-body">{washerNames(ticket.washers)}</p>
      )}
      {put.error ? (
        <p className="text-danger-text text-body" role="alert">
          {put.error.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Un lavado visto desde la pista.
 *
 * No hay botón de cobrar ni de anular, y el backend tampoco expone esas rutas
 * para esta sesión: el empleado no cobra (RN-10) y no anula (RN-11). Ocultarlo
 * en la pantalla sin cerrarlo en el API sería decoración.
 */
export function FloorTicketDetail({ id }: { id: string }) {
  const ticket = useFloorTicket(id);
  const start = useFloorTicketAction('start');
  const ready = useFloorTicketAction('ready');
  const reopen = useFloorTicketAction('reopen');
  const { toast } = useToast();

  if (ticket.isPending) {
    return <p className="text-text-dim text-body">Cargando…</p>;
  }

  if (ticket.error !== null || ticket.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {ticket.error?.message ?? 'No se pudo cargar el lavado.'}
      </p>
    );
  }

  const data = ticket.data;
  const sequence = Number(data.number.slice(data.number.indexOf('-') + 1));

  return (
    <div className="flex flex-col gap-4">
      {/* La placa es el título: es el nombre con el que se reconoce el carro a
          tres metros, que es la distancia a la que se mira esta pantalla. */}
      <ScreenHeader
        title={<PlateChip plate={data.vehicle.plate} size="lg" />}
        subtitle={`#${sequence} · ${data.bodyType.name}`}
      >
        <TicketStatusStamp status={data.status} />
      </ScreenHeader>

      <Card className="gap-2 px-card">
        <p className="text-text-faint text-label">Cliente</p>
        <p className="text-text text-body">{data.customer.fullName}</p>
        {data.customer.phone === null ? null : (
          <p className="text-text-dim text-body">{data.customer.phone}</p>
        )}
        <FloorWashers ticket={data} />
      </Card>

      <Card className="gap-2 px-card">
        <p className="text-text-faint text-label">Servicios</p>
        {data.items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-text text-body">{item.serviceName}</span>
            <span className="text-text text-body tabular-nums">${item.unitPrice}</span>
          </div>
        ))}
        <div className="border-line-soft mt-1 flex items-baseline justify-between border-t pt-3">
          <span className="text-text-faint text-label">Total</span>
          <span className="text-figure text-text tabular-nums">${data.total}</span>
        </div>
      </Card>

      {(start.error ?? ready.error ?? reopen.error) ? (
        <p className="text-danger-text text-body" role="alert">
          {(start.error ?? ready.error ?? reopen.error)?.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 max-md:flex-col">
        {data.status === 'OPEN' ? (
          <Button
            type="button"
            size="lg"
            loading={start.isPending}
            onClick={() =>
              start.mutate(data.id, {
                onSuccess: () => toast({ title: `Lavado #${sequence} en lavado` }),
              })
            }
          >
            Tomar
          </Button>
        ) : null}
        {data.status === 'WASHING' ? (
          <Button
            type="button"
            size="lg"
            loading={ready.isPending}
            onClick={() =>
              ready.mutate(data.id, {
                onSuccess: () =>
                  toast(
                    readyUndoToast(sequence, () =>
                      reopen.mutate(data.id, {
                        onSuccess: () => toast({ title: `Lavado #${sequence} reabierto` }),
                        onError: (error) => toast({ title: error.message, tone: 'error' }),
                      }),
                    ),
                  ),
              })
            }
          >
            Marcar listo
          </Button>
        ) : null}
        {data.status === 'READY' ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            loading={reopen.isPending}
            onClick={() =>
              reopen.mutate(data.id, {
                onSuccess: () => toast({ title: `Lavado #${sequence} reabierto` }),
              })
            }
          >
            Reabrir
          </Button>
        ) : null}
      </div>
    </div>
  );
}
