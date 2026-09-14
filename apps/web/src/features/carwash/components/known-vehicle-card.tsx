'use client';

import type { LastWash, VehicleWithOwner } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';

export function KnownVehicleCard({
  vehicle,
  canManage = false,
  onEdit,
  onDeselect,
}: {
  vehicle: VehicleWithOwner;
  canManage?: boolean;
  onEdit?: () => void;
  onDeselect: () => void;
}) {
  const makeAndColor = [vehicle.make, vehicle.color].filter(Boolean).join(' · ');
  const notes = vehicle.lastWash?.notes?.trim() ?? '';

  return (
    <div className="rounded-row border-[1.5px] border-[color-mix(in_oklab,var(--go)_40%,var(--line))] bg-[color-mix(in_oklab,var(--go)_8%,var(--surface-2))] p-4 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <PlateChip plate={vehicle.plate} />
          <Stamp label="Ya lo conocemos" tone="queue" />
        </div>

        <div className="flex items-center gap-2">
          {canManage && onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Cambiar datos
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onDeselect}>
            No es este carro
          </Button>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2 text-dense">
        <div>
          <span className="text-text-faint text-label block">Tipo de vehículo</span>
          <span className="text-text font-semibold">{vehicle.bodyType.name}</span>
        </div>

        <div>
          <span className="text-text-faint text-label block">Marca y color</span>
          <span className="text-text font-semibold">
            {makeAndColor !== '' ? makeAndColor : 'Sin especificar'}
          </span>
        </div>

        <div>
          <span className="text-text-faint text-label block">Responsable</span>
          <span className="text-text font-semibold">
            {vehicle.currentOwner
              ? `${vehicle.currentOwner.fullName}${vehicle.currentOwner.phone ? ` · ${vehicle.currentOwner.phone}` : ''}`
              : 'Sin responsable'}
          </span>
        </div>
      </div>

      <div className={cn('mt-3.5 grid gap-3 text-dense', notes !== '' && 'sm:grid-cols-2')}>
        <div>
          <span className="text-text-faint text-label block">Último lavado</span>
          <span className="text-text font-semibold">{lastWashLabel(vehicle.lastWash)}</span>
        </div>

        {notes !== '' ? (
          <div>
            <span className="text-text-faint text-label block">Nota</span>
            <span className="text-text whitespace-pre-wrap font-semibold">{notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** «12 ago · Lavado + aspirado»: cuándo vino y qué le hicieron. */
function lastWashLabel(lastWash: LastWash | null): string {
  if (lastWash === null) return 'Primer lavado registrado';

  const date = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short' }).format(
    new Date(lastWash.createdAt),
  );

  return lastWash.serviceName ? `${date} · ${lastWash.serviceName}` : date;
}
