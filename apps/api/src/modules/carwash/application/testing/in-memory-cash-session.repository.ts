import type { Page, PageQuery } from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import { closeSnapshot } from '../../domain/cash-session';
import {
  CashSessionAlreadyOpenError,
  type CashSessionPaymentRecord,
  type CashSessionRecord,
  type CashSessionRepository,
  type CloseCashData,
  type OpenCashData,
} from '../ports/cash-session.repository';

export class InMemoryCashSessionRepository implements CashSessionRepository {
  private readonly sessions: CashSessionRecord[] = [];
  private readonly users = new Map<string, { id: string; fullName: string }>();
  private sequence = 0;

  addUser(id: string, fullName: string): void {
    this.users.set(id, { id, fullName });
  }

  /**
   * Test helper: attach a payment as charge would, without going through
   * tickets. The 069 details default to empty (a pre-069 payment).
   */
  addPayment(
    sessionId: string,
    payment: Omit<CashSessionPaymentRecord, 'id' | 'bankAccount' | 'reference' | 'description'> &
      Partial<Pick<CashSessionPaymentRecord, 'bankAccount' | 'reference' | 'description'>>,
  ): void {
    const session = this.sessions.find((row) => row.id === sessionId);

    if (session === undefined) {
      throw new Error(`Unknown cash session: ${sessionId}`);
    }

    session.payments.push({
      bankAccount: null,
      reference: null,
      description: null,
      ...payment,
      id: `pay-${session.payments.length + 1}`,
    });
  }

  findOpen(): Promise<CashSessionRecord | null> {
    return Promise.resolve(this.clone(this.sessions.find((row) => row.status === 'OPEN') ?? null));
  }

  findById(id: string): Promise<CashSessionRecord | null> {
    return Promise.resolve(this.clone(this.sessions.find((row) => row.id === id) ?? null));
  }

  listPage(query: PageQuery): Promise<Page<CashSessionRecord>> {
    const ordered = [...this.sessions].sort(
      (left, right) =>
        right.openedAt.getTime() - left.openedAt.getTime() || right.id.localeCompare(left.id),
    );
    const page = slicePage(ordered, query);

    return Promise.resolve({ ...page, items: page.items.map((row) => this.clone(row)) });
  }

  open(data: OpenCashData): Promise<CashSessionRecord> {
    const existing = this.sessions.find((row) => row.status === 'OPEN');

    if (existing !== undefined) {
      throw new CashSessionAlreadyOpenError(this.clone(existing));
    }

    const user = this.users.get(data.userId);

    if (user === undefined) {
      throw new Error(`Unknown user: ${data.userId}`);
    }

    this.sequence += 1;
    const now = new Date('2026-09-03T12:00:00.000Z');
    const created: CashSessionRecord = {
      id: `session-${this.sequence}`,
      status: 'OPEN',
      openingFloat: data.openingFloat,
      openedAt: now,
      openedBy: { ...user },
      closedAt: null,
      closedBy: null,
      countedCash: null,
      cashTotal: null,
      cardTotal: null,
      transferTotal: null,
      otherTotal: null,
      expectedCash: null,
      differenceCash: null,
      notes: null,
      payments: [],
    };

    this.sessions.push(created);

    return Promise.resolve(this.clone(created));
  }

  close(id: string, data: CloseCashData): Promise<CashSessionRecord | null> {
    const session = this.sessions.find((row) => row.id === id && row.status === 'OPEN');

    if (session === undefined) return Promise.resolve(null);

    const user = this.users.get(data.userId);

    if (user === undefined) {
      throw new Error(`Unknown user: ${data.userId}`);
    }

    const snapshot = closeSnapshot(session.openingFloat, session.payments, data.countedCash);
    session.status = 'CLOSED';
    session.closedAt = new Date('2026-09-03T20:00:00.000Z');
    session.closedBy = { ...user };
    session.countedCash = data.countedCash;
    session.cashTotal = snapshot.cashTotal;
    session.cardTotal = snapshot.cardTotal;
    session.transferTotal = snapshot.transferTotal;
    session.otherTotal = snapshot.otherTotal;
    session.expectedCash = snapshot.expectedCash;
    session.differenceCash = snapshot.differenceCash;
    session.notes = emptyToNull(data.notes);

    return Promise.resolve(this.clone(session));
  }

  private clone(row: CashSessionRecord): CashSessionRecord;
  private clone(row: CashSessionRecord | null): CashSessionRecord | null;
  private clone(row: CashSessionRecord | null): CashSessionRecord | null {
    if (row === null) return null;

    return {
      ...row,
      openedBy: { ...row.openedBy },
      closedBy: row.closedBy === null ? null : { ...row.closedBy },
      payments: row.payments.map((payment) => ({
        ...payment,
        bankAccount: payment.bankAccount === null ? null : { ...payment.bankAccount },
      })),
    };
  }
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}
