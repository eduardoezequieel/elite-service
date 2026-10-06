'use client';

import { CashShiftSessionScreen } from '@/features/cash-shift/components/cash-session-detail-screen';

import { carwashCashAdapter } from '../cash-adapter';

export function CashSessionDetailScreen({ id }: { id: string }) {
  return <CashShiftSessionScreen id={id} adapter={carwashCashAdapter} />;
}
