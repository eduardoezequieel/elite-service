'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInventoryConsumptionSchema } from '@elite/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { consumptionValueLine } from '../consumption';
import { formatQuantity, formatQuantityWithUnit } from '../format';
import { consumptionDraft, stockAfter, type ConsumptionFormValues } from '../item-form';
import {
  useCreateInventoryConsumption,
  useDispatchEmployees,
  useInventoryItem,
} from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FieldError, FormAlert, TextAreaField, TextField } from './form-fields';
import { ItemField, StockLine } from './item-field';

const consumptionFormSchema = z.preprocess(
  (values: ConsumptionFormValues) => consumptionDraft(values),
  createInventoryConsumptionSchema,
);

/**
 * «Consumo de empleado» (spec 070): un trabajador tomó un producto —una bebida
 * de la refrigeradora—. Sale del inventario y queda a su nombre, a precio de
 * venta, pero no se cobra ni pasa por caja (RN-4). Lo anota la oficina con
 * `inventory.move`; queda también quién lo anotó (RN-3).
 *
 * Solo productos activos (RN-2): un insumo se sigue entregando con «Despachar».
 * Desde la ficha de un producto el artículo viene fijo.
 */
export function ConsumptionDialog({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const employees = useDispatchEmployees();
  const [pickedId, setPickedId] = useState<string | null>(itemId);
  const item = useInventoryItem(pickedId ?? '', pickedId !== null);
  const consume = useCreateInventoryConsumption();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ConsumptionFormValues, unknown, z.output<typeof consumptionFormSchema>>({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: { quantity: '', employeeId: '', note: '' },
  });
  const errors = form.formState.errors;
  const current = item.data;
  const quantity = form.watch('quantity').trim();
  const after = current ? stockAfter(current.stockOnHand, `-${quantity}`) : null;
  const shortOfStock = after !== null && after < 0;
  const valueLine = current ? consumptionValueLine(quantity, current.price) : null;

  const options = (employees.data ?? []).map((employee) => ({
    value: employee.id,
    label: employee.fullName,
  }));

  const submit = form.handleSubmit((input) => {
    if (pickedId === null) {
      setFormError('Elegí el producto que tomó.');
      return;
    }
    setFormError(null);
    consume.mutate(
      { id: pickedId, input },
      {
        onSuccess: ({ item: saved, movement }) => {
          const taker = movement.employee?.fullName;
          toast({
            title: 'Consumo anotado',
            description: `${formatQuantityWithUnit(movement.quantity.replace(/^-/, ''), saved.unit)} de ${saved.name}${taker ? ` a ${taker}` : ''}`,
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
            <DialogTitle>Consumo de empleado</DialogTitle>
            <DialogDescription>
              Anotá lo que un trabajador tomó. Sale del inventario y queda a su nombre.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <ItemField
                kind="PRODUCT"
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

            <TextField
              id="consumption-quantity"
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

            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <Combobox
                    label="Lo tomó"
                    placeholder="Elegí un empleado"
                    options={options}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    onBlur={field.onBlur}
                    invalid={errors.employeeId !== undefined}
                    emptyText={
                      employees.isPending
                        ? 'Cargando…'
                        : employees.error
                          ? employees.error.message
                          : 'No hay empleados activos'
                    }
                  />
                )}
              />
              <FieldError message={errors.employeeId?.message} />
            </div>

            <TextAreaField
              id="consumption-note"
              label="Nota (opcional)"
              placeholder="Algo que convenga recordar"
              error={errors.note?.message}
              {...form.register('note')}
            />

            {/* El valor a precio de venta, y que no se cobra: lo que la oficina
                tiene que saber antes de anotar. */}
            <div className="border-line-soft bg-surface-2 flex flex-col gap-1 rounded-control border px-4 py-3">
              <p className="text-text font-mono text-body font-semibold tabular-nums">
                {valueLine ?? '—'}
              </p>
              <p className="text-text-dim text-dense">No se cobra; queda anotado a su nombre.</p>
            </div>

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={consume.isPending} disabled={shortOfStock}>
              Anotar consumo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
