'use client';

import type {
  Customer,
  CustomerMatch,
  PublicEmployee,
  ServiceDetail,
  VehicleBodyType,
} from '@elite/shared';
import { useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BodyTypePicker } from './body-type-card';
import {
  CustomerField,
  EMPTY_CUSTOMER,
  customerIsComplete,
  customerNameOf,
  type CustomerDraft,
} from './customer-field';
import { CustomerMatchDialog } from './customer-match-dialog';
import { TicketSummary } from './ticket-summary';

/**
 * Lo que el formulario devuelve. Las dos vistas lo mandan a su propia ruta.
 *
 * El cliente viaja de una de dos formas y nunca de las dos: `customerId` si se
 * eligió uno que ya existe —y entonces no se crea nadie ni se le pisa un dato
 * (004 RN-6)—, o `customer` si es alguien nuevo.
 */
export interface TicketFormValues {
  customerId?: string;
  customer?: { fullName: string; phone?: string };
  vehicle: { plate: string; bodyTypeId: string; make?: string; color?: string };
  items: { serviceId: string; unitPrice?: string }[];
  notes?: string;
  /** Solo lo manda la oficina, y es opcional: sin él, el lavador es «Oficina». */
  employeeId?: string;
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
 * La pantalla son dos columnas: a la izquierda las secciones —carro y cliente,
 * tipo, servicios, lavador, nota— y a la derecha el resumen fijo con el total y
 * el botón. Es un solo `<form>`: el botón del resumen es su `submit`.
 */
export function TicketForm({
  services,
  bodyTypes,
  employees,
  customerScope,
  searchCustomers,
  matchCustomer,
  isSubmitting,
  error,
  onSubmit,
}: {
  services: ServiceDetail[];
  bodyTypes: VehicleBodyType[];
  /** Si viene, se ofrece elegir lavador: es el alta de oficina (RN-8). */
  employees?: PublicEmployee[];
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
  const [employeeId, setEmployeeId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

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
      vehicle: {
        plate: plate.trim(),
        bodyTypeId,
        make: make.trim() || undefined,
        color: color.trim() || undefined,
      },
      items: selected.map((serviceId) => ({ serviceId })),
      notes: notes.trim() || undefined,
      employeeId: employeeId === '' ? undefined : employeeId,
    });
  }

  /**
   * Guardar. Con un cliente elegido va derecho; con uno nuevo se pregunta
   * primero si ya existe (RN-2).
   *
   * Si la comprobación falla —el API no contesta, la red se cayó— el lavado se
   * abre igual: preguntar «¿es el mismo?» es una cortesía, y el carro está
   * esperando. Un duplicado se arregla después; un carro sin anotar, no.
   */
  async function save(): Promise<void> {
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
      className="grid items-start gap-6 xl:grid-cols-[1fr_340px]"
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
            La placa y el cliente son los únicos obligatorios.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <FieldBox>
              <Label htmlFor="ticket-plate">Placa</Label>
              <Input
                id="ticket-plate"
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                className="font-mono tracking-[0.06em] [text-transform:uppercase]"
                placeholder="P000-000"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </FieldBox>
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
              <legend className="text-title text-text">Lavador</legend>
              <p className="text-text-faint text-dense mt-1">
                Si no elegís a nadie, el lavado queda a nombre de «Oficina».
              </p>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <Choice
                  label="Oficina"
                  selected={employeeId === ''}
                  onSelect={() => setEmployeeId('')}
                />
                {employees
                  .filter((employee) => employee.isActive)
                  .map((employee) => (
                    <Choice
                      key={employee.id}
                      label={employee.fullName}
                      selected={employeeId === employee.id}
                      onSelect={() => setEmployeeId(employee.id)}
                    />
                  ))}
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
