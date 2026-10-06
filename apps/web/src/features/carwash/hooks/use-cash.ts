'use client';

import type { CashSession, CashSessionDetail } from '@elite/shared';

import {
  useCashShiftList,
  useCashShiftSession,
  useCloseCashShift,
  useCurrentCashShift,
  useOpenCashShift,
} from '@/features/cash-shift/hooks/use-cash-shift';

import { carwashCashAdapter } from '../cash-adapter';

export const CASH_QUERY_KEY = carwashCashAdapter.queryKey;

export function useCurrentCashSession(enabled = true) {
  return useCurrentCashShift<CashSession>(carwashCashAdapter, enabled);
}

export function useCashSessions(page = 1, enabled = true) {
  return useCashShiftList<CashSession>(carwashCashAdapter, page, enabled);
}

export function useCashSession(id: string, page = 1, enabled = true) {
  return useCashShiftSession<CashSessionDetail>(carwashCashAdapter, id, page, enabled);
}

export function useOpenCash() {
  return useOpenCashShift<CashSession>(carwashCashAdapter);
}

export function useCloseCash() {
  return useCloseCashShift<CashSession>(carwashCashAdapter);
}
