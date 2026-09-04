import type { PaymentMethod } from '@elite/shared';

import type { Cents } from '../../domain/money';

export interface CashSessionActorRecord {
  id: string;
  fullName: string;
}

export interface CashSessionPaymentRecord {
  id: string;
  workOrderId: string;
  ticketNumber: string;
  method: PaymentMethod;
  amount: Cents;
  paidAt: Date;
}

export interface CashSessionRecord {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingFloat: Cents;
  openedAt: Date;
  openedBy: CashSessionActorRecord;
  closedAt: Date | null;
  closedBy: CashSessionActorRecord | null;
  countedCash: Cents | null;
  cashTotal: Cents | null;
  cardTotal: Cents | null;
  transferTotal: Cents | null;
  expectedCash: Cents | null;
  differenceCash: Cents | null;
  notes: string | null;
  payments: CashSessionPaymentRecord[];
}

export interface OpenCashData {
  openingFloat: Cents;
  userId: string;
}

export interface CloseCashData {
  countedCash: Cents;
  userId: string;
  notes?: string;
}

/**
 * Thrown when a second OPEN row is rejected by the unique partial index
 * (two cashiers opening at the same instant).
 */
export class CashSessionAlreadyOpenError extends Error {
  constructor(readonly existing: CashSessionRecord) {
    super('Cash session already open');
    this.name = 'CashSessionAlreadyOpenError';
  }
}

/**
 * Thrown from charge when the session is no longer OPEN inside the
 * payment transaction (closed between the use-case check and the insert).
 */
export class CashSessionGoneError extends Error {
  constructor() {
    super('Cash session is not open');
    this.name = 'CashSessionGoneError';
  }
}

export interface CashSessionRepository {
  findOpen(): Promise<CashSessionRecord | null>;
  findById(id: string): Promise<CashSessionRecord | null>;
  list(limit: number): Promise<CashSessionRecord[]>;
  open(data: OpenCashData): Promise<CashSessionRecord>;
  /** `null` if the row is no longer OPEN (lost the race to another close). */
  close(id: string, data: CloseCashData): Promise<CashSessionRecord | null>;
}

export const CASH_SESSION_REPOSITORY = Symbol('carwash.CashSessionRepository');
