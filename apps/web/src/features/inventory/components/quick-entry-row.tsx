'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInventoryEntrySchema, type InventoryItem } from '@elite/shared';
import { ArrowDownToLine, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { formatCents, formatMoney } from '@/lib/money';
import {
  formatQuantity,
  formatQuantityWithUnit,
  milliToQuantity,
  quantityMilli,
} from '@/lib/quantity';
import { averageAfter, quantityOf, unitCostOf } from '../entry-wizard';
import { entryDraft, type EntryFormValues } from '../item-form';
import { useCreateInventoryEntry } from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FormAlert, TextField } from './form-fields';

const ICON = 'size-icon';

const entryFormSchema = z.preprocess(
  (values: EntryFormValues) => entryDraft(values),
  createInventoryEntrySchema,
);

/**
 * La entrada rápida (spec 091): se abre debajo de la fila con el «+» de la
 * existencia. Cantidad (arranca en 1), cuánto te costó cada una y la factura;
 * Enter la suma, Escape la cierra. Es la misma entrada de siempre
 * (`POST /items/:id/entries`), sin buscar el artículo otra vez.
 */
export function QuickEntryRow({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const entry = useCreateInventoryEntry();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<EntryFormValues, unknown, z.output<typeof entryFormSchema>>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: { quantity: '1', unitCost: '', reference: '' },
  });
  const errors = form.formState.errors;
  const quantity = form.watch('quantity');
  const unitCost = form.watch('unitCost');
  const milli = quantityOf(quantity);
  const cents = unitCostOf(unitCost);
  const stock = quantityMilli(item.stockOnHand) ?? 0;

  const step = (delta: number) => {
    const current = quantityMilli(quantity);
    const next = Math.max(0, (current === null || current < 0 ? 0 : current) + delta);
    form.setValue('quantity', formatQuantity(milliToQuantity(next)));
  };

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    entry.mutate(
      { id: item.id, input },
      {
        onSuccess: ({ item: saved, movement }) => {
          toast({
            title: 'Entrada registrada',
            description: `+${formatQuantityWithUnit(movement.quantity, saved.unit)} de ${saved.name} · queda en ${formatQuantity(saved.stockOnHand)}`,
          });
          onClose();
        },
        onError: (error) => {
          setFormError(
            applyInventoryError(
              error,
              form.setError,
              ['quantity', 'unitCost', 'reference'],
              item.unit,
            ),
          );
        },
      },
    );
  });

  return (
    // Un formulario propio dentro de la fila: Enter en cualquier campo lo manda.
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      aria-label={`Entrada de ${item.name}`}
      className="bg-surface flex flex-col gap-3 rounded-control border border-[color-mix(in_oklab,var(--flame)_45%,var(--line))] px-4 py-3.5 text-left"
    >
      <p className="text-text-dim text-body">
        <b className="text-text">Entrada de {item.name}</b> · lo que llegó
      </p>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex basis-60 items-stretch gap-2 max-narrow:basis-full">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-(--control-h) shrink-0"
            onClick={() => step(-1000)}
            aria-label="Uno menos"
          >
            <Minus className={ICON} strokeWidth={1.5} aria-hidden />
          </Button>
          <TextField
            id={`quick-quantity-${item.id}`}
            label={`Cantidad (${item.unit})`}
            inputMode="decimal"
            mono
            autoFocus
            className="min-w-0 flex-1"
            error={errors.quantity?.message}
            {...form.register('quantity')}
          />
          <Button
            type="button"
            variant="outline"
            className="h-auto w-(--control-h) shrink-0"
            onClick={() => step(1000)}
            aria-label="Uno más"
          >
            <Plus className={ICON} strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
        <TextField
          id={`quick-cost-${item.id}`}
          label="Te costó c/u (opcional)"
          inputMode="decimal"
          placeholder="0.00"
          mono
          className="basis-44 max-narrow:basis-full"
          error={errors.unitCost?.message}
          {...form.register('unitCost')}
        />
        <TextField
          id={`quick-reference-${item.id}`}
          label="Referencia (opcional)"
          placeholder="Factura, proveedor"
          className="min-w-52 flex-1 max-narrow:basis-full"
          error={errors.reference?.message}
          {...form.register('reference')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-dim text-dense" aria-live="polite">
          {milli === null ? (
            <>Hay {formatQuantityWithUnit(item.stockOnHand, item.unit)}.</>
          ) : (
            <>
              Pasa de <b className="text-text font-mono">{formatQuantity(item.stockOnHand)}</b> a{' '}
              <b className="text-text font-mono">
                {formatQuantity(milliToQuantity(stock + milli))}
              </b>{' '}
              {item.unit}.
              {typeof cents === 'number' ? (
                <>
                  {' '}
                  Tu costo promedio {formatMoney(item.averageCost)} →{' '}
                  <b className="text-text font-mono">
                    {formatCents(averageAfter(item.stockOnHand, item.averageCost, milli, cents))}
                  </b>
                  .
                </>
              ) : null}
            </>
          )}
        </p>
        <div className="flex gap-2 max-narrow:w-full max-narrow:[&>*]:flex-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={entry.isPending}>
            <ArrowDownToLine className={ICON} strokeWidth={1.5} aria-hidden />
            Sumar entrada
          </Button>
        </div>
      </div>

      <FormAlert message={formError} />
    </form>
  );
}
