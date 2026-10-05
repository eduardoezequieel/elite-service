import type { TabHolderKind, TabListItem } from '@elite/shared';

import { Stamp } from '@/components/ui/stamp';
import { HOLDER_KIND_LABELS, closedLabel } from '../tab-format';

/** «Trabajador» en morado o «Cliente» en azul (105): el tono acompaña, la palabra manda. */
export function HolderKindStamp({ kind }: { kind: TabHolderKind }) {
  return <Stamp tone={kind === 'EMPLOYEE' ? 'consume' : 'info'} label={HOLDER_KIND_LABELS[kind]} />;
}

/** Una cuenta cerrada: «Pagada» si se cobró, «Cerrada» si se quitó todo. Abierta, nada. */
export function TabClosedStamp({ tab }: { tab: Pick<TabListItem, 'status' | 'paid'> }) {
  if (tab.status !== 'CLOSED') return null;

  const label = closedLabel(tab);

  return <Stamp tone={label === 'Pagada' ? 'green' : 'neutral'} label={label} />;
}
