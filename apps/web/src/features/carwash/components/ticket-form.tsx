'use client';

import type {
  Customer,
  CustomerMatch,
  InventoryItemOption,
  ServiceDetail,
  VehicleBodyType,
} from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import type { ApiError } from '@/lib/api';
import { customerNameOf, draftFromCustomer } from '../customer-draft';
import type { ListCustomerVehicles } from '../hooks/use-customer-vehicles';
import { useVehicleStep } from '../hooks/use-vehicle-step';
import { activeShortage, stockShortageOf } from '../product-lines';
import { repriceForBodyType, selectedLines } from '../service-groups';
import {
  EMPTY_TICKET_FORM,
  isAnsweredApiError,
  isTicketComplete,
  newCustomerOf,
  plateConflictVehicle,
  saveStepOf,
  summaryLines,
  ticketFormSchema,
  ticketTotals,
  ticketValuesOf,
  unansweredMessage,
  type CustomerChoice,
  type TicketFormInput,
  type TicketFormOutput,
  type TicketFormValues,
} from '../ticket-draft';
import type { AssigneeOption } from './assignee-field';
import { CustomerMatchDialog } from './customer-match-dialog';
import { ProductsCard, ServicesCard } from './ticket-lines-fields';
import { TicketSummary } from './ticket-summary';
import { VehicleCard } from './vehicle-fields';
import { VehicleChangeDialog, type VehicleChangesSubmission } from './vehicle-change-dialog';
import { WasherPicker } from './washer-picker';

export type { TicketFormValues } from '../ticket-draft';

/** Lo que la ficha le avisa a quien guarda: qué hacer si el alta falla. */
export interface TicketSubmitHandlers {
  onError: (error: ApiError) => void;
}

/**
 * Alta de un lavado. Misma ficha en pista y en oficina (RN-7).
 *
 * **La placa primero** (040): se escribe, aparecen sugerencias y se toca una.
 * El responsable es opcional y va plegado. Placa + tipo + servicio alcanzan
 * para abrir.
 *
 * Los campos viven en `react-hook-form`, validados con el mismo schema que usa
 * el API (`ticketFormSchema`, sobre `createOfficeTicketSchema`). Lo que llega
 * del servidor —catálogo, carros de un cliente, existencia— sigue en TanStack
 * Query. Elegir un carro es siempre algo que hace alguien: un toque en la
 * sugerencia, en la lista de sus carros o el `409 VEHICLE_PLATE_EXISTS` que
 * devuelve el alta.
 *
 * El precio de cada servicio se muestra **ya resuelto para el tipo de carro
 * elegido** (RN-2) y se puede tocar para bajarlo o subirlo (022 RN-5, 087).
 *
 * Debajo de los servicios va el bloque **Productos** (065): si justo se acabó
 * uno, el API responde `409 INSUFFICIENT_STOCK`, la fila del producto dice
 * cuánto hay y lo demás del formulario queda como estaba.
 */
export function TicketForm({
  services,
  bodyTypes,
  employees,
  customerScope,
  searchCustomers,
  matchCustomer,
  listCustomerVehicles,
  updateCustomer,
  searchProducts,
  isSubmitting,
  error,
  onSubmit,
}: {
  services: ServiceDetail[];
  bodyTypes: VehicleBodyType[];
  /** Oficina: lista para el Combobox. La pista no la pasa (035). */
  employees?: AssigneeOption[];
  /** De qué API salen los clientes: `carwash` en oficina, `floor` en la pista. */
  customerScope: string;
  /** Las sugerencias mientras se escribe (RN-3). */
  searchCustomers: (query: string) => Promise<Customer[]>;
  /** ¿Ya existe alguien así? Se pregunta en línea, al salir del campo (030). */
  matchCustomer: (fullName: string, phone?: string) => Promise<CustomerMatch | null>;
  /** Consulta los carros registrados de un cliente. */
  listCustomerVehicles?: ListCustomerVehicles;
  /** Actualiza los datos de un cliente existente si se editan (028). */
  updateCustomer?: (id: string, input: { fullName?: string; phone?: string }) => Promise<Customer>;
  /** Los productos a la venta (065). Sin esto no se dibuja el bloque «Productos». */
  searchProducts?: (search: string) => Promise<InventoryItemOption[]>;
  isSubmitting: boolean;
  error: ApiError | null;
  /** Guarda el alta. `handlers.onError` va al `onError` de la mutación. */
  onSubmit: (values: TicketFormValues, handlers: TicketSubmitHandlers) => void;
}) {
  const form = useForm<TicketFormInput, unknown, TicketFormOutput>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: EMPTY_TICKET_FORM,
  });
  const values = form.watch();
  const vehicle = useVehicleStep({
    form,
    scope: customerScope,
    listCustomerVehicles,
    matchCustomer,
  });
  const { selectedVehicle } = vehicle;

  const [pendingMatch, setPendingMatch] = useState<CustomerMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);

  const { can } = usePermissions();
  const isOffice = customerScope !== 'floor';
  const canManageVehicles = isOffice && can('vehicles.manage');
  /** El lavado anterior se abre desde oficina; la pista no navega a tickets ajenos (036, 057). */
  const canOpenLastWash = isOffice && can('carwash.read');

  /**
   * La placa tecleada ya existía: el API lo dice al guardar y devuelve el carro.
   * Se adopta ese carro y, si se pueden administrar vehículos, se pregunta si
   * cambió de dueño o si fue un error de tipeo.
   */
  function handleSubmitError(failure: ApiError): void {
    const existing = plateConflictVehicle(failure);

    if (existing === null) return;

    vehicle.selectVehicle(existing);
    if (canManageVehicles) setChangeDialogOpen(true);
  }

  async function handleConfirmChanges(changes: VehicleChangesSubmission): Promise<void> {
    if (await vehicle.confirmChanges(changes)) setChangeDialogOpen(false);
  }

  function handleWrongPlate(): void {
    setChangeDialogOpen(false);
    vehicle.backToSearch();
  }

  /**
   * Cambiar el tipo de carro mueve el catálogo, sin voltear descuentos ni
   * recargos (030 RN-3, 087).
   */
  function changeBodyType(nextId: string): void {
    const previousId = form.getValues('bodyTypeId');

    form.setValue('bodyTypeId', nextId);
    form.setValue(
      'selection',
      repriceForBodyType(form.getValues('selection'), services, previousId, nextId),
    );
  }

  /** Las líneas elegidas, en el orden de los rubros: un lavado y un pulido se suman. */
  const lines = selectedLines(services, values.selection, values.bodyTypeId);
  const { discount, total } = ticketTotals(lines, values.products);
  /** El producto que el API dijo que no alcanza, mientras siga pidiéndose de más. */
  const shortage = activeShortage(stockShortageOf(error), values.products);
  const complete = isTicketComplete({ ...values, vehicle: selectedVehicle });
  const bodyType = bodyTypes.find((candidate) => candidate.id === values.bodyTypeId);
  const errorMessage = form.formState.errors.root?.message ?? error?.message;

  /** El resto del cuerpo: lo mismo con cliente elegido o con cliente nuevo. */
  function submitWith(who: CustomerChoice, fields: TicketFormInput = form.getValues()): void {
    onSubmit(
      ticketValuesOf({ fields, vehicle: selectedVehicle, lines, who, withEmployee: isOffice }),
      { onError: handleSubmitError },
    );
  }

  /** El API no respondió (red caída): se dice al pie y no se abre nada. */
  function failUnanswered(cause: unknown): void {
    form.setError('root', { message: unansweredMessage(cause) });
  }

  /**
   * Guardar. Con un cliente elegido va derecho; con uno nuevo se pregunta
   * primero si ya existe (RN-2) —salvo que ya se haya resuelto en línea (030).
   */
  async function save(fields: TicketFormOutput): Promise<void> {
    const next = saveStepOf({
      vehicle: selectedVehicle,
      customer: fields.customer,
      canManageVehicles,
    });

    if (next.kind === 'confirm-owner') {
      setChangeDialogOpen(true);
      return;
    }

    if (next.kind === 'submit') {
      submitWith(next.who, fields);
      return;
    }

    if (next.kind === 'update') {
      setChecking(true);
      try {
        if (updateCustomer) await updateCustomer(next.customerId, next.changes);
      } catch (cause) {
        if (!isAnsweredApiError(cause)) {
          failUnanswered(cause);
          return;
        }
        // El API rechazó el cambio del perfil: queda como estaba y el lavado se abre igual (028).
      } finally {
        setChecking(false);
      }

      submitWith({ customerId: next.customerId }, fields);
      return;
    }

    let found: CustomerMatch | null = null;

    setChecking(true);
    try {
      found = await matchCustomer(next.draft.fullName, next.draft.phone);
    } catch (cause) {
      if (!isAnsweredApiError(cause)) {
        failUnanswered(cause);
        return;
      }
      // El API no pudo responder la pregunta: se sigue como cliente nuevo (004 RN-2).
    } finally {
      setChecking(false);
    }

    if (found !== null) {
      setPendingMatch(found);
      return;
    }

    submitWith({ customer: next.draft }, fields);
  }

  return (
    <Form {...form}>
      <form
        className="grid items-start gap-6 pb-[calc(var(--control-h)+3.5rem+env(safe-area-inset-bottom))] xl:grid-cols-[1fr_340px] xl:pb-0"
        onSubmit={(event) => {
          if (!complete || checking || isSubmitting) {
            event.preventDefault();
            return;
          }

          void form.handleSubmit(save)(event);
        }}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <VehicleCard
            step={vehicle.step}
            query={vehicle.query}
            onQueryChange={vehicle.setQuery}
            scope={customerScope}
            searchCustomers={searchCustomers}
            matchCustomer={matchCustomer}
            listCustomerVehicles={listCustomerVehicles}
            bodyTypes={bodyTypes}
            services={services}
            canManageVehicles={canManageVehicles}
            canOpenLastWash={canOpenLastWash}
            onPickVehicle={vehicle.selectVehicle}
            onPickCustomer={(chosen) => void vehicle.pickCustomer(chosen)}
            onNewVehicle={vehicle.startNewVehicle}
            onBack={vehicle.backToSearch}
            onEditVehicle={() => setChangeDialogOpen(true)}
            onBodyTypeChange={changeBodyType}
          />

          <ServicesCard services={services} />

          {searchProducts === undefined ? null : (
            <ProductsCard
              scope={customerScope}
              searchProducts={searchProducts}
              shortage={shortage}
            />
          )}

          {!isOffice || employees === undefined ? null : <WasherPicker employees={employees} />}

          <Card className="gap-0 px-card">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FieldBox>
                    <Label htmlFor="ticket-notes">Nota</Label>
                    <FormControl>
                      <Textarea {...field} id="ticket-notes" rows={3} autoComplete="off" />
                    </FormControl>
                  </FieldBox>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          {errorMessage ? (
            <p className="text-danger-text text-dense xl:hidden" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <TicketSummary
          plate={values.plate}
          bodyTypeName={bodyType?.name}
          customerName={customerNameOf(values.customer) || 'Sin responsable · opcional'}
          lines={summaryLines(lines, values.products)}
          discount={discount}
          total={total}
          isSubmitting={isSubmitting || checking}
          canSubmit={complete}
          errorMessage={errorMessage}
          hasBottomRail={customerScope === 'carwash'}
        />

        {/* «¿Es el mismo?» al guardar: la red de seguridad para quien nunca salió
            del campo. Lo normal es que ya se haya resuelto en línea (030). */}
        <CustomerMatchDialog
          match={pendingMatch}
          onUseExisting={() => {
            const existing = pendingMatch?.customer;

            setPendingMatch(null);

            if (existing === undefined) return;

            form.setValue('customer', draftFromCustomer(existing));
            submitWith({ customerId: existing.id });
          }}
          onCreateAnother={() => {
            setPendingMatch(null);

            const customer = newCustomerOf(form.getValues('customer'));

            submitWith(customer === null ? {} : { customer });
          }}
          onOpenChange={(open) => {
            if (!open) setPendingMatch(null);
          }}
        />

        {canManageVehicles ? (
          <VehicleChangeDialog
            open={changeDialogOpen}
            vehicle={selectedVehicle}
            bodyTypes={bodyTypes}
            customerScope={customerScope}
            searchCustomers={searchCustomers}
            isSubmitting={vehicle.isUpdatingVehicle}
            onOpenChange={setChangeDialogOpen}
            onConfirmChanges={handleConfirmChanges}
            onWrongPlate={handleWrongPlate}
          />
        ) : null}
      </form>
    </Form>
  );
}
