'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  reverseInventoryConsumptionSchema,
  type EmployeeConsumptionEntry,
  type ReverseInventoryConsumptionInput,
} from '@elite/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

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
import { formatMoney } from '@/lib/money';
import { timeLabel } from '@/lib/civil-date';
import { formatQuantityWithUnit } from '@/lib/quantity';
import { formatMovementDate } from '../format';
import { useReverseInventoryConsumption } from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FormAlert, TextAreaField } from './form-fields';

/**
 * Anular un consumo mal anotado (070 RN-6): se anula entero y una sola vez, con
 * motivo obligatorio. No se borra: el kardex agrega la devolución y el
 * consumo deja de contar en su mes.
 *
 * Recibe la entrada ya releída de la consulta en cada render (convención 15):
 * si otro la anula mientras esto está abierto, la pantalla lo cierra.
 */
export function ReverseConsumptionDialog({
  entry,
  employeeName,
  onClose,
}: {
  entry: EmployeeConsumptionEntry;
  employeeName: string;
  onClose: () => void;
}) {
  const reverse = useReverseInventoryConsumption();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ReverseInventoryConsumptionInput>({
    resolver: zodResolver(reverseInventoryConsumptionSchema),
    defaultValues: { reason: '' },
  });

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    reverse.mutate(
      { movementId: entry.movementId, input },
      {
        onSuccess: () => {
          toast({
            title: 'Consumo anulado',
            description: `${formatQuantityWithUnit(entry.quantity, entry.item.unit)} de ${entry.item.name} ya no cuenta para ${employeeName}`,
          });
          onClose();
        },
        onError: (error) => {
          setFormError(applyInventoryError(error, form.setError, ['reason']));
        },
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Anular consumo</DialogTitle>
            <DialogDescription>
              {formatQuantityWithUnit(entry.quantity, entry.item.unit)} de {entry.item.name} ·{' '}
              {formatMoney(entry.total)}, anotado a {employeeName} el{' '}
              {formatMovementDate(entry.createdAt)} a las {timeLabel(entry.createdAt)}. Vuelve al
              inventario y deja de contar en su mes.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <TextAreaField
              id="reverse-consumption-reason"
              label="Motivo"
              placeholder="Por qué se anula: se anotó a otro, no lo tomó…"
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructiveSolid" loading={reverse.isPending}>
              Anular
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
