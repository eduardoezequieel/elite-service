import type { TicketPriceChange, TicketTimelineSegment } from '@elite/shared';

import { timelineEntries } from './timeline-entries';

function segment(overrides: Partial<TicketTimelineSegment> = {}): TicketTimelineSegment {
  return {
    id: 's1',
    status: 'OPEN',
    enteredAt: '2026-09-20T15:00:00.000Z',
    leftAt: '2026-09-20T15:30:00.000Z',
    durationSeconds: 1800,
    actor: null,
    ...overrides,
  };
}

function change(overrides: Partial<TicketPriceChange> = {}): TicketPriceChange {
  return {
    id: 'p1',
    serviceName: 'Lavado completo',
    previousUnitPrice: '8.00',
    unitPrice: '6.00',
    reason: 'El carro venía con la pintura dañada',
    authorizedBy: 'Ana Rivas',
    changedAt: '2026-09-20T15:45:00.000Z',
    ...overrides,
  };
}

describe('la línea de tiempo con los cambios de precio (060)', () => {
  it('sin cambios de precio son exactamente los tramos, en su orden', () => {
    const segments = [segment(), segment({ id: 's2', status: 'READY' })];

    expect(timelineEntries({ segments, priceChanges: [] })).toEqual([
      { kind: 'segment', at: segments[0]?.enteredAt, segment: segments[0] },
      { kind: 'segment', at: segments[1]?.enteredAt, segment: segments[1] },
    ]);
  });

  it('intercala cada cambio entre los tramos, por hora', () => {
    const entries = timelineEntries({
      segments: [
        segment(),
        segment({ id: 's2', status: 'READY', enteredAt: '2026-09-20T15:30:00.000Z' }),
        segment({ id: 's3', status: 'PAID', enteredAt: '2026-09-20T16:00:00.000Z' }),
      ],
      priceChanges: [change()],
    });

    expect(
      entries.map((entry) => (entry.kind === 'price' ? 'precio' : entry.segment.status)),
    ).toEqual(['OPEN', 'READY', 'precio', 'PAID']);
  });

  it('con la misma hora manda el tramo: primero se entra, después pasa lo de adentro', () => {
    const entries = timelineEntries({
      segments: [segment({ status: 'READY', enteredAt: '2026-09-20T15:45:00.000Z' })],
      priceChanges: [change()],
    });

    expect(entries.map((entry) => entry.kind)).toEqual(['segment', 'price']);
  });

  it('dos cambios seguidos conservan el orden en que llegaron', () => {
    const entries = timelineEntries({
      segments: [],
      priceChanges: [
        change({ id: 'p1' }),
        change({ id: 'p2', changedAt: '2026-09-20T15:50:00.000Z' }),
      ],
    });

    expect(entries.map((entry) => (entry.kind === 'price' ? entry.change.id : ''))).toEqual([
      'p1',
      'p2',
    ]);
  });
});
