'use client';

import type { ServiceDetail, Ticket } from '@elite/shared';
import { useMemo, useState } from 'react';

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
import { useToast } from '@/components/toast-provider';
import { cn } from '@/lib/utils';
import { BodyTypePicker } from './body-type-card';
import { referenceOf } from '../reference';
import { useBodyTypes, useServices, useUpdateTicket } from '../hooks/use-tickets';

/**
 * Edición de un lavado abierto: tipo de carro, servicios y nota. El API solo
 * acepta `OPEN`; placa y cliente no se tocan acá.
 */
export function EditTicketDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const bodyTypes = useBodyTypes(open);
  const catalog = useServices(open);
  const update = useUpdateTicket(ticket.id);
  const { toast } = useToast();
  const reference = referenceOf(ticket.number);

  const [bodyTypeId, setBodyTypeId] = useState(ticket.bodyType.id);
  const [selected, setSelected] = useState<string[]>(() =>
    ticket.items.flatMap((item) => (item.serviceId === null ? [] : [item.serviceId])),
  );
  const [notes, setNotes] = useState(ticket.notes ?? '');

  const services = useMemo(
    () => (catalog.data ?? []).filter((service) => service.isActive),
    [catalog.data],
  );

  const priceOf = (service: ServiceDetail): string =>
    service.prices.find((price) => price.bodyTypeId === bodyTypeId)?.price ?? service.defaultPrice;

  const activeSelected = selected.filter((id) => services.some((service) => service.id === id));
  const complete = bodyTypeId !== '' && activeSelected.length > 0;

  function close(next: boolean): void {
    if (!next) {
      update.reset();
      setBodyTypeId(ticket.bodyType.id);
      setSelected(
        ticket.items.flatMap((item) => (item.serviceId === null ? [] : [item.serviceId])),
      );
      setNotes(ticket.notes ?? '');
    }

    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete) return;

            update.mutate(
              {
                bodyTypeId,
                items: activeSelected.map((serviceId) => ({ serviceId })),
                notes: notes.trim(),
              },
              {
                onSuccess: () => {
                  toast({ title: `Lavado #${reference} actualizado` });
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Editar el lavado #{reference}</DialogTitle>
            <DialogDescription>
              Tipo de carro, servicios y nota. El precio lo toma el catálogo.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <fieldset className="min-w-0">
              <legend className="text-text-faint text-label">Tipo de carro</legend>
              <div className="mt-2">
                <BodyTypePicker
                  bodyTypes={bodyTypes.data ?? []}
                  services={services}
                  value={bodyTypeId}
                  onChange={setBodyTypeId}
                />
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="text-text-faint text-label">Servicios</legend>
              <div className="mt-2 grid gap-2.5">
                {services.map((service) => (
                  <ServiceChoice
                    key={service.id}
                    label={service.name}
                    code={service.code}
                    price={`$${priceOf(service)}`}
                    selected={selected.includes(service.id)}
                    onSelect={() =>
                      setSelected((current) =>
                        current.includes(service.id)
                          ? current.filter((id) => id !== service.id)
                          : [...current, service.id],
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>

            <FieldBox>
              <Label htmlFor="edit-ticket-notes">Nota</Label>
              <Textarea
                id="edit-ticket-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                autoComplete="off"
              />
            </FieldBox>

            {update.error ? (
              <p className="text-danger-text text-body" role="alert">
                {update.error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete} loading={update.isPending}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceChoice({
  label,
  code,
  price,
  selected,
  onSelect,
}: {
  label: string;
  code: string;
  price: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'min-h-touch flex w-full cursor-pointer items-center gap-3.5 rounded-row border-[1.5px] px-4 py-3 text-left',
        'text-body transition-colors duration-(--duration-state) ease-standard',
        selected
          ? 'border-flame bg-[color-mix(in_oklab,var(--flame)_9%,transparent)]'
          : 'border-line bg-surface-2 hover:border-text-faint',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-full border-2',
          selected ? 'border-flame' : 'border-line',
        )}
      >
        {selected ? <span className="bg-flame size-[9px] rounded-full" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-text block font-semibold">{label}</span>
        <span className="text-text-faint block font-mono text-label font-normal">{code}</span>
      </span>
      <span className="text-text ml-auto font-mono text-body font-bold tabular-nums">{price}</span>
    </button>
  );
}
