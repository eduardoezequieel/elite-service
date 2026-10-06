'use client';

import { PERMISSIONS } from '@elite/shared';
import type { CashSessionPayment } from '@elite/shared';

import type { CashShiftAdapter } from '@/features/cash-shift/adapter';

import { cashPaymentOrigin, paymentDetailText } from './cash-format';
import { referenceOf } from './reference';

export const carwashCashAdapter: CashShiftAdapter<CashSessionPayment> = {
  basePath: '/carwash/cash',
  queryKey: ['carwash', 'cash'],
  permission: PERMISSIONS.carwash.actions.cash.key,
  sessionHref: (id) => `/carwash/cash/${id}`,
  countLabel: 'Lavados cobrados',
  countNoun: { one: 'lavado', many: 'lavados' },
  paymentHref: (payment) => cashPaymentOrigin(payment).href,
  paymentRef: (payment) => referenceOf(cashPaymentOrigin(payment).number),
  renderDetail: (payment) => {
    const parts = [cashPaymentOrigin(payment).label, paymentDetailText(payment)].filter(
      (part): part is string => part !== null,
    );

    return (
      <span className="text-text-dim break-words">
        {parts.length === 0 ? '—' : parts.join(' · ')}
      </span>
    );
  },
  showActors: true,
  openHelp: 'Sin caja abierta no se cobra.',
  paymentsEmptyMessage: 'Cuando cobres un lavado va a aparecer acá.',
  historyEmptyMessage: 'Cuando cierres un turno va a aparecer acá.',
};
