'use client';

import { CashShiftScreen } from '@/features/cash-shift/components/cash-screen';

import { carwashCashAdapter } from '../cash-adapter';

export function CashScreen() {
  return <CashShiftScreen adapter={carwashCashAdapter} />;
}
