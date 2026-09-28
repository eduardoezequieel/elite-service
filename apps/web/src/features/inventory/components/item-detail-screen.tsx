'use client';

import { PERMISSIONS, type InventoryItem } from '@elite/shared';
import { ArrowDownToLine, ArrowUpFromLine, CupSoda, Pencil, Scale } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { formatMoney, formatQuantity } from '../format';
import { useInventoryItem, useItemMovements } from '../hooks/use-inventory';
import { AdjustDialog } from './adjust-dialog';
import { ConsumptionDialog } from './consumption-dialog';
import { DispatchDialog } from './dispatch-dialog';
import { EntryDialog } from './entry-dialog';
import { ItemDialog } from './item-dialog';
import { KardexTable } from './kardex-table';
import { ItemKindStamp } from './movement-type-stamp';
import { Pager } from './pager';

type DetailDialog = 'entry' | 'dispatch' | 'consumption' | 'adjust' | 'edit' | null;

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
            <Button type="button" variant="outline" onClick={() => setDialog('entry')}>
              <ArrowDownToLine className={ICON} strokeWidth={1.5} aria-hidden />
              Entrada
            </Button>
            {/* Un producto no se despacha, se anota como consumo (072); un
                insumo no se consume, se despacha (070 RN-2). */}
            {isProduct ? null : (
              <Button type="button" variant="outline" onClick={() => setDialog('dispatch')}>
                <ArrowUpFromLine className={ICON} strokeWidth={1.5} aria-hidden />
                Despachar
              </Button>
            )}
            {isProduct ? (
              <Button type="button" variant="outline" onClick={() => setDialog('consumption')}>
                <CupSoda className={ICON} strokeWidth={1.5} aria-hidden />
                Consumo de empleado
              </Button>
            ) : null}
          </>
        ) : null}
        {canAdjust ? (
          <Button type="button" variant="outline" onClick={() => setDialog('adjust')}>
            <Scale className={ICON} strokeWidth={1.5} aria-hidden />
            Ajustar
          </Button>
        ) : null}
        {canManage ? (
          <Button type="button" variant="outline" onClick={() => setDialog('edit')}>
            <Pencil className={ICON} strokeWidth={1.5} aria-hidden />
            Editar
          </Button>
        ) : null}
      </ScreenHeader>

      {/* En la bahía las cifras se leen de a dos por fila, más grandes y a un
          brazo de distancia; en el mostrador van las cuatro en una. */}
      <div
        className={cn(
          'grid grid-cols-1 gap-3.5 sm:grid-cols-2',
          isProduct ? 'xl:grid-cols-4' : 'xl:grid-cols-3',
          '[[data-density=bahia]_&]:xl:grid-cols-2',
        )}
      >
        <StatCard
          label="Existencia"
          value={formatQuantity(item.stockOnHand)}
          unit={item.unit}
          className={cn(item.isLowStock && 'border-danger-text/40')}
        >
          {item.isLowStock ? <Stamp tone="red" label="Bajo mínimo" /> : undefined}
        </StatCard>
        <StatCard
          label="Mínimo"
          value={item.minStock === '0.000' ? '—' : formatQuantity(item.minStock)}
          unit={item.minStock === '0.000' ? 'sin aviso' : item.unit}
        />
        <StatCard
          label="Costo promedio"
          value={formatMoney(item.averageCost)}
          unit={`por ${item.unit}`}
        />
        {isProduct ? (
          <StatCard label="Precio de venta" value={formatMoney(item.price)} unit="IVA incl." />
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

      {dialog === 'entry' ? <EntryDialog itemId={item.id} onClose={() => setDialog(null)} /> : null}
      {dialog === 'dispatch' ? (
        <DispatchDialog itemId={item.id} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'consumption' ? (
        <ConsumptionDialog itemId={item.id} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'adjust' ? <AdjustDialog item={item} onClose={() => setDialog(null)} /> : null}
      {dialog === 'edit' ? <ItemDialog item={item} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
