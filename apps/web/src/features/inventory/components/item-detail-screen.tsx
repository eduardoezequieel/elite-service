'use client';

import { PERMISSIONS, type InventoryItem } from '@elite/shared';
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Scale } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { formatQuantity, quantityMilli } from '@/lib/quantity';
import { useInventoryItem, useItemMovements } from '../hooks/use-inventory';
import { AdjustDialog } from './adjust-dialog';
import { DeliveryDialog } from './delivery-dialog';
import { EntryWizard } from './entry-wizard';
import { ItemDialog } from './item-dialog';
import { KardexTable } from './kardex-table';
import { ItemKindStamp } from './movement-type-stamp';
import { Pager } from './pager';

type DetailDialog = 'entry' | 'delivery' | 'adjust' | 'edit' | null;

const ICON = 'size-icon';

/**
 * `/inventory/:id` (spec 065): la tarjeta del artículo con sus cifras y, debajo,
 * el kardex completo: qué pasó, cuántos, quién, a quién, en qué lavado o
 * venta, fecha y hora.
 */
export function ItemDetailScreen({ id }: { id: string }) {
  const { can } = usePermissions();
  const item = useInventoryItem(id, can(PERMISSIONS.inventory.actions.read.key));

  if (item.isPending) {
    return <p className="text-text-dim text-body">Cargando…</p>;
  }

  if (item.error !== null || item.data === undefined) {
    return (
      <div>
        <ScreenHeader title="Artículo" />
        <p className="text-danger-text text-body" role="alert">
          {item.error?.message ?? 'No se pudo cargar el artículo.'}
        </p>
      </div>
    );
  }

  return <ItemDetail item={item.data} />;
}

function ItemDetail({ item }: { item: InventoryItem }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);
  const canMove = can(PERMISSIONS.inventory.actions.move.key);
  const canAdjust = can(PERMISSIONS.inventory.actions.adjust.key);
  const [page, setPage] = useState(1);
  const movements = useItemMovements(item.id, page);
  const [dialog, setDialog] = useState<DetailDialog>(null);
  const isProduct = item.kind === 'PRODUCT';
  const moving = canMove && item.isActive;
  const hasStock = (quantityMilli(item.stockOnHand) ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title={item.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-text-faint font-mono">{item.code}</span>
            <ItemKindStamp kind={item.kind} />
            {item.isActive ? null : <Stamp tone="neutral" label="Inactivo" />}
            <span>
              {item.category?.name ?? 'Sin categoría'} · se mide en {item.unit}
            </span>
            {item.barcode ? <span className="font-mono">{item.barcode}</span> : null}
          </span>
        }
      >
        {moving ? (
          <>
            {/* Las mismas dos de la cabecera de Inventario (091). Solo un insumo se
                entrega: un producto se anota en una cuenta abierta (105). */}
            {isProduct ? null : (
              <Button
                type="button"
                variant="outline"
                disabled={!hasStock}
                title={hasStock ? undefined : 'Sin existencia'}
                onClick={() => setDialog('delivery')}
              >
                <ArrowUpFromLine className={ICON} strokeWidth={1.5} aria-hidden />
                Entregar a empleado
              </Button>
            )}
            <Button type="button" onClick={() => setDialog('entry')}>
              <ArrowDownToLine className={ICON} strokeWidth={1.5} aria-hidden />
              Registrar entrada
            </Button>
          </>
        ) : null}
        {canAdjust ? (
          <Button type="button" variant="ghost" onClick={() => setDialog('adjust')}>
            <Scale className={ICON} strokeWidth={1.5} aria-hidden />
            Ajustar por conteo
          </Button>
        ) : null}
        {canManage ? (
          <Button type="button" variant="ghost" onClick={() => setDialog('edit')}>
            <Pencil className={ICON} strokeWidth={1.5} aria-hidden />
            Editar
          </Button>
        ) : null}
      </ScreenHeader>

      {/* En la bahía las cifras se leen de a dos por fila, más grandes y a un
          brazo de distancia; en el mostrador van todas en una. El mínimo va
          dentro de la existencia (091): es de ella que avisa. */}
      <div
        className={cn(
          'grid grid-cols-1 gap-3.5 sm:grid-cols-2',
          isProduct ? 'xl:grid-cols-3' : 'xl:grid-cols-2',
          '[[data-density=bahia]_&]:xl:grid-cols-2',
        )}
      >
        <StatCard
          label="Existencia"
          value={formatQuantity(item.stockOnHand)}
          unit={item.unit}
          detail={
            item.minStock === '0.000'
              ? 'Sin mínimo: no avisa'
              : `Mínimo ${formatQuantity(item.minStock)} · avisa al llegar ahí`
          }
          className={cn(item.isLowStock && 'border-danger-text/40')}
        >
          {item.isLowStock ? <Stamp tone="red" label="Bajo mínimo" /> : undefined}
        </StatCard>
        {/* RN-6: lo que pagaste vos, no lo que paga el cliente. */}
        <StatCard
          label="Te costó (promedio)"
          value={formatMoney(item.averageCost)}
          unit={`por ${item.unit}`}
          detail="Lo que pagaste vos, promediando tus entradas. Se calcula solo."
        />
        {isProduct ? (
          <StatCard
            label="Precio de venta"
            value={formatMoney(item.price)}
            unit="IVA incl."
            detail="Lo que paga el cliente. Se cambia en Catálogo."
          />
        ) : null}
      </div>

      <Card className="gap-3 px-card">
        <CardSectionHeading aside="Nunca se editan: se corrigen con otro">
          Historial
        </CardSectionHeading>

        <KardexTable
          page={movements.data}
          isLoading={movements.isPending}
          errorMessage={movements.error?.message ?? null}
          emptyTitle="Sin movimientos todavía"
          emptyMessage="La primera entrada va a aparecer acá, con su fecha, su hora y quién la registró."
        />

        <Pager
          page={movements.data}
          noun={{ one: 'movimiento', many: 'movimientos' }}
          onPageChange={setPage}
        />
      </Card>

      {dialog === 'entry' ? <EntryWizard item={item} onClose={() => setDialog(null)} /> : null}
      {dialog === 'delivery' ? (
        <DeliveryDialog item={item} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'adjust' ? <AdjustDialog item={item} onClose={() => setDialog(null)} /> : null}
      {dialog === 'edit' ? <ItemDialog item={item} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
