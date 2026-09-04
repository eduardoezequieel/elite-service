'use client';

import { PERMISSIONS } from '@elite/shared';
import type { PaymentMethod, Ticket } from '@elite/shared';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { readyUndoToast } from '../ready-undo';
import {
  useEmployees,
  useSetTicketWashers,
  useTicket,
  useTicketAction,
} from '../hooks/use-tickets';
import { washerNames } from '../washers';
import { ChargeDialog } from './charge-dialog';
import { EditTicketDialog } from './edit-ticket-dialog';
import { ReverseTicketDialog } from './reverse-ticket-dialog';
import { TicketStatusStamp } from './ticket-status-stamp';
import { VoidTicketDialog } from './void-ticket-dialog';
import { WashersField } from './washers-field';

/**
 * El detalle de un lavado, desde la oficina.
 *
 * Las acciones disponibles salen del **estado** cruzado con los **permisos**, y
 * en ese orden: primero qué permite la regla de negocio (RN-9), después quién
 * puede hacerlo (RN-16). Un botón que el estado no admite no se muestra apagado,
 * no se muestra: apagado dice «no ahora», ausente dice «esto no va acá».
 */
export function TicketDetailScreen({ id }: { id: string }) {
  const { can } = usePermissions();
  const ticket = useTicket(id);
  const [charging, setCharging] = useState(false);

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

  return (
    <TicketDetail
      ticket={ticket.data}
      canManage={can(PERMISSIONS.carwash.actions.manage.key)}
      canCharge={can(PERMISSIONS.carwash.actions.charge.key)}
      canVoid={can(PERMISSIONS.carwash.actions.void.key)}
      canReverse={can(PERMISSIONS.carwash.actions.reverse.key)}
      charging={charging}
      onCharging={setCharging}
    />
  );
}

function TicketDetail({
  ticket,
  canManage,
  canCharge,
  canVoid,
  canReverse,
  charging,
  onCharging,
}: {
  ticket: Ticket;
  canManage: boolean;
  canCharge: boolean;
  canVoid: boolean;
  canReverse: boolean;
  charging: boolean;
  onCharging: (open: boolean) => void;
}) {
  const ready = useTicketAction('ready');
  const reopen = useTicketAction('reopen');
  const { toast } = useToast();
  const [voiding, setVoiding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const sequence = ticket.number.slice(ticket.number.indexOf('-') + 1);
  const reference = Number(sequence);
  const failed = ready.error ?? reopen.error;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={`#${reference}`}
        subtitle={<span className="font-mono">{ticket.number}</span>}
      >
        <TicketStatusStamp status={ticket.status} />
      </ScreenHeader>

      {ticket.status === 'VOID' ? (
        <p className="text-text-dim text-body">
          <span className="is-ruled-out">Este lavado</span> fue anulado.
        </p>
      ) : null}

      <Card className="gap-3 px-card">
        <Field label="Cliente" value={ticket.customer.fullName} />
        <Field label="Teléfono" value={ticket.customer.phone ?? '—'} />
        <Field label="Placa" value={<PlateChip plate={ticket.vehicle.plate} />} />
        <Field label="Tipo de carro" value={ticket.bodyType.name} />
        <Field
          label="Marca y color"
          value={[ticket.vehicle.make, ticket.vehicle.color].filter(Boolean).join(' · ') || '—'}
        />
        <OfficeWashers ticket={ticket} canManage={canManage} />
        {ticket.notes === null ? null : <Field label="Nota" value={ticket.notes} />}
      </Card>

      <Card className="gap-2.5 px-card">
        <p className="text-text-faint text-label">Servicios</p>
        {ticket.items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-text text-body">{item.serviceName}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              {/* El precio de catálogo solo aparece cuando hubo descuento: si
                  siempre estuviera, sería ruido en el 90% de las filas (RN-5). */}
              {item.unitPrice === item.catalogPrice ? null : (
                <span className="text-text-faint is-ruled-out text-dense">
                  ${item.catalogPrice}
                </span>
              )}
              <span className="text-text text-body">${item.unitPrice}</span>
            </span>
          </div>
        ))}
        <div className="border-line-soft mt-1 flex items-baseline justify-between border-t pt-3">
          <span className="text-text-faint text-label">Total</span>
          <span className="text-figure text-text tabular-nums">${ticket.total}</span>
        </div>
      </Card>

      {ticket.payment === null ? null : (
        <Card className="gap-3 px-card">
          <p className="text-text-faint text-label">Cobro</p>
          <Field label="Método" value={methodLabel(ticket.payment.method)} />
          <Field label="Monto" value={`$${ticket.payment.amount}`} />
        </Card>
      )}

      {failed ? (
        <p className="text-danger-text text-body" role="alert">
          {failed.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 max-md:flex-col">
        {ticket.status === 'PAID' ? (
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Imprimir recibo
          </Button>
        ) : null}

        {ticket.status === 'PAID' && canReverse ? (
          <Button type="button" variant="destructive" onClick={() => setReversing(true)}>
            Deshacer cobro
          </Button>
        ) : null}

        {ticket.status === 'READY' && canCharge ? (
          <Button type="button" onClick={() => onCharging(true)}>
            Cobrar ${ticket.total}
          </Button>
        ) : null}

        {ticket.status === 'OPEN' && canManage ? (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Editar
          </Button>
        ) : null}

        {(ticket.status === 'OPEN' || ticket.status === 'WASHING') && canManage ? (
          <Button
            type="button"
            variant="outline"
            loading={ready.isPending}
            onClick={() =>
              ready.mutate(ticket.id, {
                onSuccess: () =>
                  toast(
                    readyUndoToast(reference, () =>
                      reopen.mutate(ticket.id, {
                        onSuccess: () => toast({ title: `Lavado #${reference} reabierto` }),
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

        {ticket.status === 'READY' && canManage ? (
          <Button
            type="button"
            variant="outline"
            loading={reopen.isPending}
            onClick={() =>
              reopen.mutate(ticket.id, {
                onSuccess: () => toast({ title: `Lavado #${reference} reabierto` }),
              })
            }
          >
            Reabrir
          </Button>
        ) : null}

        {(ticket.status === 'OPEN' ||
          ticket.status === 'WASHING' ||
          ticket.status === 'READY') &&
        canVoid ? (
          <Button type="button" variant="destructive" onClick={() => setVoiding(true)}>
            Anular
          </Button>
        ) : null}

        <Button asChild variant="ghost">
          <Link href="/carwash">Volver a la fila</Link>
        </Button>
      </div>

      <ChargeDialog ticket={ticket} open={charging} onOpenChange={onCharging} />
      <VoidTicketDialog ticket={ticket} open={voiding} onOpenChange={setVoiding} />
      {reversing ? (
        <ReverseTicketDialog ticket={ticket} open onOpenChange={setReversing} />
      ) : null}
      {editing ? (
        <EditTicketDialog ticket={ticket} open onOpenChange={setEditing} />
      ) : null}
    </div>
  );
}

function OfficeWashers({ ticket, canManage }: { ticket: Ticket; canManage: boolean }) {
  const employees = useEmployees(canManage);
  const put = useSetTicketWashers(ticket.id);
  const editable =
    canManage &&
    (ticket.status === 'OPEN' || ticket.status === 'WASHING' || ticket.status === 'READY');
  const options = [
    ...(employees.data ?? [])
      .filter((employee) => employee.isActive)
      .map((employee) => ({ id: employee.id, fullName: employee.fullName })),
    ...ticket.washers
      .filter((washer) => !(employees.data ?? []).some((employee) => employee.id === washer.id))
      .map((washer) => ({ id: washer.id, fullName: washer.fullName })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-text-faint text-label">Lavaron</span>
      {editable ? (
        <WashersField
          employees={options}
          value={ticket.washers.map((washer) => washer.id)}
          onChange={(employeeIds) => put.mutate({ employeeIds })}
          allowEmpty
          disabled={put.isPending}
        />
      ) : (
        <span className="text-text text-body">{washerNames(ticket.washers)}</span>
      )}
      {put.error ? (
        <p className="text-danger-text text-body" role="alert">
          {put.error.message}
        </p>
      ) : null}
    </div>
  );
}

/** Un par rótulo/valor de la ficha: el rótulo a la izquierda, el dato a la derecha. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-right text-body">{value}</span>
    </div>
  );
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
};

function methodLabel(method: PaymentMethod): string {
  return METHOD_LABELS[method];
}
