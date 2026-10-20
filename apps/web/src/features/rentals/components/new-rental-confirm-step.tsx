'use client';

import { centsToMoney, fleetVehicleName, moneyToCents, rentalWhenLabel } from '@elite/shared';
import type { AvailabilityRow } from '@elite/shared';
import { CalendarDays, KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { FleetCarImage } from '@/features/fleet/components/fleet-car-image';
import { formatMoney, formatMoneyCompact } from '@/lib/money';

import { fieldToInstant } from '../datetime';
import {
  typedCents,
  type NewRentalMoney,
  type NewRentalStep,
  type NewRentalValues,
} from '../new-rental';
import { StepLabel } from './new-rental-car-step';
import { OptionButton } from './new-rental-contract-step';

export type NewRentalMode = 'deliver' | 'reserve';

function whenOf(field: string): string {
  const instant = fieldToInstant(field);

  return instant === null ? field : rentalWhenLabel(instant);
}

/**
 * Paso 4 · Confirmar (118): el carro con su imagen, cada dato con «Cambiar»,
 * el desglose y, si sale hoy, si se lo lleva ahora o solo se aparta.
 */
export function NewRentalConfirmStep({
  row,
  values,
  customerName,
  money,
  leavesToday,
  mode,
  onMode,
  onGoto,
}: {
  row: AvailabilityRow;
  values: NewRentalValues;
  customerName: string;
  money: NewRentalMoney;
  leavesToday: boolean;
  mode: NewRentalMode;
  onMode: (mode: NewRentalMode) => void;
  onGoto: (step: NewRentalStep) => void;
}) {
  const { vehicle } = row;
  const days = row.billableDays;
  const daysText = `${days} ${days === 1 ? 'día' : 'días'}`;
  const lines: [string, string, boolean][] = [
    [
      `${daysText} × ${formatMoneyCompact(row.dailyRate)}`,
      centsToMoney(moneyToCents(row.dailyRate) * days),
      false,
    ],
  ];
  if (moneyToCents(money.cdwPerDay) > 0) {
    lines.push([
      `Cobertura, ${days} × ${formatMoneyCompact(money.cdwPerDay)}`,
      centsToMoney(moneyToCents(money.cdwPerDay) * days),
      false,
    ]);
  }
  if (moneyToCents(money.discount) > 0) lines.push(['Descuento', money.discount, true]);
  const driver = values.hasAdditionalDriver ? values.driverName.trim() : '';

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="bg-surface-2 mb-2 flex items-center gap-4 rounded-card p-3">
          <FleetCarImage
            vehicle={vehicle}
            className="h-20 w-36 shrink-0 [[data-density=bahia]_&]:h-25 [[data-density=bahia]_&]:w-45"
          />
          <div className="min-w-0">
            <p className="font-display text-text mb-1.5 text-(length:--stat-name-size) leading-tight font-bold italic">
              {fleetVehicleName(vehicle)}
            </p>
            {vehicle.plate === null ? null : <PlateChip plate={vehicle.plate} size="sm" />}
          </div>
        </div>

        <SummaryRow label="Fechas" onChange={() => onGoto(1)}>
          <span className="tabular-nums">
            {whenOf(values.plannedPickupAt)} → {whenOf(values.plannedReturnAt)}
          </span>
        </SummaryRow>
        <SummaryRow label="Cliente" onChange={() => onGoto(2)}>
          <b>{customerName}</b>
        </SummaryRow>
        <SummaryRow label="Si choca" onChange={() => onGoto(3)}>
          {values.insurance
            ? `Paga hasta ${formatMoneyCompact(centsToMoney(typedCents(values.deductible) ?? 0))}`
            : 'Paga todos los daños'}
        </SummaryRow>
        {driver === '' ? null : (
          <SummaryRow label="Conductor" onChange={() => onGoto(3)}>
            {driver}
          </SummaryRow>
        )}

        <dl className="text-text-dim mt-3 flex flex-col gap-1.5">
          {lines.map(([label, amount, negative]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt>{label}</dt>
              <dd className="font-mono tabular-nums">
                {negative ? '−' : ''}
                {formatMoney(amount)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {leavesToday ? (
        <div>
          <StepLabel>¿Se lleva el carro ahora?</StepLabel>
          <div className="grid grid-cols-2 gap-2">
            <OptionButton
              pressed={mode === 'deliver'}
              className="min-h-16 justify-start gap-3 px-4 py-2.5 text-left"
              onClick={() => onMode('deliver')}
            >
              <KeyRound
                className="text-flame-text size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="flex flex-col">
                <span>Sí, ahora</span>
                <span className="text-text-dim text-dense font-medium">Entrega y cobro</span>
              </span>
            </OptionButton>
            <OptionButton
              pressed={mode === 'reserve'}
              className="min-h-16 justify-start gap-3 px-4 py-2.5 text-left"
              onClick={() => onMode('reserve')}
            >
              <CalendarDays
                className="text-flame-text size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="flex flex-col">
                <span>No, solo apartar</span>
                <span className="text-text-dim text-dense font-medium">Se entrega después</span>
              </span>
            </OptionButton>
          </div>
        </div>
      ) : (
        <div className="tint text-info-text flex items-center gap-3 rounded-control border px-4 py-3">
          <CalendarDays className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="flex flex-col">
            <b className="text-text">Se aparta el carro</b>
            <span className="text-text-dim text-dense">Sale {whenOf(values.plannedPickupAt)}</span>
          </span>
        </div>
      )}
    </>
  );
}

function SummaryRow({
  label,
  onChange,
  children,
}: {
  label: string;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-line-soft flex min-h-(--touch-min) items-center gap-3 border-b py-1.5">
      <span className="text-text-dim w-24 shrink-0 text-dense">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onChange}>
        Cambiar
      </Button>
    </div>
  );
}
