import {
  checkinNotesOf,
  civilDayEnd,
  civilDayStart,
  depositReturnNoteOf,
  nextContractNumber,
  transitionBlock,
} from './agreement';

describe('transitionBlock (RN-1)', () => {
  it('closes every action on a finished or cancelled agreement', () => {
    for (const status of ['FINISHED', 'CANCELLED'] as const) {
      for (const action of [
        'update',
        'checkout',
        'checkin',
        'extend',
        'swap',
        'reassign',
        'cancel',
      ] as const) {
        expect(transitionBlock(status, action)).toBe('CLOSED');
      }
    }
  });

  it('lets a reservation be delivered, reassigned, edited and cancelled', () => {
    expect(transitionBlock('RESERVED', 'checkout')).toBeNull();
    expect(transitionBlock('RESERVED', 'reassign')).toBeNull();
    expect(transitionBlock('RESERVED', 'update')).toBeNull();
    expect(transitionBlock('RESERVED', 'cancel')).toBeNull();
    expect(transitionBlock('RESERVED', 'checkin')).toBe('NOT_IN_PROGRESS');
    expect(transitionBlock('RESERVED', 'extend')).toBe('NOT_IN_PROGRESS');
    expect(transitionBlock('RESERVED', 'swap')).toBe('NOT_IN_PROGRESS');
  });

  it('lets a running agreement be received, extended, swapped, edited and cancelled', () => {
    expect(transitionBlock('IN_PROGRESS', 'checkin')).toBeNull();
    expect(transitionBlock('IN_PROGRESS', 'extend')).toBeNull();
    expect(transitionBlock('IN_PROGRESS', 'swap')).toBeNull();
    expect(transitionBlock('IN_PROGRESS', 'cancel')).toBeNull();
    expect(transitionBlock('IN_PROGRESS', 'checkout')).toBe('NOT_RESERVED');
    expect(transitionBlock('IN_PROGRESS', 'reassign')).toBe('NOT_RESERVED');
  });
});

describe('nextContractNumber (RN-3)', () => {
  it('starts at the configured number and follows the highest one', () => {
    expect(nextContractNumber(null, 733)).toBe(733);
    expect(nextContractNumber(740, 733)).toBe(741);
    expect(nextContractNumber(740, 900)).toBe(900);
  });
});

describe('civil days', () => {
  it('reads a day in El Salvador time (UTC−6)', () => {
    expect(civilDayStart('2026-10-12').toISOString()).toBe('2026-10-12T06:00:00.000Z');
    expect(civilDayEnd('2026-10-12').toISOString()).toBe('2026-10-13T06:00:00.000Z');
  });
});

describe('notes', () => {
  it('writes the deposit return method in front of the note', () => {
    expect(depositReturnNoteOf('CARD', 'Rayón')).toBe('Devuelto en tarjeta · Rayón');
    expect(depositReturnNoteOf(null, null)).toBeNull();
  });

  it('appends the billable days override to the notes', () => {
    expect(
      checkinNotesOf({
        current: 'Cliente frecuente',
        notes: undefined,
        overriddenDays: 2,
        daysNote: 'Cortesía',
      }),
    ).toBe('Cliente frecuente\nDías a cobrar ajustados a 2: Cortesía');
    expect(
      checkinNotesOf({ current: 'x', notes: null, overriddenDays: null, daysNote: undefined }),
    ).toBeNull();
  });
});
