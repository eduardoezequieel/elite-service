'use client';

import type { Ticket } from '@elite/shared';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlateChip } from '@/components/ui/plate-chip';
import { cn } from '@/lib/utils';
import { useTickets } from '../hooks/use-tickets';
import { referenceOf } from '../reference';
import { responsibleLabel } from '../responsible';
import { itemLabel } from '../product-lines';
import { GaugeLoader } from '@/components/ui/gauge-loader';

/**
 * Sumar lavados a la cuenta (059).
 *
 * Solo lo que se puede cobrar: listos y sin cobrar. La lista es la misma que ya
 * consume la fila de lavados —la consulta por estado `READY`—, así que un
 * lavado que se cobró en otra caja mientras esto estaba abierto desaparece solo
 * en cuanto el hilo en vivo invalida.
 *
 * Es un grupo de casillas, no una lista de radio: se suman varios de un viaje.
 */
export function ChargeTicketPicker({
  open,
  onOpenChange,
  excludedIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Los que ya están en la cuenta: no se ofrecen otra vez. */
  excludedIds: readonly string[];
  onAdd: (ids: string[]) => void;
}) {
  const ready = useTickets({ status: 'READY' }, open);
  const [draft, setDraft] = useState<string[]>([]);

  useEffect(() => {
    if (open) setDraft([]);
  }, [open]);

  const available = (ready.data ?? []).filter(
    (ticket) => !excludedIds.includes(ticket.id) && ticket.payments.length === 0,
  );

  function toggle(id: string): void {
    setDraft((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sumar al cobro</DialogTitle>
          <DialogDescription>
            Lavados listos y sin cobrar. Se cobran todos juntos en una sola cuenta.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2">
          {ready.isPending ? (
            <GaugeLoader label="Cargando lavados listos" size="sm" />
          ) : ready.error !== null ? (
            <p className="text-danger-text text-body" role="alert">
              {ready.error.message}
            </p>
          ) : available.length === 0 ? (
            <p className="text-text-faint text-body">No hay más lavados listos para cobrar.</p>
          ) : (
            available.map((ticket) => (
              <PickRow
                key={ticket.id}
                ticket={ticket}
                checked={draft.includes(ticket.id)}
                onToggle={() => toggle(ticket.id)}
              />
            ))
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={draft.length === 0}
            onClick={() => {
              onAdd(draft);
              onOpenChange(false);
            }}
          >
            {draft.length <= 1 ? 'Sumar al cobro' : `Sumar ${draft.length} lavados`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickRow({
  ticket,
  checked,
  onToggle,
}: {
  ticket: Ticket;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex min-h-(--touch-min) w-full items-center gap-3 rounded-row border p-3 text-left',
        'transition-colors duration-(--duration-state) ease-standard active:translate-y-px',
        checked
          ? 'border-flame bg-flame/10 text-text'
          : 'border-line bg-surface-2 text-text-dim hover:border-flame',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-flame text-flame' : 'border-line text-transparent',
        )}
      >
        <Check strokeWidth={2.5} className="size-3.5" />
      </span>
      <PlateChip plate={ticket.vehicle.plate} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-text truncate font-semibold">{responsibleLabel(ticket)}</span>
        <span className="text-text-faint truncate text-dense">
          {[`#${referenceOf(ticket.number)}`, ticket.items.map(itemLabel).join(' · ')]
            .filter((part) => part !== '')
            .join(' · ')}
        </span>
      </span>
      <span className="text-text shrink-0 font-mono font-semibold tabular-nums">
        ${ticket.total}
      </span>
    </button>
  );
}
