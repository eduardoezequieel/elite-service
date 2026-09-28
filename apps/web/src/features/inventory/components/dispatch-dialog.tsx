'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInventoryDispatchSchema } from '@elite/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { formatQuantity, formatQuantityWithUnit } from '@/lib/quantity';
import { dispatchDraft, stockAfter, type DispatchFormValues } from '../item-form';
import {
  useCreateInventoryDispatch,
  useDispatchEmployees,
  useInventoryItem,
} from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { EmployeeRadioGrid } from './employee-radio-grid';
import { FieldError, FormAlert, TextAreaField, TextField } from './form-fields';
import { ItemPicker } from './item-picker';

const dispatchFormSchema = z.preprocess(
  (values: DispatchFormValues) => dispatchDraft(values),
  createInventoryDispatchSchema,
);

/**
 * Despachar a un empleado (RN-10): la oficina entrega, queda quién despachó y
 * quién recibió. Solo **insumos** (072): un producto que toma un trabajador es
 * un consumo (070), y el API lo rechaza con `ITEM_NOT_DISPATCHABLE`. Un insumo
 * sin existencia aparece en la lista pero no se puede elegir.
 */
export function DispatchDialog({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  // Los empleados salen de `/inventory/employees`, con el mismo `inventory.move`
  // que abre este diálogo: despachar no pide además ver empleados.
  const employees = useDispatchEmployees();
  const [pickedId, setPickedId] = useState<string | null>(itemId);
  const item = useInventoryItem(pickedId ?? '', pickedId !== null);
  const dispatch = useCreateInventoryDispatch();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<DispatchFormValues, unknown, z.output<typeof dispatchFormSchema>>({
    resolver: zodResolver(dispatchFormSchema),
    defaultValues: { quantity: '', employeeId: '', note: '' },
  });
  const errors = form.formState.errors;
  const current = item.data;
  const quantity = form.watch('quantity');
  const after = current ? stockAfter(current.stockOnHand, `-${quantity.trim()}`) : null;
  const shortOfStock = after !== null && after < 0;

  const submit = form.handleSubmit((input) => {
    if (pickedId === null) {
      setFormError('Elegí el insumo que se despacha.');
      return;
    }
    setFormError(null);
    dispatch.mutate(
      { id: pickedId, input },
      {
        onSuccess: ({ item: saved, movement }) => {
          const receiver = movement.employee?.fullName;
          toast({
            title: 'Despachado',
            description: `${formatQuantityWithUnit(movement.quantity.replace(/^-/, ''), saved.unit)} de ${saved.name}${receiver ? ` a ${receiver}` : ''}`,
          });
          onClose();
        },
        onError: (error) => {
          setFormError(
            applyInventoryError(
              error,
              form.setError,
              ['quantity', 'employeeId', 'note'],
              current?.unit,
            ),
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
            <DialogTitle>Despachar</DialogTitle>
            <DialogDescription>
              Entregá un insumo a un empleado. Queda quién lo entregó, quién lo recibió y cuándo.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <ItemPicker
              kind="SUPPLY"
              requireStock
              value={pickedId}
              item={current}
              fixed={itemId !== null}
              onPick={(id) => {
                setPickedId(id);
                setFormError(null);
              }}
              invalid={formError !== null && pickedId === null}
            />

            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <EmployeeRadioGrid
                    label="Recibe"
                    employees={employees.data ?? []}
                    isPending={employees.isPending}
                    error={employees.error}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    onBlur={field.onBlur}
                    invalid={errors.employeeId !== undefined}
                  />
                )}
              />
              <FieldError message={errors.employeeId?.message} />
            </div>

            <TextField
              id="dispatch-quantity"
              label={current ? `Cantidad (${current.unit})` : 'Cantidad'}
              inputMode="decimal"
              mono
              error={errors.quantity?.message}
              {...form.register('quantity')}
            />
            {shortOfStock && current ? (
              <p className="text-warn-text text-dense" role="status">
                No alcanza: hay {formatQuantity(current.stockOnHand)} {current.unit}.
              </p>
            ) : null}

            <TextAreaField
              id="dispatch-note"
              label="Nota (opcional)"
              placeholder="Para qué o para dónde"
              error={errors.note?.message}
              {...form.register('note')}
            />

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={dispatch.isPending} disabled={shortOfStock}>
              Despachar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
