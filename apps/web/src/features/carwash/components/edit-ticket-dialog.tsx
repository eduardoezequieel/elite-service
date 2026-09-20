'use client';

import type { Ticket } from '@elite/shared';
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
import { BodyTypePicker } from './body-type-card';
import { ServicePicker } from './service-picker';
import { clampToCatalog } from '../pricing';
import { clampToBodyType, selectedLines, type ServiceSelection } from '../service-groups';
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
  const [notes, setNotes] = useState(ticket.notes ?? '');
  /** Lo que el ticket ya tiene: un servicio por rubro con su precio cobrado. */
  const [selection, setSelection] = useState<ServiceSelection>(() => selectionOf(ticket));

  const services = useMemo(
    () => (catalog.data ?? []).filter((service) => service.isActive),
    [catalog.data],
  );

  /** Las líneas a guardar, en el orden de los rubros y sin las desactivadas. */
  const lines = useMemo(
    () => selectedLines(services, selection, bodyTypeId),
    [services, selection, bodyTypeId],
  );
  const complete = bodyTypeId !== '' && lines.length > 0;

  function changeBodyType(nextId: string): void {
    if (nextId === bodyTypeId) return;

    setBodyTypeId(nextId);
    setSelection((current) => clampToBodyType(current, services, nextId, clampToCatalog));
  }

  function close(next: boolean): void {
    if (!next) {
      update.reset();
      setBodyTypeId(ticket.bodyType.id);
      setNotes(ticket.notes ?? '');
      setSelection(selectionOf(ticket));
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
                items: lines.map((line) => ({
                  serviceId: line.id,
                  unitPrice: line.price,
                })),
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
                  onChange={changeBodyType}
                />
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="text-text-faint text-label">Servicios</legend>
              <p className="text-text-faint text-dense mt-1">
                Uno por rubro; los rubros se suman. Tocá un rubro para abrirlo.
              </p>
              <div className="mt-2">
                <ServicePicker
                  services={services}
                  bodyTypeId={bodyTypeId}
                  value={selection}
                  onChange={setSelection}
                  idPrefix={`edit-${ticket.id}`}
                />
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

/**
 * Lo que ya tiene el ticket, leído como selección: un servicio por rubro con el
 * precio que se le dejó. Una línea sin `serviceId` es un servicio borrado del
 * catálogo y no se puede volver a elegir, así que no entra.
 */
function selectionOf(ticket: Ticket): ServiceSelection {
  const items = ticket.items.filter((item) => item.serviceId !== null);

  return {
    selected: items.map((item) => item.serviceId as string),
    prices: Object.fromEntries(items.map((item) => [item.serviceId as string, item.unitPrice])),
  };
}
