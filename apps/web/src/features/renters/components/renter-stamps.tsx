import type { Renter } from '@elite/shared';

import { Stamp } from '@/components/ui/stamp';

/** «No rentar» si está bloqueado o inactivo (108). Un cliente al día no lleva sello. */
export function RenterStamps({ renter }: { renter: Pick<Renter, 'isBlocked' | 'isActive'> }) {
  if (renter.isBlocked || !renter.isActive) return <Stamp label="No rentar" tone="red" />;

  return null;
}
