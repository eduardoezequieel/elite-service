'use client';

import { FLEET_STATUS_LABELS, FLEET_VEHICLE_STATUSES, fleetVehicleName } from '@elite/shared';
import type { FleetVehicle, FleetVehicleStatus } from '@elite/shared';
import { Wrench } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert } from '@/features/inventory/components/form-fields';
import { cn } from '@/lib/utils';
import { useUpdateFleetVehicle } from '../hooks/use-fleet';
import { FleetStatusStamp } from './fleet-status-stamp';

/** La acción más común desde cada estado (103): un toque, sin diálogo. */
const PRIMARY_ACTION: Record<FleetVehicleStatus, { to: FleetVehicleStatus; label: string }> = {
  ACTIVE: { to: 'IN_SHOP', label: 'Mandar a taller' },
  IN_SHOP: { to: 'ACTIVE', label: 'Volver a disponible' },
  RETIRED: { to: 'ACTIVE', label: 'Volver a la flota' },
};

const STATUS_HINTS: Record<FleetVehicleStatus, string> = {
  ACTIVE: 'Se puede rentar y aparece en «¿Qué hay libre?».',
  IN_SHOP: 'No se ofrece mientras esté en el taller.',
  RETIRED: 'Sale de la flota. Su historia y sus reportes se quedan.',
};

/**
 * El estado del carro en el encabezado de la ficha (103): la acción más
 * común a la vista y «Cambiar estado…» con los tres. Retirar pide
 * confirmación.
 */
export function FleetStatusActions({ vehicle }: { vehicle: FleetVehicle }) {
  const update = useUpdateFleetVehicle();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<'pick' | 'retire' | null>(null);
  const primary = PRIMARY_ACTION[vehicle.status];

  function moveTo(status: FleetVehicleStatus): void {
    if (status === vehicle.status) {
      setDialog(null);
      return;
    }
    if (status === 'RETIRED' && dialog !== 'retire') {
      setDialog('retire');
      return;
    }

    update.mutate(
      { id: vehicle.id, input: { status } },
      {
        onSuccess: () => {
          toast({ title: 'Estado cambiado', description: FLEET_STATUS_LABELS[status] });
          setDialog(null);
        },
      },
    );
  }

  const close = () => {
    update.reset();
    setDialog(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="max-sm:flex-1"
        loading={update.isPending && dialog === null}
        onClick={() => moveTo(primary.to)}
      >
        {primary.to === 'IN_SHOP' ? (
          <Wrench className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
        ) : null}
        {primary.label}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="max-sm:flex-1"
        onClick={() => setDialog('pick')}
      >
        Cambiar estado…
      </Button>
      {dialog === null && update.error ? (
        <p className="text-danger-text text-body basis-full" role="alert">
          {update.error.message}
        </p>
      ) : null}

      {dialog === 'pick' ? (
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar estado</DialogTitle>
              <DialogDescription>{fleetVehicleName(vehicle)}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-2.5">
              {FLEET_VEHICLE_STATUSES.map((status) => {
                const current = status === vehicle.status;

                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={current}
                    disabled={update.isPending}
                    onClick={() => moveTo(status)}
                    className={cn(
                      'border-line hover:border-flame flex min-h-(--touch-min) w-full items-start gap-3 rounded-row border px-3.5 py-3 text-left transition-colors duration-(--duration-state) ease-standard',
                      current && 'border-flame bg-surface-2',
                    )}
                  >
                    <FleetStatusStamp status={status} />
                    <span className="text-text-dim text-dense">
                      {STATUS_HINTS[status]}
                      {current ? (
                        <span className="text-text block font-semibold">Ahora</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
              <FormAlert message={update.error?.message ?? null} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog === 'retire' ? (
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Retirar este carro?</DialogTitle>
              <DialogDescription>{fleetVehicleName(vehicle)}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <p className="text-body">
                Deja de ofrecerse en rentas nuevas. Sus rentas, gastos y reportes se quedan, y se
                puede volver a la flota cuando quieras.
              </p>
              <FormAlert message={update.error?.message ?? null} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructiveSolid"
                loading={update.isPending}
                onClick={() => moveTo('RETIRED')}
              >
                Retirar de la flota
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
