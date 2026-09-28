'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInventoryAdjustmentSchema, type InventoryItem } from '@elite/shared';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { formatQuantity, formatQuantityWithUnit, milliToQuantity } from '../format';
import {
  adjustmentDraft,
  stockAfter,
  type AdjustmentFormValues,
  type AdjustmentSign,
} from '../item-form';
import { useCreateInventoryAdjustment } from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FormAlert, TextAreaField, TextField } from './form-fields';
import { StockLine } from './item-field';

const adjustmentFormSchema = z.preprocess(
  (values: AdjustmentFormValues) => adjustmentDraft(values),
  createInventoryAdjustmentSchema,
);

const SIGNS: readonly { value: AdjustmentSign; label: string }[] = [
  { value: 'add', label: 'Sumar' },
  { value: 'remove', label: 'Restar' },
];

/**
 * Ajustar tras un conteo físico (RN-12): cantidad con signo y motivo
 * obligatorio. Pide `inventory.adjust`, aparte de `inventory.move`, porque
 * corregir la existencia es más delicado que registrar una entrada.
 */
export function AdjustDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const adjust = useCreateInventoryAdjustment();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<AdjustmentFormValues, unknown, z.output<typeof adjustmentFormSchema>>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: { sign: 'remove', quantity: '', reason: '' },
  });
  const errors = form.formState.errors;
  const sign = form.watch('sign');
  const quantity = form.watch('quantity').trim();
  const delta = sign === 'remove' ? `-${quantity}` : quantity;
  const after = quantity === '' ? null : stockAfter(item.stockOnHand, delta);
  const negative = after !== null && after < 0;

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    adjust.mutate(
      { id: item.id, input },
      {
        onSuccess: ({ item: saved }) => {
          toast({
            title: 'Existencia ajustada',
            description: `${saved.name} queda en ${formatQuantityWithUnit(saved.stockOnHand, saved.unit)}`,
          });
          onClose();
        },
        onError: (error) => {
          setFormError(
            applyInventoryError(error, form.setError, ['quantity', 'reason'], item.unit),
          );
        },
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Ajustar existencia</DialogTitle>
            <DialogDescription>
              {item.name} · después de contar lo que hay de verdad.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <StockLine item={item} />

            <div
              role="radiogroup"
              aria-label="Sentido del ajuste"
              className="grid grid-cols-2 gap-2"
            >
              {SIGNS.map((option) => {
                const selected = sign === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => form.setValue('sign', option.value)}
                    className={cn(
                      'border-line bg-surface-2 text-text inline-flex min-h-(--touch-min) items-center justify-center rounded-control border px-4 text-body font-semibold transition-colors duration-(--duration-state) ease-standard',
                      '[[data-density=bahia]_&]:min-h-[max(var(--touch-min),var(--control-h))]',
                      selected ? 'border-flame font-bold' : 'text-text-dim hover:border-flame',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <TextField
              id="adjust-quantity"
              label={`Cantidad a ${sign === 'remove' ? 'restar' : 'sumar'} (${item.unit})`}
              inputMode="decimal"
              mono
              error={errors.quantity?.message}
              {...form.register('quantity')}
            />

            {after === null ? null : negative ? (
              <p className="text-danger-text text-dense" role="status">
                No alcanza: hay {formatQuantity(item.stockOnHand)} {item.unit}. La existencia nunca
                queda bajo cero.
              </p>
            ) : (
              <p className="text-text-dim text-dense" role="status">
                Queda en{' '}
                <span className="text-text font-mono font-semibold">
                  {formatQuantityWithUnit(milliToQuantity(after), item.unit)}
                </span>
                .
              </p>
            )}

            <TextAreaField
              id="adjust-reason"
              label="Motivo"
              placeholder="Conteo físico del viernes: faltaban 2"
              error={errors.reason?.message}
              {...form.register('reason')}
            />

            <div className="text-warn-text flex items-start gap-2.5 text-dense">
              <TriangleAlert className="size-icon mt-0.5 shrink-0" strokeWidth={1.5} aria-hidden />
              <p>
                El ajuste corrige la existencia sin entrada ni despacho detrás. Queda en el
                historial con tu nombre y el motivo, y no se borra: si te equivocás, se corrige con
                otro.
              </p>
            </div>

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={adjust.isPending} disabled={negative}>
              Ajustar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
