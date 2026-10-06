'use client';

import { createFleetExpenseSchema } from '@elite/shared';
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
import { useCreateFleetExpense } from '../hooks/use-fleet-maintenance';

/** Anotar un gasto (110): monto, qué y fecha. La categoría la deduce el API. */
export function ExpenseEntryDialog({
  vehicleId,
  onClose,
}: {
  vehicleId: string;
  onClose: () => void;
}) {
  const create = useCreateFleetExpense();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(todayCivil());
  const [local, setLocal] = useState<string | null>(null);

  function save(event: FormEvent) {
    event.preventDefault();
    setLocal(null);

    const parsed = createFleetExpenseSchema.safeParse({
      vehicleId,
      amount: moneyOrNull(amount) ?? '',
      incurredAt: date,
      description: textOrNull(what),
    });

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
          <DialogTitle>Anotar gasto</DialogTitle>
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
            <FormAlert message={create.error?.message ?? null} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              Anotar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
