'use client';

import type { Customer, CustomerMatch, ServiceDetail, VehicleBodyType, VehicleWithOwner } from '@elite/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { listFloorTickets } from '@/features/floor/api';
import { listTickets, updateVehicle } from '../api';
import { formatPlate, normalizePlate, useVehicleSearch } from '../hooks/use-vehicle-search';
import { BodyTypePicker } from './body-type-card';
import {
  CustomerField,
  EMPTY_CUSTOMER,
  customerIsComplete,
  customerNameOf,
  type CustomerDraft,
} from './customer-field';
import { CustomerMatchDialog } from './customer-match-dialog';
import { KnownVehicleCard } from './known-vehicle-card';
import { TicketSummary } from './ticket-summary';
import { VehicleChangeDialog, type VehicleChangesSubmission } from './vehicle-change-dialog';
import { WashersField, type WasherOption } from './washers-field';

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
  /**
   * Quienes lavaron, sin quien abre si va en `lockedWasherIds`. La pista manda
   * extras; la oficina manda el conjunto entero (vacío = «Oficina»).
   */
  washerIds?: string[];
}

/**
 * Alta de un lavado. Misma ficha en pista y en oficina (RN-7).
 *
 * Todo se elige tocando, nunca con un desplegable (RN-17): el tipo de carro y
 * los servicios son botones grandes porque quien los usa está de pie, con la
 * tablet en una mano y a veces con guantes. Un `<select>` en esa situación es
 * una trampa.
 *
 * El precio de cada servicio se muestra **ya resuelto para el tipo de carro
 * elegido** (RN-2): el lavador no tiene que saber que existe una matriz, solo
 * ve cuánto cuesta este servicio para este carro.
 *
 * Al escribir la placa, busca vehículos conocidos con debounce de 250ms (012).
 * Si ya se conoce, muestra la lámina «Ya lo conocemos» con marca y color como
 * texto plano sin caja.
 */
export function TicketForm({
  services,
  bodyTypes,
  employees,
  lockedWasherIds,
  allowEmptyWashers = true,
  customerScope,
  searchCustomers,
  matchCustomer,
  isSubmitting,
  error,
  onSubmit,
}: {
  services: ServiceDetail[];
  bodyTypes: VehicleBodyType[];
  /** Si viene, se ofrece elegir quiénes lavaron (009). */
  employees?: WasherOption[];
  /** En el alta de pista, quien abre ya está marcado y no se saca. */
  lockedWasherIds?: string[];
  /** Oficina admite conjunto vacío. La pista no. */
  allowEmptyWashers?: boolean;
  /** De qué API salen los clientes: `carwash` en oficina, `floor` en la pista. */
  customerScope: string;
  /** Las sugerencias mientras se escribe (RN-3). */
  searchCustomers: (query: string) => Promise<Customer[]>;
  /** ¿Ya existe alguien así? Se pregunta al guardar, no antes (RN-2). */
  matchCustomer: (fullName: string, phone?: string) => Promise<CustomerMatch | null>;
  isSubmitting: boolean;
  error: ApiError | null;
  onSubmit: (values: TicketFormValues) => void;
}) {
  const [customer, setCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [pendingMatch, setPendingMatch] = useState<CustomerMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [plate, setPlate] = useState('');
  const [bodyTypeId, setBodyTypeId] = useState('');
  const [make, setMake] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [washerIds, setWasherIds] = useState<string[]>(lockedWasherIds ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithOwner | null>(null);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  const ignoredVehicleIdRef = useRef<string | null>(null);

  const { can } = usePermissions();
  const canManageVehicles = customerScope !== 'floor' && can('vehicles.manage');

  const {
    vehicles: searchResults,
    exactMatch,
    tooShort,
  } = useVehicleSearch(customerScope, plate, selectedVehicle === null);

  function selectVehicle(v: VehicleWithOwner): void {
    setSelectedVehicle(v);
    setPlate(v.plate);
    setBodyTypeId(v.bodyType.id);
    setMake(v.make ?? '');
    setColor(v.color ?? '');
    if (v.currentOwner) {
      setCustomer({ kind: 'chosen', customer: v.currentOwner });
    }
  }

  function handleDeselectVehicle(): void {
    if (selectedVehicle) {
      ignoredVehicleIdRef.current = selectedVehicle.id;
    }
    setSelectedVehicle(null);
  }

  function handlePlateChange(value: string): void {
    const formatted = formatPlate(value);
    setPlate(formatted);
    ignoredVehicleIdRef.current = null;
    if (selectedVehicle && normalizePlate(selectedVehicle.plate) !== normalizePlate(formatted)) {
      setSelectedVehicle(null);
    }
  }

  useEffect(() => {
    if (
      exactMatch &&
      selectedVehicle?.id !== exactMatch.id &&
      ignoredVehicleIdRef.current !== exactMatch.id
    ) {
      selectVehicle(exactMatch);
    }
  }, [exactMatch, selectedVehicle]);

  useEffect(() => {
    if (
      error &&
      (error.code === 'VEHICLE_PLATE_EXISTS' ||
        (error.details as { vehicle?: VehicleWithOwner })?.vehicle)
    ) {
      const existing = (error.details as { vehicle?: VehicleWithOwner })?.vehicle;
      if (existing) {
        selectVehicle(existing);
        if (canManageVehicles) {
          setChangeDialogOpen(true);
        }
      }
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
          if (tickets.length > 0 && tickets[0]) {
            const date = new Intl.DateTimeFormat('es-SV', {
              day: 'numeric',
              month: 'short',
            }).format(new Date(tickets[0].createdAt));
            const srv = tickets[0].items[0]?.serviceName;
            return srv ? `${date} · ${srv}` : date;
          }
        } else if (selectedVehicle.currentOwner?.id) {
          const tickets = await listTickets({ customerId: selectedVehicle.currentOwner.id });
          const match = tickets.find((t) => t.vehicle?.id === selectedVehicle.id) ?? tickets[0];
          if (match) {
            const date = new Intl.DateTimeFormat('es-SV', {
              day: 'numeric',
              month: 'short',
            }).format(new Date(match.createdAt));
            const srv = match.items[0]?.serviceName;
            return srv ? `${date} · ${srv}` : date;
          }
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
        if (matched?.customer) {
          ownerId = matched.customer.id;
        }
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
      if (updated.currentOwner) {
        setCustomer({ kind: 'chosen', customer: updated.currentOwner });
      }
      setChangeDialogOpen(false);
    } catch {
      // Si falla la mutacion, se queda abierto el dialogo
    } finally {
      setIsUpdatingVehicle(false);
    }
  }

  function handleWrongPlate(): void {
    setChangeDialogOpen(false);
    setSelectedVehicle(null);
    setPlate('');
  }

  /** Precio de cada servicio para el carro elegido: la matriz gana al base (RN-2). */
  const priceOf = useMemo(
    () =>
      (service: ServiceDetail): string =>
        service.prices.find((price) => price.bodyTypeId === bodyTypeId)?.price ??
        service.defaultPrice,
    [bodyTypeId],
  );

  const chosen = useMemo(
    () => services.filter((service) => selected.includes(service.id)),
    [services, selected],
  );

  const total = useMemo(
    () => chosen.reduce((sum, service) => sum + Math.round(Number(priceOf(service)) * 100), 0),
    [chosen, priceOf],
  );

  const complete =
    customerIsComplete(customer) && plate.trim() !== '' && bodyTypeId !== '' && selected.length > 0;

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
      items: selected.map((serviceId) => ({ serviceId })),
      notes: notes.trim() || undefined,
      washerIds: extrasOf(washerIds, lockedWasherIds ?? []),
    });
  }

  /**
   * Guardar. Con un cliente elegido va derecho; con uno nuevo se pregunta
   * primero si ya existe (RN-2).
   *
   * Si la placa pertenece a otro cliente y el usuario puede administrar
   * vehículos, se pregunta si cambió de dueño o si se equivocó de placa.
   */
  async function save(): Promise<void> {
    if (selectedVehicle && selectedVehicle.currentOwner) {
      const isOwnerDifferent =
        customer.kind === 'new' ||
        (customer.kind === 'chosen' && customer.customer.id !== selectedVehicle.currentOwner.id);

      if (isOwnerDifferent && canManageVehicles) {
        setChangeDialogOpen(true);
        return;
      }
    }

    if (customer.kind === 'chosen') {
      submitWith({ customerId: customer.customer.id });
      return;
    }

    if (customer.kind !== 'new') return;

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
          <h2 className="text-title text-text">Carro y cliente</h2>
          <p className="text-text-faint text-dense mt-1">
            Placa, cliente, tipo de carro y servicio son obligatorios.
          </p>

          <div className="mt-4">
            <FieldBox>
              <Label htmlFor="ticket-plate">Placa</Label>
              <Input
                id="ticket-plate"
                value={plate}
                onChange={(event) => handlePlateChange(event.target.value)}
                className="font-mono tracking-[0.06em]"
                placeholder="P000-000"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </FieldBox>

            {!tooShort && selectedVehicle === null && searchResults.length > 0 && !exactMatch ? (
              <div className="border-line bg-surface-2 mt-2 divide-line-soft divide-y rounded-row border overflow-hidden">
                <div className="bg-surface-3 px-3 py-1.5 text-label text-text-faint">
                  Vehículos encontrados ({searchResults.length})
                </div>
                {searchResults.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVehicle(v)}
                    className="hover:bg-surface flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <PlateChip plate={v.plate} />
                      <span className="text-dense text-text truncate font-semibold">
                        {v.bodyType.name}
                        {[v.make, v.color].filter(Boolean).length > 0
                          ? ` · ${[v.make, v.color].filter(Boolean).join(' · ')}`
                          : ''}
                      </span>
                    </div>
                    <span className="text-dense text-text-dim shrink-0">
                      {v.currentOwner?.fullName ?? 'Sin dueño'}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {selectedVehicle ? (
            <div className="mt-4">
              <KnownVehicleCard
                vehicle={selectedVehicle}
                lastWashDate={lastWashQuery.data}
                canManage={canManageVehicles}
                onEdit={() => setChangeDialogOpen(true)}
                onDeselect={handleDeselectVehicle}
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FieldBox>
                <Label htmlFor="ticket-make">Marca</Label>
                <Input
                  id="ticket-make"
                  value={make}
                  onChange={(event) => setMake(event.target.value)}
                  autoComplete="off"
                />
              </FieldBox>
              <FieldBox>
                <Label htmlFor="ticket-color">Color</Label>
                <Input
                  id="ticket-color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  autoComplete="off"
                />
              </FieldBox>
            </div>
          )}

          {/* El cliente se busca antes de escribirse: el que ya existe se elige
              de un toque y no se vuelve a dar de alta (004). */}
          <div className="border-line-soft mt-5 border-t pt-5">
            <CustomerField
              value={customer}
              onChange={setCustomer}
              scope={customerScope}
              searchCustomers={searchCustomers}
            />
          </div>
        </Card>

        <Card className="gap-0 px-card">
          <fieldset className="min-w-0">
            <legend className="text-title text-text">Tipo de vehículo</legend>
            <p className="text-text-faint text-dense mt-1">
              ¿No sabes cuál es? Elige el más parecido, en caja lo confirmamos.
            </p>

            <div className="mt-4">
              <BodyTypePicker
                bodyTypes={bodyTypes}
                services={services}
                value={bodyTypeId}
                onChange={setBodyTypeId}
              />
            </div>
          </fieldset>
        </Card>

        <Card className="gap-0 px-card">
          <fieldset className="min-w-0">
            <legend className="text-title text-text">Servicios</legend>

            <div className="mt-4">
              {bodyTypeId === '' ? (
                <p className="text-text-dim text-body">
                  Elegí primero el tipo de carro: el precio depende de eso.
                </p>
              ) : (
                <div className="grid gap-2.5">
                  {services.map((service) => (
                    <Choice
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
              )}
            </div>
          </fieldset>
        </Card>

        {employees === undefined ? null : (
          <Card className="gap-0 px-card">
            <fieldset className="min-w-0">
              <legend className="text-title text-text">Lavaron</legend>
              <p className="text-text-faint text-dense mt-1">
                {allowEmptyWashers
                  ? 'Si no elegís a nadie, el lavado queda a nombre de «Oficina».'
                  : 'Vos ya estás. Sumá a quien más lavó este carro.'}
              </p>

              <div className="mt-4">
                <WashersField
                  employees={employees}
                  value={washerIds}
                  onChange={setWasherIds}
                  lockedIds={lockedWasherIds}
                  allowEmpty={allowEmptyWashers}
                />
              </div>
            </fieldset>
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
        lines={chosen.map((service) => ({
          id: service.id,
          name: service.name,
          price: priceOf(service),
        }))}
        total={total}
        isSubmitting={isSubmitting || checking}
        canSubmit={complete}
        errorMessage={error?.message}
        hasBottomRail={customerScope === 'carwash'}
      />

      {/* «¿Es el mismo?»: solo aparece cuando el API encontró a alguien
          parecido y no se había elegido de la lista (RN-2). */}
      <CustomerMatchDialog
        match={pendingMatch}
        onUseExisting={() => {
          const existing = pendingMatch?.customer;

          setPendingMatch(null);

          if (existing === undefined) return;

          setCustomer({ kind: 'chosen', customer: existing });
          submitWith({ customerId: existing.id });
        }}
        onCreateAnother={() => {
          setPendingMatch(null);

          if (customer.kind !== 'new') return;

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

/**
 * Una opción que se toca: una lámina con su radio dibujado a la izquierda.
 *
 * Alto mínimo `--touch-min`, y el estado elegido se marca con filete, tinte y
 * el punto del radio, no solo con color: el sistema no comunica un estado
 * únicamente con color. Sigue siendo un botón con `aria-pressed`, porque
 * servicios es multiselección y lavador no cambia su semántica.
 */
function extrasOf(selected: readonly string[], locked: readonly string[]): string[] | undefined {
  const extras = selected.filter((id) => !locked.includes(id));

  return extras.length === 0 && locked.length > 0 ? undefined : extras;
}

function Choice({
  label,
  code,
  price,
  selected,
  onSelect,
}: {
  label: string;
  /** El código del catálogo (`SRV-0001`), debajo del nombre. */
  code?: string;
  /** El precio ya resuelto para el tipo de carro elegido. */
  price?: string;
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
        {code === undefined ? null : (
          <span className="text-text-faint block font-mono text-label font-normal">{code}</span>
        )}
      </span>

      {price === undefined ? null : (
        <span className="text-text ml-auto font-mono text-body font-bold tabular-nums">
          {price}
        </span>
      )}
    </button>
  );
}
