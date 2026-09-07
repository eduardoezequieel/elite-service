'use client';

import type {
  Customer,
  CustomerMatch,
  ServiceDetail,
  VehicleBodyType,
  VehicleWithOwner,
} from '@elite/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { listFloorTickets } from '@/features/floor/api';
import { listTickets, updateVehicle } from '../api';
import {
  clampToCatalog,
  discountBy,
  discountByPercent,
  discountCents,
  maskMoneyInput,
  toCents,
} from '../pricing';
import { formatPlate } from '../hooks/use-vehicle-search';
import { BodyTypePicker } from './body-type-card';
import {
  EMPTY_CUSTOMER,
  OwnerField,
  customerIsComplete,
  customerNameOf,
  draftFromCustomer,
  type CustomerDraft,
} from './customer-field';
import { CustomerMatchDialog } from './customer-match-dialog';
import { IntakeField } from './intake-field';
import { KnownVehicleCard } from './known-vehicle-card';
import { TicketSummary } from './ticket-summary';
import { VehicleChangeDialog, type VehicleChangesSubmission } from './vehicle-change-dialog';
import { AssigneeField, type AssigneeOption } from './assignee-field';

/**
 * Lo que el formulario devuelve. Las dos vistas lo mandan a su propia ruta.
 *
 * El cliente viaja de una de dos formas y nunca de las dos: `customerId` si se
 * eligió uno que ya existe —y entonces no se crea nadie ni se le pisa un dato
 * (004 RN-6)—, o `customer` si es alguien nuevo.
 *
 * Si el vehículo ya existe en el catálogo, se envía `vehicleId` y no se mandan
 * tipo, marca ni color (012).
 */
export interface TicketFormValues {
  customerId?: string;
  customer?: { fullName: string; phone?: string };
  vehicleId?: string | null;
  vehicle?: { plate: string; bodyTypeId?: string; make?: string; color?: string };
  items: { serviceId: string; unitPrice?: string }[];
  notes?: string;
  /** Oficina: un empleado, o nada (sin asignar). La pista no lo manda (035). */
  employeeId?: string;
}

/**
 * Alta de un lavado. Misma ficha en pista y en oficina (RN-7).
 *
 * **Una sola caja para empezar** (030): placa, nombre o teléfono en el mismo
 * campo. Los carros se listan con su dueño pegado, así que un toque resuelve las
 * dos cosas; si no está, la última fila de la misma lista lo anota desde cero.
 * No hay modos «buscar» y «crear» que el usuario tenga que distinguir.
 *
 * Todo se elige tocando, nunca con un desplegable (RN-17): el tipo de carro y
 * los servicios son botones grandes porque quien los usa está de pie, con la
 * tablet en una mano y a veces con guantes.
 *
 * El precio de cada servicio se muestra **ya resuelto para el tipo de carro
 * elegido** (RN-2) y en oficina se puede tocar para descontar, con el tope del
 * catálogo (022 RN-5). En la pista no se toca.
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
  listCustomerVehicles?: (customerId: string) => Promise<VehicleWithOwner[]>;
  /** Actualiza los datos de un cliente existente si se editan (028). */
  updateCustomer?: (id: string, input: { fullName?: string; phone?: string }) => Promise<Customer>;
  isSubmitting: boolean;
  error: ApiError | null;
  onSubmit: (values: TicketFormValues) => void;
}) {
  const [customer, setCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [pendingMatch, setPendingMatch] = useState<CustomerMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithOwner | null>(null);
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [resolvingFor, setResolvingFor] = useState<Customer | null>(null);
  const [plate, setPlate] = useState('');
  const [bodyTypeId, setBodyTypeId] = useState('');
  const [make, setMake] = useState('');
  const [color, setColor] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [price, setPrice] = useState<string | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  const resolvedForRef = useRef<string | null>(null);

  const { can } = usePermissions();
  const canManageVehicles = customerScope !== 'floor' && can('vehicles.manage');
  /** Se puede descontar tanto en oficina como en pista (030). */
  const canEditPrice = true;

  /** Los carros de quien se acaba de elegir, para saber cuál trajo (026). */
  const resolvingId = resolvingFor?.id ?? null;
  const customerVehiclesQuery = useQuery<VehicleWithOwner[]>({
    queryKey: ['customer-vehicles', customerScope, resolvingId],
    queryFn: () =>
      resolvingId && listCustomerVehicles
        ? listCustomerVehicles(resolvingId)
        : Promise.resolve([]),
    enabled: Boolean(resolvingId && listCustomerVehicles),
  });
  const customerVehicles = customerVehiclesQuery.data ?? [];

  function selectVehicle(vehicle: VehicleWithOwner): void {
    setSelectedVehicle(vehicle);
    setIsNewVehicle(false);
    setResolvingFor(null);
    setPlate(vehicle.plate);
    setBodyTypeId(vehicle.bodyType.id);
    setMake(vehicle.make ?? '');
    setColor(vehicle.color ?? '');
    setPrice(null);

    if (vehicle.currentOwner) setCustomer(draftFromCustomer(vehicle.currentOwner));
  }

  /** Anotar un carro que el sistema no conoce. */
  function startNewVehicle(typed: string): void {
    setSelectedVehicle(null);
    setIsNewVehicle(true);
    setResolvingFor(null);
    setPlate(formatPlate(typed));
    setBodyTypeId('');
    setMake('');
    setColor('');
    setShowDetails(false);
    setPrice(null);
  }

  /** Volver a la caja única: se deshace la elección del carro, no el servicio. */
  function backToSearch(): void {
    setSelectedVehicle(null);
    setIsNewVehicle(false);
    setResolvingFor(null);
    resolvedForRef.current = null;
    setCustomer(EMPTY_CUSTOMER);
    setPlate('');
    setBodyTypeId('');
    setMake('');
    setColor('');
    setQuery('');
    setPrice(null);
  }

  function pickCustomer(chosen: Customer): void {
    setCustomer(draftFromCustomer(chosen));
    setResolvingFor(chosen);
    resolvedForRef.current = null;
  }

  /**
   * Elegido un cliente, su carro se resuelve solo cuando no hay dudas (026):
   * con uno registrado se preselecciona, sin ninguno se pasa a carro nuevo, y
   * con varios se le pregunta cuál trajo.
   */
  useEffect(() => {
    if (resolvingFor === null || customerVehiclesQuery.isPending) return;
    if (resolvedForRef.current === resolvingFor.id) return;

    resolvedForRef.current = resolvingFor.id;

    if (customerVehicles.length === 1) selectVehicle(customerVehicles[0]);
    else if (customerVehicles.length === 0) startNewVehicle('');
  }, [resolvingFor, customerVehicles, customerVehiclesQuery.isPending]);

  /**
   * La placa tecleada ya existía: el API lo dice al guardar y devuelve el carro.
   * Se adopta ese carro y, si se pueden administrar vehículos, se pregunta si
   * cambió de dueño o si fue un error de tipeo.
   */
  useEffect(() => {
    if (!error) return;

    const existing = (error.details as { vehicle?: VehicleWithOwner } | undefined)?.vehicle;

    if (error.code === 'VEHICLE_PLATE_EXISTS' && existing) {
      selectVehicle(existing);
      if (canManageVehicles) setChangeDialogOpen(true);
    }
  }, [error, canManageVehicles]);

  const lastWashQuery = useQuery({
    queryKey: [
      'vehicle-last-wash',
      customerScope,
      selectedVehicle?.id,
      selectedVehicle?.currentOwner?.id,
    ],
    queryFn: async () => {
      if (!selectedVehicle) return null;

      try {
        if (customerScope === 'floor') {
          const tickets = await listFloorTickets({ q: selectedVehicle.plate });
          if (tickets.length > 0 && tickets[0]) return lastWashLabel(tickets[0]);
        } else if (selectedVehicle.currentOwner?.id) {
          const tickets = await listTickets({ customerId: selectedVehicle.currentOwner.id });
          const match = tickets.find((t) => t.vehicle?.id === selectedVehicle.id) ?? tickets[0];
          if (match) return lastWashLabel(match);
        }
      } catch {
        return null;
      }

      return null;
    },
    enabled: Boolean(selectedVehicle),
  });

  async function handleConfirmChanges(changes: VehicleChangesSubmission): Promise<void> {
    if (!selectedVehicle) return;

    setIsUpdatingVehicle(true);
    try {
      let ownerId = changes.customerId;

      if (changes.customer && changes.customer.fullName) {
        const matched = await matchCustomer(changes.customer.fullName, changes.customer.phone);
        if (matched?.customer) ownerId = matched.customer.id;
      }

      const updated = await updateVehicle(selectedVehicle.id, {
        bodyTypeId: changes.bodyTypeId,
        make: changes.make,
        color: changes.color,
        customerId: ownerId ?? undefined,
      });

      setSelectedVehicle(updated);
      setBodyTypeId(updated.bodyType.id);
      setMake(updated.make ?? '');
      setColor(updated.color ?? '');
      if (updated.currentOwner) setCustomer(draftFromCustomer(updated.currentOwner));
      setChangeDialogOpen(false);
    } catch {
      // Si falla la mutación, el diálogo se queda abierto con lo escrito.
    } finally {
      setIsUpdatingVehicle(false);
    }
  }

  function handleWrongPlate(): void {
    setChangeDialogOpen(false);
    backToSearch();
  }

  /** Precio de cada servicio para el carro elegido: la matriz gana al base (RN-2). */
  const catalogOf = useMemo(
    () =>
      (service: ServiceDetail): string =>
        service.prices.find((row) => row.bodyTypeId === bodyTypeId)?.price ??
        service.defaultPrice,
    [bodyTypeId],
  );

  const chosenService = services.find((service) => selected.includes(service.id)) ?? null;
  const catalogPrice = chosenService === null ? '0.00' : catalogOf(chosenService);
  const chargedPrice = price ?? catalogPrice;
  const discount = chosenService === null ? 0 : discountCents(catalogPrice, chargedPrice);
  const total = chosenService === null ? 0 : toCents(chargedPrice);

  /** Cambiar el tipo de carro mueve el catálogo: el descuento se recorta (030 RN-3). */
  function changeBodyType(nextId: string): void {
    setBodyTypeId(nextId);

    if (price === null || chosenService === null) return;

    const nextCatalog =
      chosenService.prices.find((row) => row.bodyTypeId === nextId)?.price ??
      chosenService.defaultPrice;

    setPrice(clampToCatalog(price, nextCatalog));
  }

  function chooseService(service: ServiceDetail): void {
    const isSame = selected.includes(service.id);

    setSelected([service.id]);
    if (!isSame) {
      setPrice(null);
      setIsEditingPrice(false);
    }
  }

  function commitPrice(): void {
    if (price !== null) setPrice(clampToCatalog(price, catalogPrice));
    setIsEditingPrice(false);
  }

  const hasVehicle = selectedVehicle !== null || plate.trim() !== '';
  const complete =
    customerIsComplete(customer) && hasVehicle && bodyTypeId !== '' && selected.length > 0;
  const bodyType = bodyTypes.find((candidate) => candidate.id === bodyTypeId);

  /** El resto del cuerpo: lo mismo con cliente elegido o con cliente nuevo. */
  function submitWith(who: Pick<TicketFormValues, 'customerId' | 'customer'>): void {
    onSubmit({
      ...who,
      vehicleId: selectedVehicle?.id ?? null,
      vehicle: selectedVehicle
        ? undefined
        : {
            plate: plate.trim(),
            bodyTypeId,
            make: make.trim() || undefined,
            color: color.trim() || undefined,
          },
      items: selected.map((serviceId) => ({
        serviceId,
        // Solo viaja si de verdad se descontó: si no, manda el catálogo el API.
        unitPrice: discount > 0 ? chargedPrice : undefined,
      })),
      notes: notes.trim() || undefined,
      ...(customerScope === 'floor' || employeeId === null ? {} : { employeeId }),
    });
  }

  /**
   * Guardar. Con un cliente elegido va derecho; con uno nuevo se pregunta
   * primero si ya existe (RN-2) —salvo que ya se haya resuelto en línea (030).
   */
  async function save(): Promise<void> {
    if (selectedVehicle?.currentOwner) {
      const isOwnerDifferent =
        !customer.customerId || customer.customerId !== selectedVehicle.currentOwner.id;

      if (isOwnerDifferent && canManageVehicles) {
        setChangeDialogOpen(true);
        return;
      }
    }

    if (customer.customerId) {
      const isNameChanged =
        customer.original !== undefined &&
        customer.fullName.trim() !== customer.original.fullName.trim();
      const isPhoneChanged =
        customer.original !== undefined &&
        customer.phone.trim() !== customer.original.phone.trim();

      if (isNameChanged || isPhoneChanged) {
        setChecking(true);
        try {
          if (updateCustomer) {
            await updateCustomer(customer.customerId, {
              fullName: isNameChanged ? customer.fullName.trim() : undefined,
              phone: customer.phone.trim() || undefined,
            });
          }
        } catch {
          // Si falla la actualización del perfil, seguimos con el ticket.
        } finally {
          setChecking(false);
        }
      }

      submitWith({ customerId: customer.customerId });
      return;
    }

    const draft = {
      fullName: customer.fullName.trim(),
      phone: customer.phone.trim() || undefined,
    };

    setChecking(true);

    try {
      const found = await matchCustomer(draft.fullName, draft.phone);

      if (found !== null) {
        setPendingMatch(found);
        return;
      }

      submitWith({ customer: draft });
    } catch {
      submitWith({ customer: draft });
    } finally {
      setChecking(false);
    }
  }

  const isChoosing = resolvingFor !== null;

  return (
    <form
      className="grid items-start gap-6 pb-[calc(var(--control-h)+3.5rem+env(safe-area-inset-bottom))] xl:grid-cols-[1fr_340px] xl:pb-0"
      onSubmit={(event) => {
        event.preventDefault();

        if (!complete || checking || isSubmitting) return;

        void save();
      }}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="gap-0 px-card">
          <h2 className="text-title text-text">¿Qué carro es?</h2>
          <p className="text-text-faint text-dense mt-1">
            {selectedVehicle || isNewVehicle
              ? 'Todo lo del carro y su dueño en un solo lugar.'
              : 'Escribí lo que sepas: nombre, placa o teléfono.'}
          </p>

          <div className="mt-4">
            {isChoosing ? (
              <ChooseVehicle
                customer={resolvingFor}
                vehicles={customerVehicles}
                isPending={customerVehiclesQuery.isPending}
                onPick={selectVehicle}
                onNew={() => startNewVehicle('')}
                onBack={backToSearch}
              />
            ) : selectedVehicle ? (
              <div className="flex flex-col gap-4">
                <KnownVehicleCard
                  vehicle={selectedVehicle}
                  lastWashDate={lastWashQuery.data}
                  canManage={canManageVehicles}
                  onEdit={() => setChangeDialogOpen(true)}
                  onDeselect={backToSearch}
                />

                {selectedVehicle.currentOwner ? null : (
                  <OwnerField
                    value={customer}
                    onChange={setCustomer}
                    scope={customerScope}
                    searchCustomers={searchCustomers}
                    matchCustomer={matchCustomer}
                    label="Este carro no tiene dueño registrado. ¿De quién es?"
                  />
                )}
              </div>
            ) : isNewVehicle ? (
              <div className="flex flex-col gap-5">
                <div className="rounded-row border-[1.5px] border-[color-mix(in_oklab,var(--flame)_40%,var(--line))] bg-[color-mix(in_oklab,var(--flame)_6%,var(--surface-2))] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <Stamp label="Carro nuevo" tone="washing" pulse={false} />
                    <Button type="button" variant="ghost" size="sm" onClick={backToSearch}>
                      Buscar otra vez
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FieldBox>
                      <Label htmlFor="ticket-plate">Placa</Label>
                      <Input
                        id="ticket-plate"
                        value={plate}
                        onChange={(event) => setPlate(formatPlate(event.target.value))}
                        className="font-mono tracking-[0.06em]"
                        placeholder="P000-000"
                        inputMode="text"
                        autoCapitalize="characters"
                        autoComplete="off"
                        enterKeyHint="next"
                        maxLength={10}
                      />
                    </FieldBox>
                  </div>

                  <p className="text-text-faint text-label mt-5 mb-2">Tipo de carro</p>
                  <BodyTypePicker
                    bodyTypes={bodyTypes}
                    services={services}
                    value={bodyTypeId}
                    onChange={changeBodyType}
                  />

                  {showDetails ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <FieldBox>
                        <Label htmlFor="ticket-make">Marca</Label>
                        <Input
                          id="ticket-make"
                          value={make}
                          onChange={(event) => setMake(event.target.value)}
                          placeholder="Toyota, Nissan…"
                          autoComplete="off"
                        />
                      </FieldBox>
                      <FieldBox>
                        <Label htmlFor="ticket-color">Color</Label>
                        <Input
                          id="ticket-color"
                          value={color}
                          onChange={(event) => setColor(event.target.value)}
                          placeholder="Gris, blanco…"
                          autoComplete="off"
                        />
                      </FieldBox>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3 px-0"
                      onClick={() => setShowDetails(true)}
                    >
                      + Agregar marca y color (opcional)
                    </Button>
                  )}
                </div>

                <OwnerField
                  value={customer}
                  onChange={setCustomer}
                  scope={customerScope}
                  searchCustomers={searchCustomers}
                  matchCustomer={matchCustomer}
                />
              </div>
            ) : (
              <IntakeField
                value={query}
                onChange={setQuery}
                scope={customerScope}
                searchCustomers={searchCustomers}
                onPickVehicle={selectVehicle}
                onPickCustomer={pickCustomer}
                onNewVehicle={startNewVehicle}
              />
            )}
          </div>
        </Card>

        <Card className="gap-0 px-card">
          <fieldset className="min-w-0">
            <legend className="text-title text-text">Servicio</legend>
            <p className="text-text-faint text-dense mt-1">
              {bodyTypeId === ''
                ? 'Elegí primero el carro: el precio depende del tipo.'
                : canEditPrice
                  ? 'El precio ya es el de este carro. Tocalo para hacer un descuento.'
                  : 'El precio ya es el de este carro.'}
            </p>

            <div className="mt-4">
              {bodyTypeId === '' ? (
                <p className="text-text-dim text-body">Todavía no hay precio que mostrar.</p>
              ) : (
                <div className="grid gap-2.5" role="radiogroup" aria-label="Servicios">
                  {services.map((service) => {
                    const isOn = selected.includes(service.id);
                    const catalog = catalogOf(service);

                    return (
                      <ServiceChoice
                        key={service.id}
                        label={service.name}
                        catalogPrice={catalog}
                        chargedPrice={isOn ? chargedPrice : catalog}
                        selected={isOn}
                        canEditPrice={canEditPrice}
                        isEditing={isOn && isEditingPrice}
                        onSelect={() => chooseService(service)}
                        onStartEdit={() => {
                          chooseService(service);
                          setPrice((current) => (isOn ? (current ?? catalog) : catalog));
                          setIsEditingPrice(true);
                        }}
                        onPriceChange={(next) => setPrice(maskMoneyInput(next))}
                        onCommit={commitPrice}
                        onDiscount={(amount) => setPrice(discountBy(catalog, amount))}
                        onDiscountPercent={(percent) =>
                          setPrice(discountByPercent(catalog, percent))
                        }
                        onClearDiscount={() => setPrice(catalog)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </fieldset>
        </Card>

        {customerScope === 'floor' || employees === undefined ? null : (
          <Card className="gap-3 px-card">
            <AssigneeField employees={employees} value={employeeId} onChange={setEmployeeId} />
            <p className="text-text-faint text-dense">
              Si no elegís a nadie, el lavado queda sin asignar.
            </p>
          </Card>
        )}

        <Card className="gap-0 px-card">
          <FieldBox>
            <Label htmlFor="ticket-notes">Nota</Label>
            <Textarea
              id="ticket-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              autoComplete="off"
            />
          </FieldBox>
        </Card>

        {error?.message ? (
          <p className="text-danger-text text-dense xl:hidden" role="alert">
            {error.message}
          </p>
        ) : null}
      </div>

      <TicketSummary
        plate={plate}
        bodyTypeName={bodyType?.name}
        customerName={customerNameOf(customer)}
        lines={
          chosenService === null
            ? []
            : [{ id: chosenService.id, name: chosenService.name, price: chargedPrice }]
        }
        discount={discount}
        total={total}
        isSubmitting={isSubmitting || checking}
        canSubmit={complete}
        errorMessage={error?.message}
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

          setCustomer(draftFromCustomer(existing));
          submitWith({ customerId: existing.id });
        }}
        onCreateAnother={() => {
          setPendingMatch(null);

          submitWith({
            customer: {
              fullName: customer.fullName.trim(),
              phone: customer.phone.trim() || undefined,
            },
          });
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
          isSubmitting={isUpdatingVehicle}
          onOpenChange={setChangeDialogOpen}
          onConfirmChanges={handleConfirmChanges}
          onWrongPlate={handleWrongPlate}
        />
      ) : null}
    </form>
  );
}

/** «12 ago · Lavado + aspirado»: la fecha del último lavado y qué le hicieron. */
function lastWashLabel(ticket: { createdAt: string; items: { serviceName: string }[] }): string {
  const date = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short' }).format(
    new Date(ticket.createdAt),
  );
  const service = ticket.items[0]?.serviceName;

  return service ? `${date} · ${service}` : date;
}

/** Los carros de quien acaba de elegirse, cuando tiene más de uno (026). */
function ChooseVehicle({
  customer,
  vehicles,
  isPending,
  onPick,
  onNew,
  onBack,
}: {
  customer: Customer;
  vehicles: VehicleWithOwner[];
  isPending: boolean;
  onPick: (vehicle: VehicleWithOwner) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="border-line bg-surface-2 flex flex-wrap items-center gap-3 rounded-row border px-4 py-3">
        <p className="text-text text-dense min-w-0 flex-1">
          <span className="font-semibold">{customer.fullName}</span>
          {isPending ? ' · buscando sus carros…' : ` tiene ${vehicles.length} carros. ¿Cuál trajo?`}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Empezar de nuevo
        </Button>
      </div>

      {isPending ? null : (
        <div className="mt-2.5 grid gap-2.5">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onPick(vehicle)}
              className="min-h-touch border-line bg-surface-2 hover:border-flame flex cursor-pointer items-center gap-3 rounded-row border px-4 py-3 text-left transition-colors duration-(--duration-state) ease-standard"
            >
              <PlateChip plate={vehicle.plate} />
              <span className="min-w-0 flex-1">
                <span className="text-text block truncate font-semibold">
                  {[vehicle.make, vehicle.color].filter(Boolean).join(' ') || vehicle.bodyType.name}
                </span>
                <span className="text-text-faint text-dense block truncate">
                  {vehicle.bodyType.name}
                </span>
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={onNew}
            className="min-h-touch border-line text-flame-text hover:border-flame flex cursor-pointer items-center gap-3 rounded-row border border-dashed px-4 py-3 text-left font-semibold transition-colors duration-(--duration-state) ease-standard"
          >
            Trajo otro carro
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Una opción que se toca: la lámina con su radio dibujado a la izquierda y el
 * precio a la derecha.
 *
 * El precio **es un botón** cuando se puede descontar (030): al tocarlo, la
 * lámina queda elegida y el precio se vuelve editable ahí mismo, con atajos
 * debajo. El precio del catálogo se queda al lado, tachado, para que el
 * descuento se vea sin tener que recordarlo.
 *
 * La lámina no es un `<button>` porque contiene otro: es un `radio` de verdad,
 * con `tabIndex` y teclado propios.
 */
function ServiceChoice({
  label,
  catalogPrice,
  chargedPrice,
  selected,
  canEditPrice,
  isEditing,
  onSelect,
  onStartEdit,
  onPriceChange,
  onCommit,
  onDiscount,
  onDiscountPercent,
  onClearDiscount,
}: {
  label: string;
  catalogPrice: string;
  chargedPrice: string;
  selected: boolean;
  canEditPrice: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onPriceChange: (next: string) => void;
  onCommit: () => void;
  onDiscount: (amount: number) => void;
  onDiscountPercent: (percent: number) => void;
  onClearDiscount: () => void;
}) {
  const off = selected ? discountCents(catalogPrice, chargedPrice) : 0;

  return (
    <div className="grid gap-2.5">
      <div
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
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
        </span>

        {off > 0 ? (
          <Stamp
            label={`−$${(off / 100).toFixed(2)}`}
            tone="washing"
            pulse={false}
            className="shrink-0"
          />
        ) : null}

        {isEditing ? (
          <>
            <span className="border-flame bg-surface-2 min-h-touch flex shrink-0 items-center gap-1 rounded-control border-[1.5px] px-3">
              <span className="text-text-dim font-mono font-bold">$</span>
              <label className="sr-only" htmlFor="ticket-price">
                Precio a cobrar
              </label>
              <input
                id="ticket-price"
                value={chargedPrice}
                onChange={(event) => onPriceChange(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault();
                    onCommit();
                  }
                }}
                onBlur={onCommit}
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                autoFocus
                className="text-text w-[5.5rem] border-0 bg-transparent p-0 text-right font-mono text-body font-bold tabular-nums outline-none"
              />
            </span>

            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                onCommit();
              }}
            >
              Listo
            </Button>
          </>
        ) : (
          <>
            {off > 0 ? (
              <span className="text-text-faint shrink-0 font-mono text-dense line-through">
                ${catalogPrice}
              </span>
            ) : null}

            {canEditPrice ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartEdit();
                }}
                title="Tocá el precio para hacer un descuento"
                className={cn(
                  'min-h-touch border-line bg-surface hover:border-flame flex shrink-0 cursor-pointer items-center gap-2 rounded-control border px-3 font-mono text-body font-bold tabular-nums transition-colors duration-(--duration-state) ease-standard',
                  off > 0 && 'text-flame-text border-[color-mix(in_oklab,var(--flame)_45%,var(--line))]',
                )}
              >
                ${chargedPrice}
                <span aria-hidden="true" className="text-text-faint text-dense font-sans">
                  Editar
                </span>
              </button>
            ) : (
              <span className="text-text shrink-0 font-mono text-body font-bold tabular-nums">
                ${chargedPrice}
              </span>
            )}
          </>
        )}
      </div>

      {isEditing ? (
        <div
          className="flex flex-wrap items-center gap-2"
          // Sin esto, el foco sale del campo, el `blur` cierra la edición y el
          // atajo se pierde antes de que llegue su clic.
          onPointerDown={(event) => event.preventDefault()}
        >
          <Button type="button" variant="outline" size="sm" onClick={() => onDiscount(1)}>
            −$1
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onDiscount(2)}>
            −$2
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onDiscount(5)}>
            −$5
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onDiscountPercent(10)}>
            −10%
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearDiscount}>
            Sin descuento (${catalogPrice})
          </Button>
          <p className="text-text-faint text-dense basis-full">
            Tope: ${catalogPrice} del catálogo. El descuento solo baja.
          </p>
        </div>
      ) : null}
    </div>
  );
}


