import type { InventoryItemKind, InventoryMovementType } from '@elite/shared';

import { Stamp } from '@/components/ui/stamp';
import { MOVEMENT_TYPE_META } from '../kardex';

/** El sello del tipo de movimiento: la palabra siempre, el color de apoyo (065 UI). */
export function MovementTypeStamp({ type }: { type: InventoryMovementType }) {
  const meta = MOVEMENT_TYPE_META[type];

  return <Stamp tone={meta.tone} label={meta.label} className={meta.colorClass} />;
}

/** Producto o insumo. El tipo se fija al crear y no cambia (RN-1). */
export function ItemKindStamp({ kind }: { kind: InventoryItemKind }) {
  return kind === 'PRODUCT' ? (
    <Stamp tone="washing" pulse={false} label="Producto" />
  ) : (
    <Stamp tone="amber" label="Insumo" />
  );
}

/** Inactivo manda sobre bajo mínimo: un artículo apagado no se repone. */
export function ItemStatusStamp({
  isActive,
  isLowStock,
}: {
  isActive: boolean;
  isLowStock: boolean;
}) {
  if (!isActive) return <Stamp tone="neutral" label="Inactivo" />;
  if (isLowStock) return <Stamp tone="red" label="Bajo mínimo" />;

  return <Stamp tone="green" label="Activo" />;
}
