'use client';

import { PERMISSIONS } from '@elite/shared';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { DeliveryDialog } from './delivery-dialog';
import { EntryWizard } from './entry-wizard';

const ICON = 'size-icon';

export type InventorySection = 'stock' | 'movements' | 'consumption';

const SECTIONS: readonly { value: InventorySection; label: string; href: string }[] = [
  { value: 'stock', label: 'Existencias', href: '/inventory' },
  { value: 'movements', label: 'Movimientos', href: '/inventory/movements' },
  { value: 'consumption', label: 'Consumos del personal', href: '/inventory/consumption' },
];

/**
 * El marco de Inventario (spec 091): la misma cabecera y las mismas pestañas
 * en Existencias, Movimientos y Consumos del personal, para que nada salte al
 * cambiar de una a otra. Cada pestaña es su propia ruta, así que el filtro de
 * cada una sigue viviendo en su URL.
 *
 * Las dos acciones son las del día a día y valen en las tres: «Entregar a
 * empleado» (consumo o despacho según el artículo) y «Registrar entrada».
 */
export function InventoryFrame({
  section,
  children,
}: {
  section: InventorySection;
  children: ReactNode;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const canMove = can(PERMISSIONS.inventory.actions.move.key);
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);
  const [dialog, setDialog] = useState<'entry' | 'delivery' | null>(null);

  return (
    <div>
      <ScreenHeader
        title="Inventario"
        subtitle={
          <span>
            Lo que hay de cada producto e insumo, y todo lo que entra y sale.
            {canManage ? (
              <>
                {' · '}
                <Link
                  href="/settings/catalog?tab=products"
                  className="text-flame-text font-semibold hover:underline"
                >
                  Los artículos se crean en Catálogo
                </Link>
              </>
            ) : null}
          </span>
        }
      >
        {canMove ? (
          <>
            <Button type="button" variant="outline" onClick={() => setDialog('delivery')}>
              <ArrowUpFromLine className={ICON} strokeWidth={1.5} aria-hidden />
              Entregar a empleado
            </Button>
            <Button type="button" onClick={() => setDialog('entry')}>
              <ArrowDownToLine className={ICON} strokeWidth={1.5} aria-hidden />
              Registrar entrada
            </Button>
          </>
        ) : null}
      </ScreenHeader>

      <Tabs<InventorySection>
        aria-label="Inventario"
        className="mb-5"
        value={section}
        onValueChange={(next) => {
          const target = SECTIONS.find((candidate) => candidate.value === next);
          if (target !== undefined && next !== section) router.push(target.href);
        }}
        items={SECTIONS}
      />

      <div role="tabpanel" id={`tabpanel-${section}`} aria-labelledby={`tab-${section}`}>
        {children}
      </div>

      {dialog === 'entry' ? <EntryWizard onClose={() => setDialog(null)} /> : null}
      {dialog === 'delivery' ? <DeliveryDialog onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
