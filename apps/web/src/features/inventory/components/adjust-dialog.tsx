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
import { formatQuantity, formatQuantityWithUnit, milliToQuantity } from '@/lib/quantity';
import { countAdjustmentDraft, countDifference, type CountFormValues } from '../item-form';
import { useCreateInventoryAdjustment } from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FormAlert, TextAreaField, TextField } from './form-fields';

/**
 * «Ajustar por conteo» (091, sobre RN-12 de la 065): se escribe cuántos hay de
 * verdad y el diálogo calcula si faltan o sobran. Lo que va al API sigue siendo
 * la diferencia con signo y el motivo obligatorio. Pide `inventory.adjust`,
 * aparte de `inventory.move`, porque corregir la existencia es más delicado
 * que registrar una entrada.
 */
export function AdjustDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const adjust = useCreateInventoryAdjustment();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.preprocess(
    (values: CountFormValues) => countAdjustmentDraft(item.stockOnHand, values),
    createInventoryAdjustmentSchema,
  );
  const form = useForm<CountFormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { counted: '', reason: '' },
  });
  const errors = form.formState.errors;
  const difference = countDifference(item.stockOnHand, form.watch('counted'));

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
          setFormError(applyInventoryError(error, form.setError, ['reason'], item.unit));
        },
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Ajustar por conteo</DialogTitle>
            <DialogDescription>
              {item.name} · después de contar lo que hay de verdad.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <p className="text-text-dim text-body">
              El sistema dice que hay{' '}
              <span className="text-text font-mono font-semibold">
                {formatQuantityWithUnit(item.stockOnHand, item.unit)}
              </span>
              .
            </p>

            <TextField
              id="adjust-counted"
              label={`¿Cuántos contaste? (${item.unit})`}
              inputMode="decimal"
              mono
              autoFocus
              {...form.register('counted')}
            />

            <p className="text-text-dim text-dense" role="status">
              {difference === null ? (
                'Escribí lo que contaste y te digo cuánto se corrige.'
              ) : difference === 0 ? (
                <span className="text-go-text font-semibold">Cuadra: no hay nada que ajustar.</span>
              ) : (
                <>
                  {difference < 0 ? 'Faltan' : 'Sobran'}{' '}
                  <span className="text-text font-mono font-semibold">
                    {formatQuantity(milliToQuantity(Math.abs(difference)))}
                  </span>{' '}
                  · se {difference < 0 ? 'restan del' : 'suman al'} sistema y queda en{' '}
                  <span className="text-text font-mono font-semibold">
                    {formatQuantityWithUnit(form.watch('counted'), item.unit)}
                  </span>
                  .
                </>
              )}
            </p>

            <TextAreaField
              id="adjust-reason"
              label="Motivo"
              placeholder="Conteo físico del viernes"
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
            <Button
              type="submit"
              loading={adjust.isPending}
              disabled={difference === null || difference === 0}
            >
              Ajustar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
