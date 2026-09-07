'use client';

import type { Ticket } from '@elite/shared';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/toast-provider';
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
import { cn } from '@/lib/utils';
import { useSetTicketStatus } from '../hooks/use-tickets';
import { referenceOf } from '../reference';
import {
  isOperationalStatus,
  OPERATIONAL_STATUSES,
  statusChangeWarning,
  type OperationalStatus,
} from '../status-change';
import { statusLabel, TicketStatusStamp } from './ticket-status-stamp';

/**
 * Oficina elige En espera / Lavando / Listo. El actual no se toca; el aviso
 * cambia con el destino (037).
 */
export function ChangeTicketStatusDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setStatus = useSetTicketStatus(ticket.id);
  const { toast } = useToast();
  const [next, setNext] = useState<OperationalStatus | null>(null);
  const reference = referenceOf(ticket.number);
  const reset = setStatus.reset;

  useEffect(() => {
    if (open) {
      reset();
      setNext(null);
    }
  }, [open, reset]);

  if (!isOperationalStatus(ticket.status)) return null;

  const current = ticket.status;
  const warning = next === null ? null : statusChangeWarning(current, next);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar estado del lavado #{reference}</DialogTitle>
          <DialogDescription>
            Está {statusLabel(ticket.status)}. Elegí el nuevo estado.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <StatusPicker current={current} value={next} onChange={setNext} />
          {warning ? <p className="text-text-dim text-body">{warning}</p> : null}
          {setStatus.error ? (
            <p className="text-body text-danger-text" role="alert">
              {setStatus.error.message}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={next === null}
            loading={setStatus.isPending}
            onClick={() => {
              if (next === null) return;

              setStatus.mutate(
                { status: next },
                {
                  onSuccess: (updated) => {
                    toast({ title: `Lavado #${reference} · ${statusLabel(updated.status)}` });
                    onOpenChange(false);
                  },
                },
              );
            }}
          >
            {next === null ? 'Cambiar estado' : `Cambiar a ${statusLabel(next)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusPicker({
  current,
  value,
  onChange,
}: {
  current: OperationalStatus;
  value: OperationalStatus | null;
  onChange: (status: OperationalStatus) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const selectable = OPERATIONAL_STATUSES.filter((status) => status !== current);
  const roving = value ?? selectable[0];

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="Nuevo estado"
      className="grid gap-2"
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;

        if (step === 0 || selectable.length === 0 || roving === undefined) return;

        event.preventDefault();

        const index = selectable.indexOf(roving);
        const next = selectable[(index + step + selectable.length) % selectable.length];

        if (next === undefined) return;

        onChange(next);
        requestAnimationFrame(() => {
          group.current
            ?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')
            [selectable.indexOf(next)]?.focus();
        });
      }}
    >
      {OPERATIONAL_STATUSES.map((status) => {
        const isCurrent = status === current;
        const selected = status === value;

        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={isCurrent}
            disabled={isCurrent}
            tabIndex={isCurrent ? -1 : status === roving ? 0 : -1}
            onClick={() => onChange(status)}
            className={cn(
              'flex min-h-(--touch-min) w-full items-center justify-between gap-3 rounded-control border px-4 py-3 text-left',
              'transition-colors duration-(--duration-state) ease-standard',
              isCurrent && 'cursor-not-allowed opacity-60',
              selected
                ? 'border-flame bg-flame/10'
                : 'border-line bg-surface-2',
              !isCurrent && !selected && 'hover:border-flame',
            )}
          >
            <TicketStatusStamp status={status} />
            {isCurrent ? <span className="text-text-faint text-dense">Actual</span> : null}
          </button>
        );
      })}
    </div>
  );
}
