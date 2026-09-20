import { buildTimeline, type StatusEventRecord } from './ticket-timeline';

function event(overrides: Partial<StatusEventRecord> = {}): StatusEventRecord {
  return {
    id: 'e1',
    fromStatus: null,
    toStatus: 'OPEN',
    actorKind: 'user',
    actorName: 'Eduardo López',
    occurredAt: new Date('2026-09-20T16:38:00.000Z'),
    ...overrides,
  };
}

describe('buildTimeline (046 RN-5)', () => {
  it('sin filas, no hay nada que mostrar (RN-8)', () => {
    expect(buildTimeline([])).toEqual({ segments: [], recorded: false });
  });

  it('una sola fila deja el tramo abierto', () => {
    const timeline = buildTimeline([event()]);

    expect(timeline.recorded).toBe(true);
    expect(timeline.segments).toEqual([
      {
        id: 'e1',
        status: 'OPEN',
        enteredAt: '2026-09-20T16:38:00.000Z',
        leftAt: null,
        durationSeconds: null,
        actor: { kind: 'user', name: 'Eduardo López' },
      },
    ]);
  });

  it('cada evento cierra el tramo anterior', () => {
    const timeline = buildTimeline([
      event({ id: 'e1', toStatus: 'OPEN', occurredAt: new Date('2026-09-20T16:38:00.000Z') }),
      event({
        id: 'e2',
        fromStatus: 'OPEN',
        toStatus: 'WASHING',
        occurredAt: new Date('2026-09-20T16:49:00.000Z'),
      }),
      event({
        id: 'e3',
        fromStatus: 'WASHING',
        toStatus: 'READY',
        occurredAt: new Date('2026-09-20T17:19:30.000Z'),
      }),
    ]);

    expect(timeline.segments.map((segment) => segment.status)).toEqual([
      'OPEN',
      'WASHING',
      'READY',
    ]);
    expect(timeline.segments.map((segment) => segment.durationSeconds)).toEqual([660, 1830, null]);
    expect(timeline.segments[0]?.leftAt).toBe('2026-09-20T16:49:00.000Z');
    expect(timeline.segments[2]?.leftAt).toBeNull();
  });

  it('un estado repetido da dos tramos con su propia duración', () => {
    const timeline = buildTimeline([
      event({ id: 'e1', toStatus: 'OPEN', occurredAt: new Date('2026-09-20T16:00:00.000Z') }),
      event({
        id: 'e2',
        fromStatus: 'OPEN',
        toStatus: 'WASHING',
        occurredAt: new Date('2026-09-20T16:10:00.000Z'),
      }),
      event({
        id: 'e3',
        fromStatus: 'WASHING',
        toStatus: 'OPEN',
        occurredAt: new Date('2026-09-20T16:15:00.000Z'),
      }),
      event({
        id: 'e4',
        fromStatus: 'OPEN',
        toStatus: 'READY',
        occurredAt: new Date('2026-09-20T16:45:00.000Z'),
      }),
    ]);

    expect(timeline.segments.map((segment) => segment.status)).toEqual([
      'OPEN',
      'WASHING',
      'OPEN',
      'READY',
    ]);
    expect(timeline.segments.map((segment) => segment.durationSeconds)).toEqual([
      600,
      300,
      1800,
      null,
    ]);
  });

  it('ordena por hora aunque las filas lleguen al revés', () => {
    const timeline = buildTimeline([
      event({
        id: 'e2',
        fromStatus: 'OPEN',
        toStatus: 'WASHING',
        occurredAt: new Date('2026-09-20T16:49:00.000Z'),
      }),
      event({ id: 'e1', toStatus: 'OPEN', occurredAt: new Date('2026-09-20T16:38:00.000Z') }),
    ]);

    expect(timeline.segments.map((segment) => segment.id)).toEqual(['e1', 'e2']);
  });

  it('una fila sin actor no inventa uno (RN-3)', () => {
    const timeline = buildTimeline([event({ actorKind: null, actorName: null })]);

    expect(timeline.segments[0]?.actor).toBeNull();
  });

  it('dos filas con la misma marca dan un tramo de cero, nunca negativo', () => {
    const at = new Date('2026-09-20T16:38:00.000Z');
    const timeline = buildTimeline([
      event({ id: 'e1', toStatus: 'OPEN', occurredAt: at }),
      event({ id: 'e2', fromStatus: 'OPEN', toStatus: 'READY', occurredAt: at }),
    ]);

    expect(timeline.segments[0]?.durationSeconds).toBe(0);
  });
});
