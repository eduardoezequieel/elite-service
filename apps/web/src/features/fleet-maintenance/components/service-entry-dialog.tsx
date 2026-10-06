'use client';

import { createMaintenanceLogSchema } from '@elite/shared';
import type { MaintenancePlanTask } from '@elite/shared';
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
import { FieldBox } from '@/components/ui/field-box';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FieldError, FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { moneyOrNull, wholeOrNull } from '@/features/rentals/form-draft';
import { todayCivil } from '@/lib/civil-date';
import { usePlanTasks, useRecordMaintenanceService } from '../hooks/use-fleet-maintenance';

/**
 * Anotar lo que se hizo (110): qué, km, fecha y costo. La nota va plegada.
 * «Otro» es un texto que no está en el plan.
 */
export function ServiceEntryDialog({
  vehicleId,
  odometerKm,
  onClose,
}: {
  vehicleId: string;
  odometerKm: number;
  onClose: () => void;
}) {
  const plan = usePlanTasks();
  const record = useRecordMaintenanceService();
  const { toast } = useToast();
  const tasks = (plan.data ?? []).filter((task) => task.isActive);
  const [what, setWhat] = useState('');
  const [other, setOther] = useState('');
  const [km, setKm] = useState(String(odometerKm));
  const [date, setDate] = useState(todayCivil());
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  function save(event: FormEvent) {
    event.preventDefault();
    setLocal(null);

    const kmValue = wholeOrNull(km);
    if (typeof kmValue === 'string') {
      setLocal('Tiene que ser un número entero.');
      return;
    }

    const parsed = createMaintenanceLogSchema.safeParse({
      vehicleId,
      taskIds: what === '' || what === 'other' ? [] : [what],
      other: what === 'other' ? other : undefined,
      performedAt: date,
      odometerKm: kmValue,
      cost: moneyOrNull(cost),
      notes: note.trim() === '' ? null : note,
    });

    if (!parsed.success) {
      setLocal(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }

    record.mutate(parsed.data, {
      onSuccess: () => {
        toast({ title: 'Servicio anotado' });
        onClose();
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anotar lo que se hizo</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={save}>
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldBox>
                <Label htmlFor="service-what">Qué se hizo</Label>
                <select
                  id="service-what"
                  className="text-body w-full bg-transparent"
                  value={what}
                  onChange={(event) => setWhat(event.target.value)}
                >
                  <option value="">Elegí</option>
                  {tasks.map((task: MaintenancePlanTask) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                  <option value="other">Otro</option>
                </select>
              </FieldBox>
            </div>
            {what === 'other' ? (
              <TextField
                id="service-other"
                label="Qué fue"
                value={other}
                onChange={(event) => setOther(event.target.value)}
              />
            ) : null}
            <TextField
              id="service-km"
              label="Km"
              inputMode="numeric"
              mono
              value={km}
              onChange={(event) => setKm(event.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-label text-text-dim">Fecha</span>
              <DateField value={date} onChange={setDate} aria-label="Fecha" />
            </div>
            <TextField
              id="service-cost"
              label="Costo"
              inputMode="decimal"
              mono
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
            <details>
              <summary className="text-body min-h-(--touch-min) cursor-pointer font-semibold">
                Nota
              </summary>
              <Textarea
                aria-label="Nota"
                value={note}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
              />
            </details>
            <FieldError message={local ?? undefined} />
            <FormAlert message={record.error?.message ?? null} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={record.isPending}>
              Anotar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
