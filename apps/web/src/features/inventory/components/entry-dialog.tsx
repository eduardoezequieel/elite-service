'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInventoryEntrySchema } from '@elite/shared';
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
import { formatQuantityWithUnit } from '../format';
import { entryDraft, type EntryFormValues } from '../item-form';
import { useCreateInventoryEntry, useInventoryItem } from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FormAlert, TextField } from './form-fields';
import { ItemField, StockLine } from './item-field';

const entryFormSchema = z.preprocess(
  (values: EntryFormValues) => entryDraft(values),
  createInventoryEntrySchema,
);

/**
 * Registrar entrada (RN-11): cantidad, costo por unidad opcional y referencia
 * libre. Si trae costo, el API recalcula el costo promedio.
 */
export function EntryDialog({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const [pickedId, setPickedId] = useState<string | null>(itemId);
  const item = useInventoryItem(pickedId ?? '', pickedId !== null);
  const entry = useCreateInventoryEntry();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<EntryFormValues, unknown, z.output<typeof entryFormSchema>>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: { quantity: '', unitCost: '', reference: '' },
  });
  const errors = form.formState.errors;
  const current = item.data;

  const submit = form.handleSubmit((input) => {
    if (pickedId === null) {
      setFormError('Elegí el artículo que entra.');
      return;
    }
    setFormError(null);
    entry.mutate(
      { id: pickedId, input },
      {
        onSuccess: ({ item: saved, movement }) => {
          toast({
            title: 'Entrada registrada',
            description: `+${formatQuantityWithUnit(movement.quantity, saved.unit)} de ${saved.name}`,
          });
          onClose();
        },
        onError: (error) => {
          setFormError(
            applyInventoryError(error, form.setError, ['quantity', 'unitCost', 'reference']),
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
            <DialogTitle>Registrar entrada</DialogTitle>
            <DialogDescription>
              Lo que llegó al taller. Con el costo, el costo promedio se recalcula solo.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <ItemField
                item={current}
                fixed={itemId !== null}
                onPick={(id) => {
                  setPickedId(id);
                  setFormError(null);
                }}
                invalid={formError !== null && pickedId === null}
              />
              <StockLine item={current} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="entry-quantity"
                label={current ? `Cantidad (${current.unit})` : 'Cantidad'}
                inputMode="decimal"
                mono
                error={errors.quantity?.message}
                {...form.register('quantity')}
              />
              <TextField
                id="entry-cost"
                label="Costo por unidad (opcional)"
                inputMode="decimal"
                placeholder="0.00"
                mono
                error={errors.unitCost?.message}
                {...form.register('unitCost')}
              />
            </div>

            <TextField
              id="entry-reference"
              label="Referencia (opcional)"
              placeholder="Factura, proveedor"
              error={errors.reference?.message}
              {...form.register('reference')}
            />

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={entry.isPending}>
              Registrar entrada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
