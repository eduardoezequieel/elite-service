'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { closeCashSchema } from '@elite/shared';
import type { CashSession, CloseCashInput } from '@elite/shared';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

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
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { centsOf, formatMoney } from '../cash-format';
import { useCloseCash } from '../hooks/use-cash';
import { differenceLiveLabel, differenceToneClass } from './cash-difference-stamp';

type CloseCashFormValues = z.input<typeof closeCashSchema>;

export function CloseCashDialog({
  session,
  open,
  onOpenChange,
}: {
  session: CashSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const closeCash = useCloseCash();
  const { toast } = useToast();
  const expected = session.expectedCash ?? '0.00';
  const expectedCents = centsOf(expected) ?? 0;

  const form = useForm<CloseCashFormValues, unknown, CloseCashInput>({
    resolver: zodResolver(closeCashSchema),
    defaultValues: { countedCash: '', notes: '' },
  });

  const counted = String(form.watch('countedCash') ?? '');
  const countedCents = counted.trim() === '' ? null : centsOf(counted);
  const liveCents = countedCents === null ? null : countedCents - expectedCents;

  function close(next: boolean): void {
    if (!next) {
      form.reset({ countedCash: '', notes: '' });
      closeCash.reset();
    }

    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={form.handleSubmit((values) => {
            closeCash.mutate(values, {
              onSuccess: (closed) => {
                toast({
                  title: 'Caja cerrada',
                  description:
                    closed.differenceCash === '0.00'
                      ? 'El efectivo cuadra.'
                      : `Diferencia ${formatMoney(closed.differenceCash ?? '0.00')}`,
                });
                close(false);
              },
            });
          })}
        >
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDescription>
              Contá solo el efectivo. Tarjeta y transferencia ya quedaron informadas.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div>
              <p className="text-text-faint text-label">Esperado</p>
              <p className="text-figure text-text tabular-nums">{formatMoney(expected)}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldBox className="min-h-(--touch-min)">
                <Label htmlFor="counted-cash">Contado</Label>
                <Input
                  id="counted-cash"
                  inputMode="decimal"
                  autoComplete="off"
                  className="font-mono"
                  aria-invalid={form.formState.errors.countedCash ? true : undefined}
                  {...form.register('countedCash')}
                />
              </FieldBox>
              {form.formState.errors.countedCash ? (
                <p className="text-danger-text text-label" role="alert">
                  {form.formState.errors.countedCash.message}
                </p>
              ) : null}
            </div>

            {liveCents === null ? null : (
              <p className={`text-body font-semibold ${differenceToneClass(liveCents)}`}>
                {differenceLiveLabel(liveCents)}
              </p>
            )}

            <FieldBox>
              <Label htmlFor="close-notes">Notas</Label>
              <Textarea id="close-notes" rows={2} {...form.register('notes')} />
            </FieldBox>

            {closeCash.error ? (
              <p className="text-danger-text text-body" role="alert">
                {closeCash.error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={closeCash.isPending}>
              Cerrar caja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
