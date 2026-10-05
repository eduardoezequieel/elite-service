'use client';

import { voidTabLineSchema, type TabLine } from '@elite/shared';
import { useState } from 'react';

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useVoidTabLine } from '../hooks/use-tabs';
import { quantityMark } from '../tab-format';

/**
 * «Quitar» una línea (105 RN-5): el producto vuelve al inventario y la línea
 * queda tachada con su motivo. El motivo es obligatorio (3 a 500 letras, el
 * schema de `@elite/shared`); sin él el botón rojo no se habilita.
 *
 * Se monta al abrir, así que cada apertura arranca en blanco.
 */
export function VoidTabLineDialog({
  tabId,
  line,
  onOpenChange,
}: {
  tabId: string;
  line: TabLine;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const voidLine = useVoidTabLine(tabId);
  const [reason, setReason] = useState('');
  const parsed = voidTabLineSchema.safeParse({ reason });
  const mark = quantityMark(line.quantity);

  function submit(): void {
    if (!parsed.success || voidLine.isPending) return;

    voidLine.mutate(
      { lineId: line.id, input: parsed.data },
      {
        onSuccess: () => {
          toast({ title: 'Quitado' });
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md [[data-density=bahia]_&]:md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quitar</DialogTitle>
          <DialogDescription>
            {line.name}
            {mark === null ? null : ` ${mark}`} ·{' '}
            <span className="font-mono tabular-nums">${line.total}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldBox>
            <Label htmlFor="void-tab-line-reason">Motivo</Label>
            <Textarea
              id="void-tab-line-reason"
              rows={3}
              maxLength={500}
              value={reason}
              disabled={voidLine.isPending}
              onChange={(event) => setReason(event.target.value)}
              autoFocus
            />
          </FieldBox>

          {voidLine.error ? (
            <p className="text-danger-text text-body" role="alert">
              {voidLine.error.message}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            disabled={!parsed.success}
            loading={voidLine.isPending}
            onClick={submit}
          >
            Quitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
