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
import { updateVehicle } from '../api';
import { clampToCatalog, discountCents, toCents } from '../pricing';
import {
  EMPTY_SELECTION,
  clampToBodyType,
  selectedLines,
  type ServiceSelection,
} from '../service-groups';
import { formatPlate } from '../hooks/use-vehicle-search';
import { BodyTypePicker } from './body-type-card';
import {
  EMPTY_CUSTOMER,
  OwnerField,
  customerNameOf,
  draftFromCustomer,
  type CustomerDraft,
} from './customer-field';
import { CustomerMatchDialog } from './customer-match-dialog';
import { IntakeField } from './intake-field';
import { KnownVehicleCard } from './known-vehicle-card';
import { ServicePicker } from './service-picker';
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
 * **La placa primero** (040): se escribe, aparecen sugerencias y se toca una.
 * El responsable es opcional y va plegado. Placa + tipo + servicio alcanzan
 * para abrir.
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
  /** Un servicio por rubro y los descuentos de cada línea (039, 050). */
  const [selection, setSelection] = useState<ServiceSelection>(EMPTY_SELECTION);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  const resolvedForRef = useRef<string | null>(null);

  const { can } = usePermissions();
  const isOffice = customerScope !== 'floor';
  const canManageVehicles = isOffice && can('vehicles.manage');
  /** El lavado anterior se abre desde oficina; la pista no navega a tickets ajenos (036, 057). */
  const canOpenLastWash = isOffice && can('carwash.read');
  /** Se puede descontar tanto en oficina como en pista (030). */
  const canEditPrice = true;

  /** Los carros de quien se acaba de elegir, para saber cuál trajo (026). */
  const resolvingId = resolvingFor?.id ?? null;
  const customerVehiclesQuery = useQuery<VehicleWithOwner[]>({
    queryKey: ['customer-vehicles', customerScope, resolvingId],
    queryFn: () =>
      resolvingId && listCustomerVehicles ? listCustomerVehicles(resolvingId) : Promise.resolve([]),
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
    setSelection(EMPTY_SELECTION);

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
    setSelection(EMPTY_SELECTION);
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
    setSelection(EMPTY_SELECTION);
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

  /**
   * Las líneas elegidas, en el orden de los rubros: un lavado y un pulido son
   * dos líneas que se suman. Cada una cobra el precio del catálogo salvo que se
   * le haya hecho un descuento.
   */
  const lines = useMemo(
    () => selectedLines(services, selection, bodyTypeId),
    [services, selection, bodyTypeId],
  );

  const discount = lines.reduce((sum, line) => sum + discountCents(line.catalog, line.price), 0);
  const total = lines.reduce((sum, line) => sum + toCents(line.price), 0);

  /** Cambiar el tipo de carro mueve el catálogo: los descuentos se recortan (030 RN-3). */
  function changeBodyType(nextId: string): void {
    setBodyTypeId(nextId);
    setSelection((current) => clampToBodyType(current, services, nextId, clampToCatalog));
  }

  const hasVehicle = selectedVehicle !== null || plate.trim() !== '';
  const complete = hasVehicle && bodyTypeId !== '' && selection.selected.length > 0;
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
      items: lines.map((line) => ({
        serviceId: line.id,
        // Solo viaja si de verdad se descontó: si no, manda el catálogo el API.
        unitPrice: line.price === line.catalog ? undefined : line.price,
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
    if (
      selectedVehicle?.currentOwner &&
      customer.customerId &&
      customer.customerId !== selectedVehicle.currentOwner.id &&
      canManageVehicles
    ) {
      setChangeDialogOpen(true);
      return;
    }

    if (selectedVehicle?.currentOwner) {
      submitWith({});
      return;
    }

    if (customer.customerId) {
      const isNameChanged =
        customer.original !== undefined &&
        customer.fullName.trim() !== customer.original.fullName.trim();
      const isPhoneChanged =
        customer.original !== undefined && customer.phone.trim() !== customer.original.phone.trim();

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

    const name = customer.fullName.trim();

    if (name === '') {
      submitWith({});
      return;
    }

    const draft = {
      fullName: name,
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
          <h2 className="text-title text-text">El carro</h2>
          <p className="text-text-faint text-dense mt-1">
            {selectedVehicle || isNewVehicle
              ? 'La placa manda. El responsable es opcional.'
              : 'Escribí la placa. Si ya vino, tocá la sugerencia.'}
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
                  canManage={canManageVehicles}
                  linkToTicket={canOpenLastWash}
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
                    label="Este carro no tiene responsable. ¿De quién es?"
                    optional
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
                  optional
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

        <Card className="min-w-0 gap-0 px-card">
          <fieldset className="min-w-0">
            <legend className="text-title text-text">Servicios</legend>
            <p className="text-text-faint text-dense mt-1">
              {bodyTypeId === ''
                ? 'Elegí primero el carro: el precio depende del tipo.'
                : canEditPrice
                  ? 'Tocá un rubro para abrirlo. Uno por rubro; los rubros se suman, y el precio se toca para descontar.'
                  : 'Tocá un rubro para abrirlo. Uno por rubro; los rubros se suman.'}
            </p>

            <div className="mt-4">
              {bodyTypeId === '' ? (
                <p className="text-text-dim text-body">Todavía no hay precio que mostrar.</p>
              ) : (
                <ServicePicker
                  services={services}
                  bodyTypeId={bodyTypeId}
                  value={selection}
                  onChange={setSelection}
                  canEditPrice={canEditPrice}
                  idPrefix="ticket"
                />
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
        customerName={customerNameOf(customer) || 'Sin responsable · opcional'}
        lines={lines.map((line) => ({ id: line.id, name: line.name, price: line.price }))}
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
