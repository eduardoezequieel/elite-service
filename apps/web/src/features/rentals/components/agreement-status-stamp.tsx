import { AGREEMENT_STATUS_LABELS } from '@elite/shared';
import type { AgreementDerivedStatus } from '@elite/shared';
import { AlarmClock, Ban, CalendarClock, CircleCheck, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Stamp, type StampSize, type StampTone } from '@/components/ui/stamp';

/**
 * El estado de una renta (096). Los cinco llevan icono, como los del lavado
 * (053): un chip con punto al lado de uno con icono se lee como otro
 * componente. «Atrasada» va en el rojo del semáforo; «En curso» no late.
 */
export const AGREEMENT_STATUS_STYLE: Record<
  AgreementDerivedStatus,
  { tone: StampTone; icon: LucideIcon }
> = {
  RESERVED: { tone: 'paid', icon: CalendarClock },
  IN_PROGRESS: { tone: 'washing', icon: KeyRound },
  LATE: { tone: 'red', icon: AlarmClock },
  FINISHED: { tone: 'green', icon: CircleCheck },
  CANCELLED: { tone: 'neutral', icon: Ban },
};

/** La clase de texto del tono, para las barras del calendario (con `.tint`). */
export const AGREEMENT_STATUS_TEXT: Record<AgreementDerivedStatus, string> = {
  RESERVED: 'text-info-text',
  IN_PROGRESS: 'text-flame-text',
  LATE: 'text-danger-text',
  FINISHED: 'text-go-text',
  CANCELLED: 'text-text-dim',
};

export function AgreementStatusStamp({
  status,
  size = 'md',
}: {
  status: AgreementDerivedStatus;
  size?: StampSize;
}) {
  const { tone, icon: Icon } = AGREEMENT_STATUS_STYLE[status];

  return (
    <Stamp
      label={AGREEMENT_STATUS_LABELS[status]}
      tone={tone}
      size={size}
      pulse={false}
      icon={<Icon strokeWidth={1.5} />}
    />
  );
}
