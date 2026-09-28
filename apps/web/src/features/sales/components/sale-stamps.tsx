'use client';

import type { ChargePayment, CounterSaleStatus, PaymentMethod } from '@elite/shared';
import { Ban, Banknote } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { FloatingTip } from '@/components/ui/help-tip';
import { Stamp, STAMP_TONE_TEXT } from '@/components/ui/stamp';
import { METHOD_LABELS, METHOD_STAMP } from '@/features/carwash/cash-format';
import {
  METHOD_ICONS,
  PaymentMethodStamp,
} from '@/features/carwash/components/payment-method-stamp';
import { cn } from '@/lib/utils';
import { paymentMethodsOf } from '../sale-format';

/**
 * El estado de una venta suelta: nace pagada y solo puede anularse (RN-18,
 * RN-22). Mismos tonos e iconos que el cobro de un lavado, para que «pagada» y
 * «anulada» se lean igual en todo el sistema.
 */
export function SaleStatusStamp({ status }: { status: CounterSaleStatus }) {
  return status === 'VOID' ? (
    <Stamp tone="void" label="Anulada" icon={<Ban />} />
  ) : (
    <Stamp tone="paid" label="Pagada" icon={<Banknote />} />
  );
}

/**
 * Con qué se pagó: un sello por método, como en el lavado (059). Una venta
 * anulada no tiene pagos —salieron del turno— y no dibuja nada.
 */
export function SalePaymentsStamp({
  payments,
}: {
  payments: readonly { method: PaymentMethod }[];
}) {
  const methods = paymentMethodsOf(payments);

  if (methods.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {methods.map((method) => (
        <PaymentMethodStamp key={method} method={method} />
      ))}
    </span>
  );
}

/**
 * Con qué se pagó, en la tabla de ventas: un icono de color por método, sin
 * palabra, para que la columna no compita con el sello de Estado.
 *
 * La palabra no se pierde (DESIGN.md → el estado nunca solo con color): el
 * globo dice cada método con su monto y se abre como `HelpTip`, al pasar el
 * mouse, con el foco del teclado o con un toque —en la bahía no hay puntero—.
 * El lector de pantalla recibe los métodos en el `aria-label`.
 */
export function SalePaymentsIcons({
  payments,
}: {
  payments: readonly Pick<ChargePayment, 'id' | 'method' | 'amount'>[];
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;
  const methods = paymentMethodsOf(payments);

  useEffect(() => setAnchor(buttonRef.current), []);

  useEffect(() => {
    if (!open) return;

    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setFocused(false);
      setHovered(false);
    };
    const outside = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      setPinned(false);
    };

    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  if (methods.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Método: ${methods.map((method) => METHOD_LABELS[method]).join(', ')}`}
        aria-describedby={open ? tipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={(event) => {
          // La fila abre la venta: tocar los iconos solo muestra el globo.
          event.stopPropagation();
          setPinned((current) => !current);
        }}
        className="min-h-touch inline-flex cursor-help items-center gap-1.5 rounded-sm"
      >
        {methods.map((method) => {
          const Icon = METHOD_ICONS[method];

          return (
            <span
              key={method}
              aria-hidden
              className={cn(
                'tint grid size-[calc(var(--icon-size)+12px)] shrink-0 place-items-center rounded-full border',
                STAMP_TONE_TEXT[METHOD_STAMP[method].tone],
              )}
            >
              <Icon className="size-icon" strokeWidth={1.5} />
            </span>
          );
        })}
      </button>
      <FloatingTip anchor={anchor} open={open} id={tipId}>
        <span className="flex flex-col gap-1">
          {payments.map((payment) => (
            <span key={payment.id} className="flex items-center justify-between gap-4">
              <span>{METHOD_LABELS[payment.method]}</span>
              <span className="font-mono tabular-nums">${payment.amount}</span>
            </span>
          ))}
        </span>
      </FloatingTip>
    </>
  );
}
