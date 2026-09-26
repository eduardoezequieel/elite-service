'use client';

import type { PaymentMethod } from '@elite/shared';
import { ArrowLeftRight, Banknote, Check, CreditCard, Plus, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  balanceOf,
  remainingCents,
  SALE_BUCKET_ID,
  spreadCents,
  type AccountTicket,
  type PaymentLine,
} from '../charge-math';
import { formatMoney, maskMoneyInput, toCents } from '../pricing';

/** Los tres métodos, en el orden en que se usan en el mostrador. */
export const METHODS: {
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
 * Los tres métodos, como grupo de radio.
 *
 * Un solo tabulador entra al grupo y las flechas mueven dentro: la mano del
 * cajero no tiene que pasar por tres paradas para llegar a «Transferencia».
 */
export function MethodPicker({
  value,
  onValueChange,
}: {
  value: PaymentMethod;
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
      {METHODS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Un solo alto en el grupo: con nada elegido entra por el primero.
            tabIndex={selected ? 0 : -1}
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

/**
 * El pago partido (059): un renglón por cada plata que entra, y los renglones
 * tienen que sumar el total.
 *
 * El marcador de abajo dice siempre en qué se está —«Falta $1.50», «Cuadra»,
 * «Se pasó»— y el botón de cobrar no se habilita hasta que cuadre. El API
 * vuelve a validarlo (`PAYMENT_AMOUNT_MISMATCH`), pero el cajero no tiene por
 * qué enterarse por un error.
 */
export function SplitPaymentLines({
  lines,
  totalCents,
  onChange,
  onSingle,
}: {
  lines: readonly PaymentLine[];
  totalCents: number;
  onChange: (lines: PaymentLine[]) => void;
  onSingle: () => void;
}) {
  const left = remainingCents(totalCents, lines);
  const balance = balanceOf(left);
  const used = lines.map((line) => line.method);
  const free = METHODS.find((option) => !used.includes(option.value));

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => (
        <div key={line.id} className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label={`Método del pago ${index + 1}`}
            className="border-line bg-surface-2 flex min-w-0 flex-1 gap-1 rounded-control border p-1"
          >
            {METHODS.map((option) => {
              const selected = line.method === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    onChange(
                      lines.map((other) =>
                        other.id === line.id ? { ...other, method: option.value } : { ...other },
                      ),
                    )
                  }
                  className={cn(
                    'min-h-(--touch-min) flex-1 rounded-sm px-2 text-dense',
                    'transition-colors duration-(--duration-state) ease-standard',
                    selected
                      ? 'bg-flame/15 text-text font-semibold'
                      : 'text-text-dim hover:text-text',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <FieldBox className="w-[140px] shrink-0">
            <Label htmlFor={`payment-amount-${line.id}`}>Monto</Label>
            <Input
              id={`payment-amount-${line.id}`}
              inputMode="decimal"
              autoComplete="off"
              className="font-mono tabular-nums"
              value={line.amount}
              onChange={(event) =>
                onChange(
                  lines.map((other) =>
                    other.id === line.id
                      ? { ...other, amount: maskMoneyInput(event.target.value) }
                      : { ...other },
                  ),
                )
              }
              onBlur={(event) =>
                onChange(
                  lines.map((other) =>
                    other.id === line.id
                      ? { ...other, amount: formatMoney(toCents(event.target.value)) }
                      : { ...other },
                  ),
                )
              }
            />
          </FieldBox>

          {lines.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar el pago ${index + 1}`}
              onClick={() => onChange(lines.filter((other) => other.id !== line.id))}
            >
              <X aria-hidden strokeWidth={1.5} />
            </Button>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={free === undefined || left <= 0}
          onClick={() => {
            if (free === undefined) return;

            onChange([
              ...lines.map((line) => ({ ...line })),
              { id: `line-${Date.now()}`, method: free.value, amount: formatMoney(left) },
            ]);
          }}
        >
          <Plus aria-hidden strokeWidth={1.5} />
          Agregar pago
        </Button>
        <Button type="button" variant="link" size="sm" className="ml-auto" onClick={onSingle}>
          Volver a un solo pago
        </Button>
      </div>

      {/* Falta / Cuadra / Se pasó, siempre con la palabra: el color acompaña,
          nunca dice solo. Verde cuando cuadra, ámbar cuando falta y rojo cuando
          se pasó, que ya no es «todavía no», es un número mal tecleado. */}
      <div
        className={cn(
          'tint flex items-baseline justify-between gap-3 rounded-row border px-3.5 py-2.5',
          balance.kind === 'even'
            ? 'text-go-text'
            : balance.kind === 'short'
              ? 'text-warn-text'
              : 'text-danger-text',
        )}
      >
        <span className="text-label">{balance.label}</span>
        <span className="font-mono font-semibold tabular-nums">${formatMoney(balance.cents)}</span>
      </div>
    </div>
  );
}

/**
 * Con cuánto paga y cuánto se le devuelve (059 RN-10).
 *
 * Solo aparece si algo del cobro es efectivo. Vacío = pagó justo, y el cambio
 * es cero: el campo en blanco no es un cero, es «no me dijo con cuánto paga».
 * **Sin botones de billete**: el cajero teclea la cifra y listo.
 */
export function CashBox({
  cashDue,
  tendered,
  change,
  short,
  onChange,
}: {
  cashDue: number;
  tendered: string;
  change: number;
  short: boolean;
  onChange: (value: string) => void;
}) {
  const showChange = tendered.trim() !== '' && toCents(tendered) > 0;

  return (
    <div className="border-line-soft flex flex-col gap-3 rounded-row border p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <p className="text-text-faint text-label">Efectivo a cobrar</p>
          <p className="text-text text-title mt-1 font-mono tabular-nums">
            ${formatMoney(cashDue)}
          </p>
        </div>
        <FieldBox className="min-w-[160px] flex-1">
          <Label htmlFor="cash-tendered">Con cuánto paga</Label>
          <Input
            id="cash-tendered"
            inputMode="decimal"
            autoComplete="off"
            className="font-mono tabular-nums"
            value={tendered}
            aria-invalid={short}
            onChange={(event) => onChange(maskMoneyInput(event.target.value))}
          />
        </FieldBox>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('text-label', short ? 'text-danger-text' : 'text-text-faint')}>
          {short ? 'Falta efectivo' : 'Cambio'}
        </span>
        <span
          className={cn(
            'text-figure tabular-nums',
            short ? 'text-danger-text' : showChange && change > 0 ? 'text-go-text' : 'text-text',
          )}
        >
          ${formatMoney(showChange ? Math.abs(change) : 0)}
        </span>
      </div>
    </div>
  );
}

/**
 * Cómo se registra el cobro en cada lavado (059 RN-5).
 *
 * Aparece solo con más de un lavado, plegado: es la respuesta a «¿y esto cómo
 * se reparte?», no algo que haya que leer para cobrar. El reparto es el mismo
 * que aplica el API, así que lo que dice acá es lo que va a quedar guardado.
 */
export function SpreadDetails({
  tickets,
  totalCents,
  labelOf,
}: {
  /** Las partes de la cuenta: cada lavado y, si la hay, la venta suelta (066). */
  tickets: readonly AccountTicket[];
  totalCents: number;
  labelOf: (ticketId: string) => string;
}) {
  if (tickets.length <= 1) return null;

  const withSale = tickets.some((ticket) => ticket.id === SALE_BUCKET_ID);

  return (
    <details className="border-line-soft rounded-row border px-3.5 py-2.5">
      <summary className="text-text-dim flex min-h-(--touch-min) cursor-pointer items-center text-body">
        {withSale ? 'Cómo se registra en cada lavado y en la venta' : 'Cómo se registra por lavado'}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {spreadCents(totalCents, tickets).map((share) => (
          <div key={share.ticketId} className="flex items-baseline justify-between gap-3">
            <span className="text-text-dim text-dense">
              {share.ticketId === SALE_BUCKET_ID ? 'Productos sueltos' : labelOf(share.ticketId)}
            </span>
            <span className="text-text font-mono text-dense tabular-nums">
              ${formatMoney(share.cents)}
            </span>
          </div>
        ))}
        <p className="text-text-faint text-dense mt-1">
          {withSale
            ? 'Automático, proporcional al total de cada parte. Cada lavado guarda lo suyo y la venta lo suyo: comisiones y reportes no cambian.'
            : 'Automático, proporcional al total de cada lavado. Cada uno guarda lo suyo: comisiones y reportes no cambian.'}
        </p>
      </div>
    </details>
  );
}
