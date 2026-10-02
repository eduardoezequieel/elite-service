'use client';

import type { Ticket } from '@elite/shared';
import { ChevronDown, PackagePlus, Plus, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { cn } from '@/lib/utils';
import { referenceOf } from '../reference';
import { responsibleLabel } from '../responsible';
import { ChangePriceDialog } from './change-price-dialog';
import { linesCountLabel } from '../product-lines';
import { AuthorizedPriceStamp, TicketLines, hasAuthorizedPrice } from './ticket-item-line';

/**
 * La cuenta: los lavados que se van a cobrar juntos (059).
 *
 * Con un solo lavado es una fila abierta y nada más —el caso de todos los días
 * no cambia de forma—; con varios, cada uno se pliega, se puede quitar y la
 * cuenta avisa si mezcla responsables. Avisa, no bloquea (RN-6): el taller
 * cobra flotas y familias, y el sistema no es quién para impedirlo.
 *
 * El precio de una línea **no se edita acá** (060): se muestra como texto y el
 * candado abre el diálogo que pide la firma de un administrador.
 */
export function ChargeAccount({
  tickets,
  onRemove,
  onAdd,
  onAddProducts,
}: {
  tickets: readonly Ticket[];
  /** `undefined` cuando la cuenta tiene un solo lavado: no se queda vacía. */
  onRemove?: (id: string) => void;
  onAdd: () => void;
  /**
   * Abre los productos sueltos en la misma cuenta (066). `undefined` cuando ya
   * están abiertos o la pantalla no los ofrece.
   */
  onAddProducts?: () => void;
}) {
  const [toggled, setToggled] = useState<readonly string[]>([]);
  const [editing, setEditing] = useState<{ ticketId: string; itemId: string } | null>(null);
  const single = tickets.length === 1;
  const responsibles = new Set(tickets.map((ticket) => responsibleLabel(ticket)));
  const editingTicket = tickets.find((ticket) => ticket.id === editing?.ticketId) ?? null;
  const editingItem = editingTicket?.items.find((item) => item.id === editing?.itemId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {tickets.map((ticket) => (
        <AccountRow
          key={ticket.id}
          ticket={ticket}
          // Con un lavado la cuenta es el lavado: se ve entero sin tocar nada.
          open={single ? !toggled.includes(ticket.id) : toggled.includes(ticket.id)}
          onToggle={() =>
            setToggled((current) =>
              current.includes(ticket.id)
                ? current.filter((id) => id !== ticket.id)
                : [...current, ticket.id],
            )
          }
          onRemove={onRemove === undefined ? undefined : () => onRemove(ticket.id)}
          onChangePrice={(itemId) => setEditing({ ticketId: ticket.id, itemId })}
        />
      ))}

      {responsibles.size > 1 ? (
        <p className="text-warn-text text-dense flex items-start gap-2" role="note">
          <TriangleAlert aria-hidden strokeWidth={1.5} className="size-icon mt-px shrink-0" />
          <span>
            Hay lavados de responsables distintos en la misma cuenta. Se puede: el cobro sale a
            nombre de quien paga.
          </span>
        </p>
      ) : null}

      <div className={cn('mt-1 grid gap-2', onAddProducts !== undefined && 'sm:grid-cols-2')}>
        <Button type="button" variant="outline" className="w-full" onClick={onAdd}>
          <Plus aria-hidden strokeWidth={1.5} />
          Sumar otro lavado
        </Button>
        {onAddProducts === undefined ? null : (
          <Button type="button" variant="outline" className="w-full" onClick={onAddProducts}>
            <PackagePlus aria-hidden strokeWidth={1.5} />
            Sumar productos sueltos
          </Button>
        )}
      </div>

      {editingTicket === null || editingItem === null ? null : (
        <ChangePriceDialog
          ticket={editingTicket}
          item={editingItem}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AccountRow({
  ticket,
  open,
  onToggle,
  onRemove,
  onChangePrice,
}: {
  ticket: Ticket;
  open: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onChangePrice: (itemId: string) => void;
}) {
  const reference = referenceOf(ticket.number);

  return (
    <div className="border-line-soft bg-surface-2 rounded-row border">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-(--touch-min) min-w-0 flex-1 items-center gap-3 rounded-row px-3 py-2.5 text-left"
        >
          <PlateChip plate={ticket.vehicle.plate} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-text truncate font-semibold">{responsibleLabel(ticket)}</span>
            <span className="text-text-faint truncate text-dense">
              {`#${reference} · ${ticket.bodyType.name} · ${linesCountLabel(ticket.items)}`}
            </span>
          </span>
          {hasAuthorizedPrice(ticket) ? <AuthorizedPriceStamp /> : null}
          <span className="text-text shrink-0 font-mono font-semibold tabular-nums">
            ${ticket.total}
          </span>
          <ChevronDown
            aria-hidden
            strokeWidth={1.5}
            className={cn(
              'text-text-faint size-icon shrink-0 transition-transform duration-(--duration-state) ease-standard',
              open && 'rotate-180',
            )}
          />
        </button>
        {onRemove === undefined ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="self-center mr-1.5"
            aria-label={`Quitar el lavado #${reference} del cobro`}
            onClick={onRemove}
          >
            <X aria-hidden strokeWidth={1.5} />
          </Button>
        )}
      </div>

      {open ? (
        <div className="border-line-soft flex flex-col gap-2 border-t px-3 py-2.5">
          <TicketLines
            items={ticket.items}
            // Desde `READY` el precio se cierra (060 RN-1): en la caja nunca
            // se teclea, se autoriza. También el unitario de un producto (065).
            onChangePrice={ticket.status === 'READY' ? (item) => onChangePrice(item.id) : undefined}
          />
          <p className="text-text-faint text-dense">
            El precio no se edita en la caja. Cambiarlo pide la autorización de un administrador.
          </p>
        </div>
      ) : null}
    </div>
  );
}
