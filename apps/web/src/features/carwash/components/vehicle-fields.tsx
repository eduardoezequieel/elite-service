'use client';

import type {
  Customer,
  CustomerMatch,
  ServiceDetail,
  VehicleBodyType,
  VehicleWithOwner,
} from '@elite/shared';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { useCustomerVehicles, type ListCustomerVehicles } from '../hooks/use-customer-vehicles';
import { formatPlate } from '../hooks/use-vehicle-search';
import type { TicketFormInput, TicketFormOutput, VehicleStep } from '../ticket-draft';
import { BodyTypePicker } from './body-type-card';
import { TicketCustomerField } from './customer-fields';
import { IntakeField } from './intake-field';
import { KnownVehicleCard } from './known-vehicle-card';

/**
 * «El carro» del alta. **La placa primero** (040): se escribe, aparecen
 * sugerencias y se toca una. Cada paso de {@link VehicleStep} es una pieza:
 * la caja única, los carros de un cliente, el carro conocido o uno nuevo.
 *
 * Todo se elige tocando, nunca con un desplegable (RN-17): el tipo de carro es
 * un botón grande porque quien lo usa está de pie, con la tablet en una mano y
 * a veces con guantes.
 */
export function VehicleCard({
  step,
  query,
  onQueryChange,
  scope,
  searchCustomers,
  matchCustomer,
  listCustomerVehicles,
  bodyTypes,
  services,
  canManageVehicles,
  canOpenLastWash,
  onPickVehicle,
  onPickCustomer,
  onNewVehicle,
  onBack,
  onEditVehicle,
  onBodyTypeChange,
}: {
  step: VehicleStep;
  /** Lo tecleado en la caja única, antes de elegir nada. */
  query: string;
  onQueryChange: (next: string) => void;
  scope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
  matchCustomer: (fullName: string, phone?: string) => Promise<CustomerMatch | null>;
  listCustomerVehicles?: ListCustomerVehicles;
  bodyTypes: VehicleBodyType[];
  services: ServiceDetail[];
  canManageVehicles: boolean;
  canOpenLastWash: boolean;
  onPickVehicle: (vehicle: VehicleWithOwner) => void;
  onPickCustomer: (customer: Customer) => void;
  /** Anotar un carro que no está: recibe la placa tal como se tecleó. */
  onNewVehicle: (plate: string) => void;
  onBack: () => void;
  onEditVehicle: () => void;
  onBodyTypeChange: (bodyTypeId: string) => void;
}) {
  const settled = step.kind === 'known' || step.kind === 'new';

  return (
    <Card className="gap-0 px-card">
      <h2 className="text-title text-text">El carro</h2>
      <p className="text-text-faint text-dense mt-1">
        {settled
          ? 'La placa manda. El responsable es opcional.'
          : 'Escribí la placa. Si ya vino, tocá la sugerencia.'}
      </p>

      <div className="mt-4">
        {step.kind === 'choosing' ? (
          <ChooseVehicle
            customer={step.customer}
            scope={scope}
            listCustomerVehicles={listCustomerVehicles}
            onPick={onPickVehicle}
            onNew={() => onNewVehicle('')}
            onBack={onBack}
          />
        ) : step.kind === 'known' ? (
          <div className="flex flex-col gap-4">
            <KnownVehicleCard
              vehicle={step.vehicle}
              canManage={canManageVehicles}
              linkToTicket={canOpenLastWash}
              onEdit={onEditVehicle}
              onDeselect={onBack}
            />

            {step.vehicle.currentOwner ? null : (
              <TicketCustomerField
                scope={scope}
                searchCustomers={searchCustomers}
                matchCustomer={matchCustomer}
                label="Este carro no tiene responsable. ¿De quién es?"
              />
            )}
          </div>
        ) : step.kind === 'new' ? (
          <div className="flex flex-col gap-5">
            <NewVehicleFields
              bodyTypes={bodyTypes}
              services={services}
              onBack={onBack}
              onBodyTypeChange={onBodyTypeChange}
            />

            <TicketCustomerField
              scope={scope}
              searchCustomers={searchCustomers}
              matchCustomer={matchCustomer}
            />
          </div>
        ) : (
          <IntakeField
            value={query}
            onChange={onQueryChange}
            scope={scope}
            searchCustomers={searchCustomers}
            onPickVehicle={onPickVehicle}
            onPickCustomer={onPickCustomer}
            onNewVehicle={onNewVehicle}
          />
        )}
      </div>
    </Card>
  );
}

/**
 * Un carro que el sistema no conoce: placa, tipo y, si se piden, marca y
 * color. Se monta al entrar al paso, así que «Agregar marca y color» arranca
 * plegado cada vez.
 */
function NewVehicleFields({
  bodyTypes,
  services,
  onBack,
  onBodyTypeChange,
}: {
  bodyTypes: VehicleBodyType[];
  services: ServiceDetail[];
  onBack: () => void;
  onBodyTypeChange: (bodyTypeId: string) => void;
}) {
  const { control } = useFormContext<TicketFormInput, unknown, TicketFormOutput>();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="rounded-row border-(length:--selectable-border) border-[color-mix(in_oklab,var(--flame)_40%,var(--line))] bg-[color-mix(in_oklab,var(--flame)_6%,var(--surface-2))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Stamp label="Carro nuevo" tone="washing" pulse={false} />
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Buscar otra vez
        </Button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="plate"
          render={({ field }) => (
            <FormItem>
              <FieldBox>
                <Label htmlFor="ticket-plate">Placa</Label>
                <FormControl>
                  <Input
                    {...field}
                    id="ticket-plate"
                    onChange={(event) => field.onChange(formatPlate(event.target.value))}
                    className="font-mono tracking-[0.06em]"
                    placeholder="P000-000"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    enterKeyHint="next"
                    maxLength={10}
                  />
                </FormControl>
              </FieldBox>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <p className="text-text-faint text-label mt-5 mb-2">Tipo de vehículo</p>
      <FormField
        control={control}
        name="bodyTypeId"
        render={({ field }) => (
          <BodyTypePicker
            bodyTypes={bodyTypes}
            services={services}
            value={field.value}
            onChange={onBodyTypeChange}
          />
        )}
      />

      {showDetails ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FieldBox>
                  <Label htmlFor="ticket-make">Marca</Label>
                  <FormControl>
                    <Input
                      {...field}
                      id="ticket-make"
                      placeholder="Toyota, Nissan…"
                      autoComplete="off"
                    />
                  </FormControl>
                </FieldBox>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FieldBox>
                  <Label htmlFor="ticket-color">Color</Label>
                  <FormControl>
                    <Input
                      {...field}
                      id="ticket-color"
                      placeholder="Gris, blanco…"
                      autoComplete="off"
                    />
                  </FormControl>
                </FieldBox>
                <FormMessage />
              </FormItem>
            )}
          />
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
  );
}

/** Los carros de quien acaba de elegirse, cuando tiene más de uno (026). */
function ChooseVehicle({
  customer,
  scope,
  listCustomerVehicles,
  onPick,
  onNew,
  onBack,
}: {
  customer: Customer;
  scope: string;
  listCustomerVehicles?: ListCustomerVehicles;
  onPick: (vehicle: VehicleWithOwner) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const query = useCustomerVehicles(scope, customer.id, listCustomerVehicles);
  const vehicles = query.data ?? [];

  return (
    <div>
      <div className="border-line bg-surface-2 flex flex-wrap items-center gap-3 rounded-row border px-4 py-3">
        <p className="text-text text-dense min-w-0 flex-1">
          <span className="font-semibold">{customer.fullName}</span>
          {query.isPending
            ? ' · buscando sus carros…'
            : ` tiene ${vehicles.length} carros. ¿Cuál trajo?`}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Empezar de nuevo
        </Button>
      </div>

      {query.isPending ? null : (
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
