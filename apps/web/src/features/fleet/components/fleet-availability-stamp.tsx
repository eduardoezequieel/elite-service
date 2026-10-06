import { VEHICLE_AVAILABILITY_LABELS } from '@elite/shared';
import type { FleetAlert, VehicleAvailability } from '@elite/shared';

import { Stamp, type StampTone } from '@/components/ui/stamp';

const TONES: Record<VehicleAvailability, StampTone> = {
  FREE: 'green',
  RENTED: 'washing',
  OVERDUE: 'red',
  RESERVED: 'blue',
  WORKSHOP: 'amber',
};

/** La palabra del día (110). Un carro retirado no tiene. */
export function FleetAvailabilityStamp({
  availability,
}: {
  availability: VehicleAvailability | null;
}) {
  if (availability === null) return null;

  return <Stamp label={VEHICLE_AVAILABILITY_LABELS[availability]} tone={TONES[availability]} />;
}

/** «1 aviso» o «N avisos». Rojo si alguno ya venció. */
export function FleetAlertsStamp({ alerts }: { alerts: readonly FleetAlert[] }) {
  if (alerts.length === 0) return null;

  const due = alerts.some((alert) => alert.level === 'DUE');

  return (
    <Stamp
      label={alerts.length === 1 ? '1 aviso' : `${alerts.length} avisos`}
      tone={due ? 'red' : 'amber'}
    />
  );
}
