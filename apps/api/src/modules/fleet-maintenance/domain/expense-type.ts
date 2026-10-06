import { FLEET_EXPENSE_TYPE_LABELS, FLEET_EXPENSE_TYPES } from '@elite/shared';
import type { FleetExpenseType } from '@elite/shared';

/** Sin tildes y en minúsculas, para comparar el texto libre con la etiqueta. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * spec 110 — La categoría de un gasto anotado sin que se la pregunten.
 *
 * Si el texto contiene la etiqueta de una categoría (la más larga primero),
 * esa. «Otro» no se usa como pista. Si no hay coincidencia, `OTHER`.
 */
export function expenseTypeFromText(text: string | null | undefined): FleetExpenseType {
  const folded = fold(text ?? '');
  const labels = FLEET_EXPENSE_TYPES.filter((type) => type !== 'OTHER')
    .map((type) => ({ type, label: fold(FLEET_EXPENSE_TYPE_LABELS[type]) }))
    .sort((left, right) => right.label.length - left.label.length);

  return labels.find((item) => item.label !== '' && folded.includes(item.label))?.type ?? 'OTHER';
}
