'use client';

import type { PaymentMethod, Ticket } from '@elite/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useChargeTicket } from '../hooks/use-tickets';

/** Los tres métodos, en el orden en que se usan en el mostrador. */
const METHODS: { value: PaymentMethod; label: string; verb: string }[] = [
  { value: 'CASH', label: 'Efectivo', verb: 'Cobrar en efectivo' },
  { value: 'CARD', label: 'Tarjeta', verb: 'Cobrar con tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia', verb: 'Cobrar por transferencia' },
];

/**
 * El cobro (RN-10).
 *
 * **No hay campo de monto.** El monto es el total, siempre: un solo pago, exacto,
 * sin saldo ni vuelto que el sistema deba calcular. Un campo editable acá solo
 * podría producir un error —el backend rechaza cualquier cifra distinta— y le
 * pediría al cajero que teclee un número que ya está en pantalla.
 *
 * Elegir método cambia el verbo del botón primario: lo último que se lee antes
 * de una acción que no se deshace dice exactamente qué va a pasar.
 */
export function ChargeDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const charge = useChargeTicket(ticket.id);
  const chosen = METHODS.find((option) => option.value === method);

  function close(next: boolean): void {
    if (!next) {
      setMethod(null);
      charge.reset();
    }

    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar el lavado</DialogTitle>
          <DialogDescription>
            Un solo pago, por el total exacto. Después de cobrar, el lavado ya no se edita.
          </DialogDescription>
        </DialogHeader>

        <p className="text-figure tabular-nums">${ticket.total}</p>

        <div className="flex flex-col gap-2">
          <p className="text-label text-muted-foreground">Método de pago</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {METHODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMethod(option.value)}
                aria-pressed={method === option.value}
                className={cn(
                  'min-h-(--touch-min) border-rule rounded-md border px-3 text-body',
                  'transition-colors duration-(--duration-state) ease-standard',
                  method === option.value
                    ? 'border-brand text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {charge.error ? (
          <p className="text-body text-stamp-red" role="alert">
            {charge.error.message}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={chosen === undefined || charge.isPending}
            onClick={() => {
              if (chosen === undefined) return;

              charge.mutate(
                { method: chosen.value, amount: ticket.total },
                { onSuccess: () => close(false) },
              );
            }}
          >
            {chosen?.verb ?? 'Elegí un método'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
