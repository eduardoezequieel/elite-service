'use client';

import type { PaymentMethod, Ticket } from '@elite/shared';
import { ArrowLeftRight, Banknote, Check, CreditCard } from 'lucide-react';
import * as React from 'react';

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
import { useChargeTicket } from '../hooks/use-tickets';

/** Los tres métodos, en el orden en que se usan en el mostrador. */
const METHODS: {
  value: PaymentMethod;
  label: string;
  verb: string;
  icon: typeof Banknote;
}[] = [
  { value: 'CASH', label: 'Efectivo', verb: 'Cobrar en efectivo', icon: Banknote },
  { value: 'CARD', label: 'Tarjeta', verb: 'Cobrar con tarjeta', icon: CreditCard },
  {
    value: 'TRANSFER',
    label: 'Transferencia',
    verb: 'Cobrar por transferencia',
    icon: ArrowLeftRight,
  },
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
 *
 * Los tres métodos son un grupo de radio de verdad (`role=radiogroup`, flechas,
 * `aria-checked`): elegir el método es elegir uno entre tres, no pulsar tres
 * interruptores independientes.
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
  const [method, setMethod] = React.useState<PaymentMethod | null>(null);
  const charge = useChargeTicket(ticket.id);
  const { toast } = useToast();
  const chosen = METHODS.find((option) => option.value === method);
  const sequence = Number(ticket.number.slice(ticket.number.indexOf('-') + 1));

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

        <DialogBody className="space-y-4">
          <p className="text-figure text-text tabular-nums">${ticket.total}</p>

          <div className="flex flex-col gap-2">
            <p className="text-text-faint text-label">Método de pago</p>
            <MethodPicker value={method} onValueChange={setMethod} />
          </div>

          {charge.error ? (
            <p className="text-danger-text text-body" role="alert">
              {charge.error.message}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={chosen === undefined}
            loading={charge.isPending}
            onClick={() => {
              if (chosen === undefined) return;

              charge.mutate(
                { method: chosen.value, amount: ticket.total },
                {
                  onSuccess: () => {
                    toast({
                      title: `Lavado #${sequence} cobrado`,
                      description: `$${ticket.total}`,
                    });
                    close(false);
                  },
                },
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

/**
 * Los tres métodos, como grupo de radio.
 *
 * Un solo tabulador entra al grupo y las flechas mueven dentro: la mano del
 * cajero no tiene que pasar por tres paradas para llegar a «Transferencia».
 */
function MethodPicker({
  value,
  onValueChange,
}: {
  value: PaymentMethod | null;
  onValueChange: (value: PaymentMethod) => void;
}) {
  const refs = React.useRef(new Map<PaymentMethod, HTMLButtonElement>());

  const move = (from: number, step: number) => {
    const next = METHODS[(from + step + METHODS.length) % METHODS.length];
    if (next === undefined) return;

    onValueChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = METHODS.findIndex((option) => option.value === value);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index < 0 ? -1 : index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index < 0 ? METHODS.length : index, -1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Método de pago"
      onKeyDown={onKeyDown}
      className="grid gap-2 sm:grid-cols-3"
    >
      {METHODS.map((option, index) => {
        const Icon = option.icon;
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Un solo alto en el grupo: con nada elegido entra por el primero.
            tabIndex={selected || (value === null && index === 0) ? 0 : -1}
            ref={(node) => {
              if (node === null) refs.current.delete(option.value);
              else refs.current.set(option.value, node);
            }}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative flex min-h-(--touch-min) cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border p-3 text-center text-body select-none',
              'transition-colors duration-(--duration-state) ease-standard active:translate-y-px',
              selected
                ? 'border-flame bg-flame/10 text-text font-semibold'
                : 'border-line bg-surface-2 text-text-dim hover:border-flame hover:text-text',
            )}
          >
            {selected ? (
              <Check
                aria-hidden
                strokeWidth={2}
                className="text-flame absolute top-1.5 right-1.5 size-3.5"
              />
            ) : null}
            <Icon
              className={cn('size-5', selected ? 'text-flame' : 'text-text-faint')}
              strokeWidth={1.5}
              aria-hidden
            />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
