import { FLEET_STATUS_LABELS } from '@elite/shared';
import type { FleetVehicleStatus } from '@elite/shared';

import { Stamp, type StampTone } from '@/components/ui/stamp';

const TONES: Record<FleetVehicleStatus, StampTone> = {
  ACTIVE: 'green',
  IN_SHOP: 'amber',
  RETIRED: 'neutral',
};

/** El estado de un carro de la flota (095): Disponible, En taller o Retirado. */
export function FleetStatusStamp({ status }: { status: FleetVehicleStatus }) {
  return <Stamp label={FLEET_STATUS_LABELS[status]} tone={TONES[status]} />;
}
