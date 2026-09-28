'use client';

import { updateTicketSchema } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/toast-provider';
import { BodyTypePicker } from './body-type-card';
import { ProductPicker } from './product-picker';
import { ServicePicker } from './service-picker';
import { listProductOptions } from '../api';
import { clampToCatalog } from '../pricing';
import {
  activeShortage,
  originalQuantities,
  productItemsPayload,
  productsFromTicket,
  stockShortageOf,
  type ProductPick,
} from '../product-lines';
import { clampToBodyType, selectedLines, type ServiceSelection } from '../service-groups';
import { referenceOf } from '../reference';
import { useBodyTypes, useServices, useUpdateTicket } from '../hooks/use-tickets';

/**
 * Los campos de la edición, con las reglas de `updateTicketSchema` de
 * `@elite/shared`. Servicios y productos se eligen tocando y viajan tal cual.
 */
const editTicketSchema = z.object({
  bodyTypeId: updateTicketSchema.shape.bodyTypeId.unwrap(),
  notes: updateTicketSchema.shape.notes.unwrap(),
  /** Un servicio por rubro con su precio cobrado. */
  selection: z.custom<ServiceSelection>(),
  products: z.custom<ProductPick[]>(),
});

type EditTicketInput = z.input<typeof editTicketSchema>;
type EditTicketOutput = z.output<typeof editTicketSchema>;

/**
 * Edición de un lavado abierto: tipo de carro, servicios, productos y nota. El
 * API solo acepta `OPEN`; placa y cliente no se tocan acá.
 *
 * `PATCH items` reemplaza las líneas, así que los productos viajan siempre con
 * los servicios: el API calcula la diferencia por artículo y saca o repone lo
 * que cambió (065 RN-4). Un producto que no viaje vuelve al inventario.
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

  const form = useForm<EditTicketInput, unknown, EditTicketOutput>({
    resolver: zodResolver(editTicketSchema),
    defaultValues: valuesOf(ticket),
  });
  const { bodyTypeId, selection, products } = form.watch();
  /** Lo que el lavado ya sacó del inventario: se puede volver a pedir sin que falte. */
  const original = useMemo(() => originalQuantities(ticket.items), [ticket.items]);
  const shortage = activeShortage(stockShortageOf(update.error), products);

  const services = useMemo(
    () => (catalog.data ?? []).filter((service) => service.isActive),
    [catalog.data],
  );

  /** Las líneas a guardar, en el orden de los rubros y sin las desactivadas. */
  const lines = selectedLines(services, selection, bodyTypeId);
  const complete = bodyTypeId !== '' && lines.length > 0;

  function changeBodyType(nextId: string): void {
    if (nextId === bodyTypeId) return;

    form.setValue('bodyTypeId', nextId);
    form.setValue('selection', clampToBodyType(selection, services, nextId, clampToCatalog));
  }

  function close(next: boolean): void {
    if (!next) {
      update.reset();
      form.reset(valuesOf(ticket));
    }

    onOpenChange(next);
  }

  function persist(values: EditTicketOutput): void {
    update.mutate(
      {
        bodyTypeId: values.bodyTypeId,
        items: [
          ...selectedLines(services, values.selection, values.bodyTypeId).map((line) => ({
            serviceId: line.id,
            unitPrice: line.price,
          })),
          ...productItemsPayload(values.products),
        ],
        notes: values.notes,
      },
      {
        onSuccess: () => {
          toast({ title: `Lavado #${reference} actualizado` });
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              if (!complete) {
                event.preventDefault();
                return;
              }

              void form.handleSubmit(persist)(event);
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar el lavado #{reference}</DialogTitle>
              <DialogDescription>
                Tipo de carro, servicios, productos y nota. El precio lo toma el catálogo.
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
                  <FormField
                    control={form.control}
                    name="selection"
                    render={({ field }) => (
                      <ServicePicker
                        services={services}
                        bodyTypeId={bodyTypeId}
                        value={field.value}
                        onChange={field.onChange}
                        idPrefix={`edit-${ticket.id}`}
                      />
                    )}
                  />
                </div>
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="text-text-faint text-label">Productos</legend>
                <p className="text-text-faint text-dense mt-1">
                  Salen del inventario al guardar; lo que se quita vuelve.
                </p>
                <div className="mt-2">
                  <FormField
                    control={form.control}
                    name="products"
                    render={({ field }) => (
                      <ProductPicker
                        scope="carwash"
                        searchProducts={listProductOptions}
                        value={field.value}
                        onChange={field.onChange}
                        original={original}
                        shortage={shortage}
                        idPrefix={`edit-${ticket.id}`}
                      />
                    )}
                  />
                </div>
              </fieldset>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <Label htmlFor="edit-ticket-notes">Nota</Label>
                      <FormControl>
                        <Textarea {...field} id="edit-ticket-notes" rows={3} autoComplete="off" />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
        </Form>
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
  const items = ticket.items.flatMap((item) =>
    item.serviceId === null ? [] : [{ serviceId: item.serviceId, unitPrice: item.unitPrice }],
  );

  return {
    selected: items.map((item) => item.serviceId),
    prices: Object.fromEntries(items.map((item) => [item.serviceId, item.unitPrice])),
  };
}

/** Los campos de la edición tal como está el lavado ahora. */
function valuesOf(ticket: Ticket): EditTicketInput {
  return {
    bodyTypeId: ticket.bodyType.id,
    notes: ticket.notes ?? '',
    selection: selectionOf(ticket),
    products: productsFromTicket(ticket.items),
  };
}
