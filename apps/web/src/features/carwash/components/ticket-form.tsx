'use client';

import type { PublicEmployee, ServiceDetail, VehicleBodyType } from '@elite/shared';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Lo que el formulario devuelve. Las dos vistas lo mandan a su propia ruta. */
export interface TicketFormValues {
  customer: { fullName: string; phone?: string };
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
 */
export function TicketForm({
  services,
  bodyTypes,
  employees,
  isSubmitting,
  error,
  onSubmit,
}: {
  services: ServiceDetail[];
  bodyTypes: VehicleBodyType[];
  /** Si viene, se ofrece elegir lavador: es el alta de oficina (RN-8). */
  employees?: PublicEmployee[];
  isSubmitting: boolean;
  error: ApiError | null;
  onSubmit: (values: TicketFormValues) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
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

  const total = useMemo(
    () =>
      services
        .filter((service) => selected.includes(service.id))
        .reduce((sum, service) => sum + Math.round(Number(priceOf(service)) * 100), 0),
    [services, selected, priceOf],
  );

  const complete = fullName.trim() !== '' && plate.trim() !== '' && bodyTypeId !== '' &&
    selected.length > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!complete) return;

        onSubmit({
          customer: { fullName: fullName.trim(), phone: phone.trim() || undefined },
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
      }}
    >
      <Card className="flex flex-col gap-3 p-plate">
        <p className="text-label text-muted-foreground">Cliente</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-customer">Nombre</Label>
            <Input
              id="ticket-customer"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-phone">Teléfono</Label>
            <Input
              id="ticket-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="off"
            />
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-plate">
        <p className="text-label text-muted-foreground">Carro</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-plate">Placa</Label>
            <Input
              id="ticket-plate"
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              className="font-mono"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-make">Marca</Label>
            <Input
              id="ticket-make"
              value={make}
              onChange={(event) => setMake(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-color">Color</Label>
            <Input
              id="ticket-color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-label text-muted-foreground mb-2">Tipo de carro</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {bodyTypes.map((bodyType) => (
              <Choice
                key={bodyType.id}
                label={bodyType.name}
                selected={bodyTypeId === bodyType.id}
                onSelect={() => setBodyTypeId(bodyType.id)}
              />
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="flex flex-col gap-2 p-plate">
        <p className="text-label text-muted-foreground">Servicios</p>
        {bodyTypeId === '' ? (
          <p className="text-muted-foreground text-body">
            Elegí primero el tipo de carro: el precio depende de eso.
          </p>
        ) : (
          <div className="grid gap-2">
            {services.map((service) => (
              <Choice
                key={service.id}
                label={service.name}
                detail={`$${priceOf(service)}`}
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

        {selected.length === 0 ? null : (
          <div className="border-rule mt-1 flex items-baseline justify-between border-t pt-2">
            <span className="text-label text-muted-foreground">Total</span>
            <span className="text-figure tabular-nums">
              ${(total / 100).toFixed(2)}
            </span>
          </div>
        )}
      </Card>

      {employees === undefined ? null : (
        <Card className="flex flex-col gap-2 p-plate">
          <p className="text-label text-muted-foreground">Lavador</p>
          <p className="text-muted-foreground text-dense">
            Si no elegís a nadie, el lavado queda a nombre de «Oficina».
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
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
        </Card>
      )}

      <Card className="flex flex-col gap-1.5 p-plate">
        <Label htmlFor="ticket-notes">Nota</Label>
        <Input
          id="ticket-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          autoComplete="off"
        />
      </Card>

      {error ? (
        <p className="text-stamp-red text-body" role="alert">
          {error.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={!complete || isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Abrir lavado'}
      </Button>
    </form>
  );
}

/**
 * Una opción que se toca. Alto mínimo `--touch-min`, y el estado elegido se
 * marca con filete y peso, no solo con color: el sistema no comunica un estado
 * únicamente con color.
 */
function Choice({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'min-h-(--touch-min) border-rule flex items-center justify-between gap-2 rounded-md border px-3',
        'text-body transition-colors duration-(--duration-state) ease-standard',
        selected ? 'border-brand text-foreground font-medium' : 'text-muted-foreground',
      )}
    >
      <span>{label}</span>
      {detail === undefined ? null : <span className="tabular-nums">{detail}</span>}
    </button>
  );
}
