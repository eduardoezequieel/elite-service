'use client';

import {
  AVAILABILITY_LABELS,
  FLEET_CATEGORY_LABELS,
  FLEET_VEHICLE_CATEGORIES,
  PERMISSIONS,
  quoteText,
  rentalWhenLabel,
} from '@elite/shared';
import type { AvailabilityRow, FleetVehicleCategory } from '@elite/shared';
import { CalendarPlus, MessageCircle, SearchCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { addDays, todayCivil } from '@/lib/civil-date';
import { ALL_FILTER, isAll, withAllOption } from '@/lib/list-filters';
import { formatMoney } from '@/lib/money';
import { AVAILABILITY_TONES, vehicleTitle, whatsappHref } from '../agreement-format';
import { addDaysToField, civilAtTime, fieldToInstant } from '../datetime';
import { useAvailability } from '../hooks/use-agreements';
import { DateTimeField } from './rental-fields';

const CATEGORY_OPTIONS = withAllOption(
  'Todos los tipos',
  FLEET_VEHICLE_CATEGORIES.map((category) => ({
    value: category,
    label: FLEET_CATEGORY_LABELS[category],
  })),
);

/** Orden de las tarjetas: lo libre primero. */
const ORDER = { FREE: 0, FREE_IF_RETURNED: 1, BUSY: 2 } as const;

/**
 * ¿Qué hay libre? (096): un rango con hora y un tipo de carro; cada carro de
 * la flota con su disponibilidad, la tarifa para esos días y el total
 * estimado. Para cotizar por WhatsApp sin equivocarse, o reservar ahí mismo.
 */
export function AvailabilityScreen() {
  const { can, canAny } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const tomorrow = addDays(todayCivil(), 1);
  const [from, setFrom] = useState(civilAtTime(tomorrow, '09:00'));
  const [to, setTo] = useState(addDaysToField(civilAtTime(tomorrow, '09:00'), 3));
  const [category, setCategory] = useState(ALL_FILTER);

  const fromAt = fieldToInstant(from);
  const toAt = fieldToInstant(to);
  const valid = fromAt !== null && toAt !== null && toAt > fromAt;
  const availability = useAvailability(
    valid
      ? {
          from: fromAt,
          to: toAt,
          ...(isAll(category) ? {} : { category: category as FleetVehicleCategory }),
        }
      : null,
  );
  const rows = [...(availability.data ?? [])].sort(
    (left, right) => ORDER[left.availability] - ORDER[right.availability],
  );

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="¿Qué hay libre?"
        subtitle={
          availability.data
            ? `${availability.data.filter((row) => row.availability === 'FREE').length} libres de ${availability.data.length}`
            : ' '
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [[data-density=bahia]_&]:sm:grid-cols-2">
        <DateTimeField
          id="availability-from"
          label="Sale"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <DateTimeField
          id="availability-to"
          label="Regresa"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          error={
            fromAt !== null && toAt !== null && !valid
              ? 'El regreso tiene que ser después de la salida.'
              : undefined
          }
        />
        <Combobox
          id="availability-category"
          label="Tipo de carro"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
        />
      </div>

      {!valid ? (
        <p className="text-text-dim text-body">Elegí cuándo sale y cuándo regresa.</p>
      ) : availability.isPending ? (
        <ListSkeleton rows={4} label="Buscando qué hay libre" />
      ) : availability.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {availability.error.message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SearchCheck}
          title="No hay carros de ese tipo"
          description="Probá con otro tipo o cargá más carros en Flota."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.vehicle.id}>
              <AvailabilityCard
                row={row}
                from={fromAt}
                to={toAt}
                canManage={canManage}
                companyName={settings.data?.companyName ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AvailabilityCard({
  row,
  from,
  to,
  canManage,
  companyName,
}: {
  row: AvailabilityRow;
  from: string;
  to: string;
  canManage: boolean;
  companyName: string | null;
}) {
  const name = vehicleTitle(row.vehicle);
  const text = quoteText({
    vehicleName: name,
    from,
    to,
    billableDays: row.billableDays,
    dailyRate: row.dailyRate,
    total: row.estimatedTotal,
    companyName,
  });
  const reserveHref = `/rentals/agreements/new?${new URLSearchParams({
    vehicleId: row.vehicle.id,
    from,
    to,
  }).toString()}`;

  return (
    <Card className="h-full gap-3 px-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-title truncate">{name}</p>
          <p className="text-text-dim text-dense">{FLEET_CATEGORY_LABELS[row.vehicle.category]}</p>
        </div>
        <Stamp
          label={AVAILABILITY_LABELS[row.availability]}
          tone={AVAILABILITY_TONES[row.availability]}
        />
      </div>
      {row.vehicle.plate === null ? null : <PlateChip plate={row.vehicle.plate} />}

      {row.blocking === null ? null : (
        <p className="text-text-dim text-dense">
          {row.availability === 'FREE_IF_RETURNED'
            ? `${row.blocking.customerName} lo devuelve ${rentalWhenLabel(row.blocking.plannedReturnAt)}.`
            : `Lo tiene ${row.blocking.customerName} hasta ${rentalWhenLabel(row.blocking.plannedReturnAt)}.`}
        </p>
      )}

      <div className="flex items-end justify-between gap-3">
        <span className="text-text-dim text-body tabular-nums">
          {row.billableDays} {row.billableDays === 1 ? 'día' : 'días'} ×{' '}
          {formatMoney(row.dailyRate)}
        </span>
        <span className="text-figure tabular-nums">{formatMoney(row.estimatedTotal)}</span>
      </div>

      <div className="mt-auto flex flex-col gap-2 sm:flex-row [&>*]:flex-1">
        <Button asChild variant="outline">
          <a href={whatsappHref(null, text)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
            Cotizar por WhatsApp
          </a>
        </Button>
        {canManage && row.availability !== 'BUSY' ? (
          <Button asChild variant="outline">
            <Link href={reserveHref}>
              <CalendarPlus className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
              Reservar
            </Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
