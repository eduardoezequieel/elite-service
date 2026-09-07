'use client';

import type { Ticket } from '@elite/shared';
import { useState } from 'react';

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
import { readyUndoToast } from '@/features/carwash/ready-undo';
import { referenceOf } from '@/features/carwash/reference';
import { useFloorTicketAction } from '../hooks/use-floor';

export type FloorStatusAction = 'start' | 'ready' | 'reopen';

const COPY: Record<FloorStatusAction, { title: string; confirm: string; done: string }> = {
  start: {
    title: '¿Empezar este lavado?',
    confirm: 'Empezar lavado',
    done: 'en lavado',
  },
  ready: {
    title: '¿Marcar listo este lavado?',
    confirm: 'Marcar listo',
    done: 'marcado listo',
  },
  reopen: {
    title: '¿Reabrir este lavado?',
    confirm: 'Reabrir',
    done: 'reabierto',
  },
};

/**
 * Confirmación antes de mover un lavado en pista (036). El tap del botón no
 * llama al API: abre el diálogo con placa y número.
 */
export function useFloorStatusConfirm(ticket: Ticket) {
  const start = useFloorTicketAction('start');
  const ready = useFloorTicketAction('ready');
  const reopen = useFloorTicketAction('reopen');
  const { toast } = useToast();
  const [pending, setPending] = useState<FloorStatusAction | null>(null);
  const reference = referenceOf(ticket.number);

  const mutationOf = (action: FloorStatusAction) =>
    action === 'start' ? start : action === 'ready' ? ready : reopen;

  const confirm = () => {
    if (pending === null) return;

    const action = pending;
    mutationOf(action).mutate(ticket.id, {
      onSuccess: () => {
        setPending(null);
        if (action === 'ready') {
          toast(
            readyUndoToast(reference, () =>
              reopen.mutate(ticket.id, {
                onSuccess: () => toast({ title: `Lavado #${reference} reabierto` }),
                onError: (error) => toast({ title: error.message, tone: 'error' }),
              }),
            ),
          );
          return;
        }
        toast({ title: `Lavado #${reference} ${COPY[action].done}` });
      },
    });
  };

  const active = pending === null ? null : mutationOf(pending);

  return {
    pending,
    ask: setPending,
    confirm,
    cancel: () => setPending(null),
    loading: active?.isPending ?? false,
    error: active?.error ?? null,
    copy: pending === null ? null : COPY[pending],
    summary: `#${reference} · ${ticket.vehicle.plate} · ${ticket.bodyType.name}`,
  };
}

export function FloorStatusConfirmDialog({
  open,
  title,
  summary,
  confirmLabel,
  loading,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  summary: string;
  confirmLabel: string;
  loading: boolean;
  error: { message: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        {error ? (
          <DialogBody>
            <p className="text-body text-danger-text" role="alert">
              {error.message}
            </p>
          </DialogBody>
        ) : null}
        {/* `flex-col` pisa el reverse del pie: Cancelar arriba, confirmar abajo. */}
        <DialogFooter className="flex-col">
          <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" size="lg" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
