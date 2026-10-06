'use client';

import { createFleetExpenseSchema, updateFleetExpenseSchema } from '@elite/shared';
import type { FleetExpenseRow } from '@elite/shared';
import { useState, type FormEvent } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { moneyOrNull, textOrNull } from '@/features/rentals/form-draft';
import { todayCivil } from '@/lib/civil-date';
import { useCreateFleetExpense, useUpdateFleetExpense } from '../hooks/use-fleet-maintenance';

/** Anotar o corregir un gasto (110): monto, qué y fecha. La categoría no se toca. */
export function ExpenseEntryDialog({
  vehicleId,
  expense,
  onClose,
}: {
  vehicleId: string;
  expense?: FleetExpenseRow;
  onClose: () => void;
}) {
  const create = useCreateFleetExpense();
  const update = useUpdateFleetExpense();
  const { toast } = useToast();
  const editing = expense !== undefined;
  const [amount, setAmount] = useState(expense?.amount ?? '');
  const [what, setWhat] = useState(expense?.description ?? '');
  const [date, setDate] = useState(expense?.incurredAt ?? todayCivil());
  const [local, setLocal] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const failure = editing ? update.error : create.error;

  function save(event: FormEvent) {
    event.preventDefault();
    setLocal(null);

    const body = {
      amount: moneyOrNull(amount) ?? '',
      incurredAt: date,
      description: textOrNull(what),
    };

    if (editing && expense !== undefined) {
      const parsed = updateFleetExpenseSchema.safeParse(body);

      if (!parsed.success) {
        setLocal(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
        return;
      }

      update.mutate(
        { id: expense.id, input: parsed.data },
        {
          onSuccess: () => {
            toast({ title: 'Gasto corregido' });
            onClose();
          },
        },
      );
      return;
    }

    const parsed = createFleetExpenseSchema.safeParse({ vehicleId, ...body });

    if (!parsed.success) {
      setLocal(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }

    create.mutate(parsed.data, {
      onSuccess: () => {
        toast({ title: 'Gasto anotado' });
        onClose();
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Corregir gasto' : 'Anotar gasto'}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={save}>
          <DialogBody className="flex flex-col gap-3">
            <TextField
              id="expense-amount"
              label="Monto"
              inputMode="decimal"
              mono
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <TextField
              id="expense-what"
              label="Qué"
              value={what}
              onChange={(event) => setWhat(event.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-label text-text-dim">Fecha</span>
              <DateField value={date} onChange={setDate} aria-label="Fecha" />
            </div>
            <FieldError message={local ?? undefined} />
            <FormAlert message={failure?.message ?? null} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? 'Corregir' : 'Anotar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
