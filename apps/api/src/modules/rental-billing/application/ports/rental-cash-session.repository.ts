import type { Page, PageQuery, PaymentMethod } from '@elite/shared';

export interface RentalCashActor {
  id: string;
  fullName: string;
}

/** Un cobro vigente del turno. Los anulados no entran: dejaron de sumar. */
export interface RentalCashPaymentRecord {
  id: string;
  method: PaymentMethod;
  /** Centavos. */
  amount: number;
  paidAt: Date;
  reference: string | null;
  /** Nota del pago cuando el método es OTHER; si no, `null`. */
  description: string | null;
  detail: {
    agreementId: string;
    contractNumber: number | null;
    plate: string | null;
    customerName: string;
  };
}

export interface RentalCashSessionRecord {
  id: string;
  status: 'OPEN' | 'CLOSED';
  /** Centavos. */
  openingFloat: number;
  openedAt: Date;
  openedBy: RentalCashActor;
  closedAt: Date | null;
  closedBy: RentalCashActor | null;
  countedCash: number | null;
  cashTotal: number | null;
  cardTotal: number | null;
  transferTotal: number | null;
  otherTotal: number | null;
  expectedCash: number | null;
  differenceCash: number | null;
  notes: string | null;
  /** Cobros no anulados, el más nuevo primero. */
  payments: RentalCashPaymentRecord[];
}

export interface OpenRentalCashData {
  /** Centavos. Nunca negativo: el schema ya lo rechazó. */
  openingFloat: number;
  userId: string;
}

export interface CloseRentalCashData {
  countedCash: number;
  userId: string;
  notes?: string;
}

/** Dos aperturas a la vez: el índice parcial rechazó la segunda. */
export class CashSessionAlreadyOpenError extends Error {
  constructor(readonly existing: RentalCashSessionRecord) {
    super('Cash session already open');
    this.name = 'CashSessionAlreadyOpenError';
  }
}

/** El turno dejó de estar OPEN entre la lectura y la escritura del cobro. */
export class CashSessionGoneError extends Error {
  constructor() {
    super('Cash session is not open');
    this.name = 'CashSessionGoneError';
  }
}

/** El cobro pertenece a un turno que ya cerró. */
export class CashSessionClosedError extends Error {
  constructor() {
    super('Cash session is closed');
    this.name = 'CashSessionClosedError';
  }
}

export interface RentalCashSessionRepository {
  findOpen(): Promise<RentalCashSessionRecord | null>;
  findById(id: string): Promise<RentalCashSessionRecord | null>;
  /** El más nuevo primero y después por id. */
  listPage(query: PageQuery): Promise<Page<RentalCashSessionRecord>>;
  open(data: OpenRentalCashData): Promise<RentalCashSessionRecord>;
  /** `null` si la fila ya no está OPEN. */
  close(id: string, data: CloseRentalCashData): Promise<RentalCashSessionRecord | null>;
}

export const RENTAL_CASH_SESSION_REPOSITORY = Symbol('rental-billing.RentalCashSessionRepository');
