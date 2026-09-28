'use client';

import type { InventoryItem } from '@elite/shared';
import { ArrowUpFromLine, CupSoda } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

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
import { useToast } from '@/components/toast-provider';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/money';
import { formatQuantityWithUnit } from '@/lib/quantity';
import {
  deliveryDraft,
  deliverySummary,
  isShort,
  lineMilli,
  stepLine,
  typeLine,
  type DeliveryLine,
} from '../delivery';
import { inventoryErrorView } from '../errors';
import { useCreateInventoryDelivery, useDispatchEmployees } from '../hooks/use-inventory';
import { DeliveryPicker } from './delivery-picker';
import { EmployeeSearchField } from './employee-search-field';
import {
  FieldError,
  FormAlert,
  TextAreaField,
  detailsItemId,
  keepLocalEscape,
} from './form-fields';

const ICON = 'size-icon';

/**
 * «Entregar a empleado» (spec 091): a quién, qué y cuánto, varios artículos de
 * una vez. No se elige si es consumo o despacho: un producto queda como
 * consumo, a precio de venta y sin cobrar (070), y un insumo como despacho
 * (065 RN-10). Todo va en una sola petición (RN-2).
 *
 * Desde la ficha de un artículo arranca con él elegido; desde el consumo de un
 * trabajador, con el trabajador fijo y solo productos («Anotar consumo»).
 */
export function DeliveryDialog({
  item,
  employeeId: fixedEmployeeId,
  onClose,
}: {
  item?: InventoryItem;
  /** El trabajador fijo: «Anotar consumo» desde su detalle. Solo productos. */
  employeeId?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const employees = useDispatchEmployees();
  const delivery = useCreateInventoryDelivery();
  const onlyProducts = fixedEmployeeId !== undefined;

  const [employeeId, setEmployeeId] = useState<string | null>(fixedEmployeeId ?? null);
  const [lines, setLines] = useState<DeliveryLine[]>(
    item ? [{ itemId: item.id, quantity: '1' }] : [],
  );
  const [known, setKnown] = useState<Record<string, InventoryItem>>(
    item ? { [item.id]: item } : {},
  );
  const [note, setNote] = useState('');
  const [employeeError, setEmployeeError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const itemOf = (id: string) => known[id];
  const summary = deliverySummary(lines, itemOf);
  const anyShort = lines.some((line) => {
    const candidate = known[line.itemId];
    return candidate !== undefined && isShort(candidate, line);
  });
  const count = lines.filter((line) => lineMilli(line) > 0).length;
  const employeeName = employees.data?.find((employee) => employee.id === employeeId)?.fullName;

  function remember(candidate: InventoryItem): void {
    setKnown((previous) =>
      previous[candidate.id] === candidate ? previous : { ...previous, [candidate.id]: candidate },
    );
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (employeeId === null) {
      setEmployeeError('Elegí a quién se le entrega.');
      return;
    }
    if (count === 0) {
      setFormError('Elegí qué se lleva y cuánto.');
      return;
    }
    setFormError(null);

    delivery.mutate(deliveryDraft(employeeId, note, lines), {
      onSuccess: ({ results }) => {
        const first = results[0];
        const who = first?.movement.employee?.fullName ?? employeeName ?? '';
        toast({
          title: onlyProducts ? 'Consumo anotado' : 'Entregado',
          description:
            results.length === 1 && first !== undefined
              ? `${formatQuantityWithUnit(first.movement.quantity.replace(/^-/, ''), first.item.unit)} de ${first.item.name} a ${who}`
              : `${results.length} artículos a ${who}`,
        });
        onClose();
      },
      onError: (apiError) => {
        const itemId = detailsItemId(apiError.details);
        const candidate = itemId === null ? undefined : known[itemId];
        const view = inventoryErrorView(apiError, candidate?.unit);
        if (view.field === 'employeeId') setEmployeeError(view.message);
        setFormError(candidate ? `${candidate.name}: ${view.message}` : view.message);
      },
    });
  }

  const title = onlyProducts ? 'Anotar consumo' : 'Entregar a empleado';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-2xl" onEscapeKeyDown={keepLocalEscape}>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              A quién, qué y cuánto. Queda quién lo entregó y cuándo.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <EmployeeSearchField
                label={onlyProducts ? 'Lo tomó' : '¿A quién?'}
                employees={employees.data ?? []}
                isPending={employees.isPending}
                errorMessage={employees.error?.message ?? null}
                value={employeeId}
                onChange={(next) => {
                  setEmployeeId(next);
                  setEmployeeError(undefined);
                  setFormError(null);
                }}
                fixed={onlyProducts}
                invalid={employeeError !== undefined}
              />
              <FieldError message={employeeError} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-text-faint text-label">
                {onlyProducts ? '¿Qué tomó?' : '¿Qué se lleva?'}
              </p>
              <DeliveryPicker
                kind={onlyProducts ? 'PRODUCT' : undefined}
                lines={lines}
                known={known}
                disabled={delivery.isPending}
                onStep={(candidate, delta) => {
                  remember(candidate);
                  setLines((previous) => stepLine(previous, candidate.id, delta));
                  setFormError(null);
                }}
                onType={(candidate, quantity) => {
                  remember(candidate);
                  setLines((previous) => typeLine(previous, candidate.id, quantity));
                }}
              />
            </div>

            <TextAreaField
              id="delivery-note"
              label="Nota (opcional)"
              placeholder="Para qué o para dónde"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            {summary.consumption.count > 0 || summary.dispatch.count > 0 ? (
              <div className="flex flex-col gap-2.5" aria-live="polite">
                {summary.consumption.count > 0 ? (
                  <SummaryBox icon="consumption">
                    <b className="text-text">Consumo{employeeName ? ` de ${employeeName}` : ''}:</b>{' '}
                    {summary.consumption.count}{' '}
                    {summary.consumption.count === 1 ? 'producto' : 'productos'} ·{' '}
                    <b className="text-text font-mono">{formatCents(summary.consumption.cents)}</b>{' '}
                    a precio de venta. No se cobra; queda en «Consumos del personal».
                  </SummaryBox>
                ) : null}
                {summary.dispatch.count > 0 ? (
                  <SummaryBox icon="dispatch">
                    <b className="text-text">Despacho{employeeName ? ` a ${employeeName}` : ''}:</b>{' '}
                    {summary.dispatch.count} {summary.dispatch.count === 1 ? 'insumo' : 'insumos'}{' '}
                    de trabajo. No tienen precio ni cuentan como consumo.
                  </SummaryBox>
                ) : null}
              </div>
            ) : null}

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={delivery.isPending} disabled={anyShort}>
              {onlyProducts ? 'Anotar consumo' : 'Entregar'}
              {count > 1 ? ` · ${count}` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBox({ icon, children }: { icon: 'consumption' | 'dispatch'; children: ReactNode }) {
  const Icon = icon === 'consumption' ? CupSoda : ArrowUpFromLine;

  return (
    <div className="border-line-soft bg-surface-2 flex items-start gap-3 rounded-control border px-4 py-3">
      <Icon
        className={cn(
          ICON,
          'mt-0.5 shrink-0',
          icon === 'consumption' ? 'text-consume-text' : 'text-warn-text',
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="text-text-dim text-body">{children}</p>
    </div>
  );
}
