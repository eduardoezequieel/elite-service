'use client';

import { FLEET_CATEGORY_LABELS, FLEET_STATUS_LABELS, PERMISSIONS } from '@elite/shared';
import type { FleetVehicle, FleetVehicleStatus } from '@elite/shared';
import type { ReactNode } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailField } from '@/components/ui/detail-field';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { formatCivil, todayCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { useFleetVehicle, useUpdateFleetVehicle } from '../hooks/use-fleet';
import { upcomingExpiries } from '../vehicle-form';
import { FleetExpiries } from './fleet-expiries';

const DEFAULT_DAYS_ALERT = 7;

/** A dónde se puede mover un carro desde su estado, con el verbo del botón. */
const STATUS_ACTIONS: Record<FleetVehicleStatus, { to: FleetVehicleStatus; label: string }[]> = {
  ACTIVE: [
    { to: 'IN_SHOP', label: 'Mandar a taller' },
    { to: 'RETIRED', label: 'Retirar de la flota' },
  ],
  IN_SHOP: [
    { to: 'ACTIVE', label: 'Volver a disponible' },
    { to: 'RETIRED', label: 'Retirar de la flota' },
  ],
  RETIRED: [{ to: 'ACTIVE', label: 'Volver a la flota' }],
};

const money = (amount: string | null) => (amount === null ? '—' : formatMoney(amount));
const date = (civil: string | null) => (civil === null ? '—' : formatCivil(civil));
const amount = (value: number | null, unit: string) =>
  value === null ? '—' : `${value.toLocaleString('es-SV')} ${unit}`;

/** Una tarjeta de datos de la ficha: título y campos en rejilla. */
function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading>{title}</CardSectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [[data-density=bahia]_&]:xl:grid-cols-2">
        {children}
      </div>
    </Card>
  );
}

/**
 * La pestaña Ficha de un carro (095): tarifas, compra, costos fijos,
 * vencimientos y el cambio de estado. Lee el mismo carro que el marco: la
 * consulta es una sola en caché.
 */
export function FleetVehicleDetail({ id }: { id: string }) {
  const vehicle = useFleetVehicle(id);

  if (vehicle.data === undefined) return null;

  return <Detail vehicle={vehicle.data} />;
}

function Detail({ vehicle }: { vehicle: FleetVehicle }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const settings = useRentalSettings();
  const update = useUpdateFleetVehicle();
  const { toast } = useToast();
  const expiries = upcomingExpiries(
    vehicle,
    todayCivil(),
    settings.data?.daysAlert ?? DEFAULT_DAYS_ALERT,
  );

  function moveTo(status: FleetVehicleStatus): void {
    update.mutate(
      { id: vehicle.id, input: { status } },
      {
        onSuccess: () =>
          toast({ title: 'Estado cambiado', description: FLEET_STATUS_LABELS[status] }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <Card className="gap-3 px-card">
          <CardSectionHeading aside={FLEET_STATUS_LABELS[vehicle.status]}>
            Estado
          </CardSectionHeading>
          <div className="flex flex-wrap gap-2.5">
            {STATUS_ACTIONS[vehicle.status].map((action) => (
              <Button
                key={action.to}
                type="button"
                variant={action.to === 'RETIRED' ? 'destructive' : 'outline'}
                className="max-sm:w-full"
                disabled={update.isPending}
                onClick={() => moveTo(action.to)}
              >
                {action.label}
              </Button>
            ))}
          </div>
          {update.error ? (
            <p className="text-danger-text text-body" role="alert">
              {update.error.message}
            </p>
          ) : null}
        </Card>
      ) : null}

      <DetailCard title="Tarifas y km">
        <DetailField label="Tipo">{FLEET_CATEGORY_LABELS[vehicle.category]}</DetailField>
        <DetailField label="Tarifa diaria">
          <span className="font-mono font-semibold">{money(vehicle.dailyRate)}</span>
        </DetailField>
        <DetailField label="Por día, 7+ días">
          <span className="font-mono">{money(vehicle.weeklyRate)}</span>
        </DetailField>
        <DetailField label="Por día, 30+ días">
          <span className="font-mono">{money(vehicle.monthlyRate)}</span>
        </DetailField>
        <DetailField label="Km libres por día">
          {vehicle.freeKmPerDay === null || vehicle.freeKmPerDay === 0
            ? 'Ilimitado'
            : amount(vehicle.freeKmPerDay, 'km')}
        </DetailField>
        <DetailField label="Km adicional">
          <span className="font-mono">{money(vehicle.extraKmPrice)}</span>
        </DetailField>
        <DetailField label="Kilometraje actual">
          <span className="font-mono">{amount(vehicle.odometerKm, 'km')}</span>
        </DetailField>
        <DetailField label="Color">{vehicle.color ?? '—'}</DetailField>
      </DetailCard>

      <DetailCard title="Compra y financiamiento">
        <DetailField label="Precio de compra">
          <span className="font-mono">{money(vehicle.purchasePrice)}</span>
        </DetailField>
        <DetailField label="Fecha de compra">{date(vehicle.purchasedAt)}</DetailField>
        <DetailField label="Financiado">{vehicle.financed ? 'Sí' : 'No'}</DetailField>
        {vehicle.financed ? (
          <>
            <DetailField label="Prima">
              <span className="font-mono">{money(vehicle.downPayment)}</span>
            </DetailField>
            <DetailField label="Cuota mensual">
              <span className="font-mono">{money(vehicle.installment)}</span>
            </DetailField>
            <DetailField label="Plazo">{amount(vehicle.termMonths, 'meses')}</DetailField>
            <DetailField label="Inicio del financiamiento">
              {date(vehicle.financingStartedAt)}
            </DetailField>
          </>
        ) : null}
      </DetailCard>

      <DetailCard title="Costos fijos mensuales">
        <DetailField label="Seguro">
          <span className="font-mono">{money(vehicle.insuranceMonthly)}</span>
        </DetailField>
        <DetailField label="GPS">
          <span className="font-mono">{money(vehicle.gpsMonthly)}</span>
        </DetailField>
        <DetailField label="Otros fijos">
          <span className="font-mono">{money(vehicle.otherFixedMonthly)}</span>
        </DetailField>
      </DetailCard>

      <DetailCard title="Vencimientos">
        <DetailField label="Seguro">{date(vehicle.insuranceExpiresAt)}</DetailField>
        <DetailField label="Tarjeta de circulación">
          {date(vehicle.registrationExpiresAt)}
        </DetailField>
        <DetailField label="Avisos">
          <FleetExpiries expiries={expiries} />
        </DetailField>
      </DetailCard>

      {vehicle.notes === null ? null : (
        <Card className="gap-3 px-card">
          <CardSectionHeading>Notas</CardSectionHeading>
          <p className="text-body whitespace-pre-line">{vehicle.notes}</p>
        </Card>
      )}
    </div>
  );
}
