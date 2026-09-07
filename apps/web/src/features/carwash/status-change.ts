import type { WorkOrderStatus } from '@elite/shared';

/** Los tres estados que oficina puede elegir (037). */
export const OPERATIONAL_STATUSES = ['OPEN', 'WASHING', 'READY'] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export function isOperationalStatus(status: WorkOrderStatus): status is OperationalStatus {
  return (OPERATIONAL_STATUSES as readonly WorkOrderStatus[]).includes(status);
}

const WARNINGS: Record<OperationalStatus, Record<OperationalStatus, string | null>> = {
  OPEN: {
    OPEN: null,
    WASHING: 'Se marca como lavando. El tiempo de lavado empieza ahora.',
    READY: 'Queda listo para cobrar. Se salta el lavado.',
  },
  WASHING: {
    OPEN: 'Vuelve a la cola. Se pierde el tiempo de lavado.',
    WASHING: null,
    READY: 'Queda listo para cobrar.',
  },
  READY: {
    OPEN: 'Vuelve a la cola. Deja de poder cobrarse.',
    WASHING: 'Vuelve a lavando. Deja de poder cobrarse. El tiempo de lavado se reinicia.',
    READY: null,
  },
};

/** El aviso del salto, o `null` si no hay cambio. */
export function statusChangeWarning(from: OperationalStatus, to: OperationalStatus): string | null {
  return WARNINGS[from][to];
}
