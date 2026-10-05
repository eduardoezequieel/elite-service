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
import { useTabsSummary } from '@/features/tabs/hooks/use-tabs';
import { salesSectionFor, type SalesSection } from '../list-params';

const SECTIONS: readonly { value: SalesSection; label: string; href: string }[] = [
  { value: 'day', label: 'Ventas del día', href: '/sales' },
  { value: 'tabs', label: 'Cuentas abiertas', href: '/sales/tabs' },
];

/**
 * El marco de Ventas (105): la cabecera con «Nueva venta» y las pestañas
 * «Ventas del día» y «Cuentas abiertas», con cuántas cuentas hay abiertas.
 *
 * Lo monta una sola vez el layout de `app/(app)/sales/(tabs)/`, como el de
 * Inventario (092): cambiar de pestaña solo cambia el hijo. La pestaña activa
 * sale de la ruta. El permiso de cada pestaña lo pide su página.
 */
export function SalesFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const section = salesSectionFor(usePathname());
  const { can } = usePermissions();
  const canSell = can(PERMISSIONS.carwash.actions.charge.key);
  const summary = useTabsSummary(can(PERMISSIONS.carwash.actions.read.key));
  const openCount = summary.data?.summary.openCount;

  return (
    <div>
      <ScreenHeader title="Ventas">
        {canSell ? (
          <Button asChild>
            <Link href="/sales/new">
              <Plus aria-hidden strokeWidth={1.5} />
              Nueva venta
            </Link>
          </Button>
        ) : null}
      </ScreenHeader>

      <Tabs<SalesSection>
        aria-label="Ventas"
        className="mb-5"
        value={section}
        onValueChange={(next) => {
          const target = SECTIONS.find((candidate) => candidate.value === next);
          if (target !== undefined && next !== section) router.push(target.href);
        }}
        items={SECTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          count: option.value === 'tabs' ? openCount : undefined,
        }))}
      />

      <div role="tabpanel" id={`tabpanel-${section}`} aria-labelledby={`tab-${section}`}>
        {children}
      </div>
    </div>
  );
}
