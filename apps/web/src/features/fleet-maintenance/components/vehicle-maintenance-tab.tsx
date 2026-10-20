'use client';

import { PERMISSIONS, RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';
import { List, Plus } from 'lucide-react';
import { useState } from 'react';

import { DetailSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useFleetVehicle } from '@/features/fleet/hooks/use-fleet';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { todayCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { monthRange } from '../care-history';
import { dialFocus, documentLight, taskLight, type CareLight } from '../care-lights';
import { useFleetExpenses, useMaintenanceStatus } from '../hooks/use-fleet-maintenance';
import { CareDashboard } from './care-dashboard';
import { CareHistoryDrawer } from './care-history-drawer';
import { DocumentRenewalDialog } from './document-renewal-dialog';
import { ExpenseEntryDialog } from './expense-entry-dialog';
import { ServiceEntryDialog } from './service-entry-dialog';

type Layer = { kind: 'expense' } | { kind: 'history' } | { kind: 'light'; light: CareLight };

/**
 * «Servicio y gastos» de un carro (122): el tablero con un testigo por tarea
 * del plan y por papel, y la barra con el gasto y el historial. El plan vive
 * en Ajustes de la renta (123).
 */
export function VehicleMaintenanceTab({ id }: { id: string }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const today = todayCivil();
  const vehicle = useFleetVehicle(id);
  const status = useMaintenanceStatus({ vehicleId: id });
  const settings = useRentalSettings();
  const month = useFleetExpenses({ vehicleId: id, ...monthRange(today), pageSize: 1 });
  const [layer, setLayer] = useState<Layer | null>(null);
  const close = () => setLayer(null);

  if (vehicle.isPending || status.isPending) {
    return <DetailSkeleton label="Cargando el tablero" />;
  }

  const failure = vehicle.error ?? status.error;

  if (failure !== null || vehicle.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {failure?.message ?? 'No se pudo cargar el carro.'}
      </p>
    );
  }

  const car = vehicle.data;
  const daysAlert = settings.data?.daysAlert ?? RENTAL_SETTINGS_DEFAULTS.daysAlert;
  const lights = [
    ...(status.data?.items[0]?.tasks ?? []).map(taskLight),
    documentLight('INSURANCE', car.insuranceExpiresAt, today, daysAlert),
    documentLight('REGISTRATION', car.registrationExpiresAt, today, daysAlert),
  ];
  const opened = layer?.kind === 'light' ? layer.light : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <Button type="button" variant="outline" onClick={() => setLayer({ kind: 'expense' })}>
            <Plus strokeWidth={1.5} aria-hidden="true" />
            Anotar un gasto
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setLayer({ kind: 'history' })}>
          <List strokeWidth={1.5} aria-hidden="true" />
          Historial ·{' '}
          <span className="font-mono tabular-nums">
            {formatMoney(month.data?.totalAmount ?? '0.00')}
          </span>{' '}
          este mes
        </Button>
      </div>

      <CareDashboard
        lights={lights}
        focus={dialFocus(lights)}
        odometerKm={car.odometerKm}
        onPick={canManage ? (light) => setLayer({ kind: 'light', light }) : undefined}
      />

      {layer?.kind === 'expense' ? <ExpenseEntryDialog vehicleId={id} onClose={close} /> : null}
      {layer?.kind === 'history' ? (
        <CareHistoryDrawer vehicleId={id} canManage={canManage} onClose={close} />
      ) : null}
      {opened?.taskId != null ? (
        <ServiceEntryDialog
          vehicleId={id}
          odometerKm={car.odometerKm}
          taskId={opened.taskId}
          onClose={close}
        />
      ) : null}
      {opened?.document != null ? (
        <DocumentRenewalDialog
          vehicleId={id}
          kind={opened.document}
          expiresAt={
            opened.document === 'INSURANCE' ? car.insuranceExpiresAt : car.registrationExpiresAt
          }
          onClose={close}
        />
      ) : null}
    </div>
  );
}
