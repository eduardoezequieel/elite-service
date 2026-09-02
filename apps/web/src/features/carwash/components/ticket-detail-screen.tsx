'use client';

import { PERMISSIONS } from '@elite/shared';
import type { PaymentMethod, Ticket } from '@elite/shared';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useTicket, useTicketAction } from '../hooks/use-tickets';
import { ChargeDialog } from './charge-dialog';
import { TicketStatusStamp } from './ticket-status-stamp';

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
    return <p className="text-muted-foreground text-body">Cargando…</p>;
  }

  if (ticket.error !== null || ticket.data === undefined) {
    return (
      <p className="text-stamp-red text-body" role="alert">
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
  charging,
  onCharging,
}: {
  ticket: Ticket;
  canManage: boolean;
  canCharge: boolean;
  canVoid: boolean;
  charging: boolean;
  onCharging: (open: boolean) => void;
}) {
  const ready = useTicketAction('ready');
  const reopen = useTicketAction('reopen');
  const voidTicket = useTicketAction('void');
  const sequence = ticket.number.slice(ticket.number.indexOf('-') + 1);
  const failed = ready.error ?? reopen.error ?? voidTicket.error;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display">#{Number(sequence)}</h1>
          <p className="text-muted-foreground text-dense font-mono">{ticket.number}</p>
        </div>
        <TicketStatusStamp status={ticket.status} />
      </header>

      {ticket.status === 'VOID' ? (
        <p className="text-muted-foreground text-body">
          <span className="is-ruled-out">Este lavado</span> fue anulado.
        </p>
      ) : null}

      <Card className="flex flex-col gap-3 p-plate">
        <Field label="Cliente" value={ticket.customer.fullName} />
        <Field label="Teléfono" value={ticket.customer.phone ?? '—'} />
        <Field label="Placa" value={ticket.vehicle.plate} mono />
        <Field label="Tipo de carro" value={ticket.bodyType.name} />
        <Field
          label="Marca y color"
          value={[ticket.vehicle.make, ticket.vehicle.color].filter(Boolean).join(' · ') || '—'}
        />
        {/* Sin lavador, lo abrió el mostrador (RN-8). */}
        <Field label="Lavador" value={ticket.washer?.fullName ?? 'Oficina'} />
        {ticket.notes === null ? null : <Field label="Nota" value={ticket.notes} />}
      </Card>

      <Card className="flex flex-col gap-2 p-plate">
        <p className="text-label text-muted-foreground">Servicios</p>
        {ticket.items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-body">{item.serviceName}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              {/* El precio de catálogo solo aparece cuando hubo descuento: si
                  siempre estuviera, sería ruido en el 90% de las filas (RN-5). */}
              {item.unitPrice === item.catalogPrice ? null : (
                <span className="text-muted-foreground text-dense is-ruled-out">
                  ${item.catalogPrice}
                </span>
              )}
              <span className="text-body">${item.unitPrice}</span>
            </span>
          </div>
        ))}
        <div className="border-rule mt-1 flex items-baseline justify-between border-t pt-2">
          <span className="text-label text-muted-foreground">Total</span>
          <span className="text-figure tabular-nums">${ticket.total}</span>
        </div>
      </Card>

      {ticket.payment === null ? null : (
        <Card className="flex flex-col gap-3 p-plate">
          <p className="text-label text-muted-foreground">Cobro</p>
          <Field label="Método" value={methodLabel(ticket.payment.method)} />
          <Field label="Monto" value={`$${ticket.payment.amount}`} />
        </Card>
      )}

      {failed ? (
        <p className="text-stamp-red text-body" role="alert">
          {failed.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ticket.status === 'READY' && canCharge ? (
          <Button type="button" onClick={() => onCharging(true)}>
            Cobrar ${ticket.total}
          </Button>
        ) : null}

        {ticket.status === 'OPEN' && canManage ? (
          <Button type="button" variant="secondary" onClick={() => ready.mutate(ticket.id)}>
            Marcar listo
          </Button>
        ) : null}

        {ticket.status === 'READY' && canManage ? (
          <Button type="button" variant="secondary" onClick={() => reopen.mutate(ticket.id)}>
            Reabrir
          </Button>
        ) : null}

        {(ticket.status === 'OPEN' || ticket.status === 'READY') && canVoid ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => voidTicket.mutate(ticket.id)}
          >
            Anular
          </Button>
        ) : null}

        <Button asChild variant="ghost">
          <Link href="/carwash">Volver a la fila</Link>
        </Button>
      </div>

      <ChargeDialog ticket={ticket} open={charging} onOpenChange={onCharging} />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-label text-muted-foreground">{label}</span>
      <span className={cn('text-body', mono === true && 'font-mono')}>{value}</span>
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
