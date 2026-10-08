import type { ReactNode } from 'react';

import type { CashSession, PaymentMethod } from '@elite/shared';

/** Lo mínimo de un cobro para la tabla compartida. El detalle lo pone el adapter. */
export interface CashShiftPayment {
  id: string;
  method: PaymentMethod;
  amount: string;
  paidAt: string;
}

/**
 * Lo que cambia entre lavado y renta (109 RN-5). El componente no pregunta el
 * negocio: cada diferencia entra por acá.
 */
export interface CashShiftAdapter<TPayment extends CashShiftPayment> {
  basePath: '/carwash/cash' | '/rentals/cash';
  queryKey: readonly [string, ...string[]];
  permission: string;
  sessionHref: (id: string) => string;
  countLabel: 'Lavados cobrados' | 'Cobros';
  /** El número de `countLabel`: lavados distintos en el lavado, cobros en la renta (112). */
  count: (session: CashSession) => number;
  /** Sin esto, el conteo del turno no lleva unidad. */
  countNoun?: { one: string; many: string };
  renderDetail: (payment: TPayment) => ReactNode;
  paymentHref: (payment: TPayment) => string;
  paymentRef: (payment: TPayment) => number;
  /** Subtítulo «Abrió X», columnas del historial y nombres del detalle. */
  showActors: boolean;
  /** Texto de la tarjeta de apertura. `null` no dibuja nada. */
  openHelp: string | null;
  paymentsEmptyMessage: string;
  historyEmptyMessage: string;
}
