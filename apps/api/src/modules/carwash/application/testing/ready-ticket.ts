import type { Page, Ticket, TicketWasher } from '@elite/shared';

import type { CashSessionRecord, CashSessionRepository } from '../ports/cash-session.repository';

export const carlos: TicketWasher = {
  id: 'emp-carlos',
  username: 'carlos',
  fullName: 'Carlos VIS',
};

/** Un lavado listo de un solo servicio, que es el caso normal de la caja. */
export function readyTicket(id: string, total: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    number: `CW-000${id.slice(-1)}`,
    status: 'READY',
    customer: { id: 'c1', fullName: 'Ana', phone: null },
    vehicle: {
      id: `v-${id}`,
      plate: `P00${id.slice(-1)}`,
      bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: null,
      color: null,
      isActive: true,
      currentOwner: null,
      lastWash: null,
    },
    bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
    items: [
      {
        id: `i-${id}`,
        kind: 'SERVICE',
        serviceId: 's1',
        inventoryItemId: null,
        code: 'SRV-0003',
        name: 'Lavado',
        serviceCode: 'SRV-0003',
        serviceName: 'Lavado',
        catalogPrice: total,
        unitPrice: total,
        quantity: '1.000',
        total: total,
        sortOrder: 0,
        priceAuthorizedBy: null,
        priceAuthorizedAt: null,
        priceReason: null,
        previousUnitPrice: null,
      },
    ],
    total,
    washer: carlos,
    washers: [carlos],
    commissionTotal: null,
    notes: null,
    payments: [],
    charge: null,
    washingStartedAt: null,
    readyAt: null,
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    ...overrides,
  };
}

/** Un turno de caja que el test abre, cierra o cambia a mano. */
export class FakeCashSessions implements CashSessionRepository {
  constructor(public current: CashSessionRecord | null = { id: 'cash-1' } as CashSessionRecord) {}

  async findOpen(): Promise<CashSessionRecord | null> {
    return this.current;
  }

  async findById(): Promise<CashSessionRecord | null> {
    return this.current;
  }

  async listPage(): Promise<Page<CashSessionRecord>> {
    throw new Error('not used');
  }

  async open(): Promise<CashSessionRecord> {
    throw new Error('not used');
  }

  async close(): Promise<CashSessionRecord | null> {
    throw new Error('not used');
  }
}
