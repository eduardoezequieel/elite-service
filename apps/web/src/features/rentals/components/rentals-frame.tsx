'use client';

import { PERMISSIONS } from '@elite/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAgreements } from '../hooks/use-agreements';
import { RENTALS_SECTIONS, rentalsSectionFor, type RentalsSection } from '../rentals-sections';

/**
 * El marco de la pestaña Rentas (117): el título, «Nueva renta» y los tabs
 * Libre, Rentas e Historial, cada uno con su URL. El tab Rentas lleva cuántas
 * van atrasadas, si hay.
 *
 * Lo monta una sola vez el layout de `app/(app)/rentals/(rents)/`, como el de
 * Ventas (106): cambiar de tab solo cambia el hijo. El permiso lo pide cada
 * página.
 */
export function RentalsFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const section = rentalsSectionFor(usePathname());
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const late = useAgreements(
    { late: true, pageSize: 1 },
    can(PERMISSIONS.rentals.actions.read.key),
  );
  const lateCount = late.data?.total ?? 0;

  return (
    <div>
      <ScreenHeader title="Rentas">
        {canManage ? (
          <Button asChild>
            <Link href="/rentals/agreements/new">
              <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
              Nueva renta
            </Link>
          </Button>
        ) : null}
      </ScreenHeader>

      <Tabs<RentalsSection>
        aria-label="Rentas"
        className="mb-5 [[data-density=bahia]_&]:[&_[role=tab]]:px-4.5 [[data-density=bahia]_&]:[&_[role=tab]]:text-(length:--lead-size)"
        value={section}
        onValueChange={(next) => {
          const target = RENTALS_SECTIONS.find((candidate) => candidate.value === next);
          if (target !== undefined && next !== section) router.push(target.href);
        }}
        items={RENTALS_SECTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          count: option.value === 'current' && lateCount > 0 ? lateCount : undefined,
        }))}
      />

      <div role="tabpanel" id={`tabpanel-${section}`} aria-labelledby={`tab-${section}`}>
        {children}
      </div>
    </div>
  );
}
