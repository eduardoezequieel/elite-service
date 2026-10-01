import type { Renter } from '@elite/shared';

import { Stamp } from '@/components/ui/stamp';

/** «No rentar» e «Inactivo» de un cliente de renta (095); un cliente al día no lleva chip. */
export function RenterStamps({ renter }: { renter: Pick<Renter, 'isBlocked' | 'isActive'> }) {
  if (!renter.isBlocked && renter.isActive) return <Stamp label="Activo" tone="green" />;

  return (
    <span className="flex flex-wrap gap-1.5">
      {renter.isBlocked ? <Stamp label="No rentar" tone="red" /> : null}
      {renter.isActive ? null : <Stamp label="Inactivo" tone="neutral" />}
    </span>
  );
}
