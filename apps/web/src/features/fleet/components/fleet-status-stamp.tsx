import { FLEET_STATUS_LABELS } from '@elite/shared';
import type { FleetVehicleStatus } from '@elite/shared';

import { Stamp, type StampTone } from '@/components/ui/stamp';

const TONES: Record<FleetVehicleStatus, StampTone> = {
  ACTIVE: 'green',
  IN_SHOP: 'amber',
  RETIRED: 'neutral',
};

/**
 * El estado de inventario en la ficha (110): En taller o Retirado.
 * Un carro activo no lleva este sello: su palabra del día es «Libre».
 */
export function FleetStatusStamp({ status }: { status: FleetVehicleStatus }) {
  if (status === 'ACTIVE') return null;

  return <Stamp label={FLEET_STATUS_LABELS[status]} tone={TONES[status]} />;
}
