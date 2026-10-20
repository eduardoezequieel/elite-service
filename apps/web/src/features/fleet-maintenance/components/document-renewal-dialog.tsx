'use client';

import { VEHICLE_DOCUMENT_LABELS } from '@elite/shared';
import type { VehicleDocumentKind } from '@elite/shared';
import { useState, type FormEvent } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { useUpdateFleetVehicle } from '@/features/fleet/hooks/use-fleet';
import { todayCivil } from '@/lib/civil-date';
import {
  renewalExpenseInput,
  renewalVehicleInput,
  suggestedExpiry,
  validateRenewal,
  type RenewalErrors,
  type RenewalValues,
} from '../document-renewal';
import { useCreateFleetExpense } from '../hooks/use-fleet-maintenance';

/**
 * «Ya se renovó» (122): el seguro o la tarjeta de circulación. Guarda la fecha
 * nueva en el carro y, si hay costo, después anota el gasto. Si el gasto falla,
 * la fecha ya quedó: el reintento solo anota el gasto.
 */
export function DocumentRenewalDialog({
  vehicleId,
  kind,
  expiresAt,
  onClose,
}: {
  vehicleId: string;
  kind: VehicleDocumentKind;
  expiresAt: string | null;
  onClose: () => void;
}) {
  const today = todayCivil();
  const update = useUpdateFleetVehicle();
  const expense = useCreateFleetExpense();
  const { toast } = useToast();
  const [values, setValues] = useState<RenewalValues>({
    cost: '',
    paidAt: today,
    expiresAt: suggestedExpiry(expiresAt, today),
  });
  const [errors, setErrors] = useState<RenewalErrors>({});
  const [dateSaved, setDateSaved] = useState(false);
  const label = VEHICLE_DOCUMENT_LABELS[kind];

  const set = (field: keyof RenewalValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  function done() {
    toast({ title: 'Renovación anotada' });
    onClose();
  }

  function saveExpense() {
    const input = renewalExpenseInput(kind, vehicleId, values);

    if (input === null) {
      done();
      return;
    }

    expense.mutate(input, { onSuccess: done });
  }

  function save(event: FormEvent) {
    event.preventDefault();

    const found = validateRenewal(values, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (dateSaved) {
      saveExpense();
      return;
    }

    update.mutate(
      { id: vehicleId, input: renewalVehicleInput(kind, values.expiresAt) },
      {
        onSuccess: () => {
          setDateSaved(true);
          saveExpense();
        },
      },
    );
  }

  const failure =
    expense.error !== null
      ? `La fecha sí quedó guardada, pero el gasto no: ${expense.error.message}`
      : (update.error?.message ?? null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}: ya se renovó</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={save}>
          <DialogBody className="flex flex-col gap-3">
            <TextField
              id="renewal-cost"
              label="Costo"
              inputMode="decimal"
              mono
              value={values.cost}
              error={errors.cost}
              onChange={(event) => set('cost')(event.target.value)}
            />
            <DatePickerField
              id="renewal-paid"
              label="Cuándo se pagó"
              value={values.paidAt}
              error={errors.paidAt}
              onChange={set('paidAt')}
            />
            <DatePickerField
              id="renewal-until"
              label="Ahora vence el"
              value={values.expiresAt}
              error={errors.expiresAt}
              onChange={set('expiresAt')}
            />
            <FormAlert message={failure} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {dateSaved ? 'Cerrar' : 'Cancelar'}
            </Button>
            <Button type="submit" loading={update.isPending || expense.isPending}>
              {dateSaved ? 'Anotar el gasto' : 'Ya se renovó'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
