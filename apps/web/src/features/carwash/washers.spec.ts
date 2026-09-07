import type { TicketWasher } from '@elite/shared';

import { givenName, washerNames, washersLabel } from './washers';

const carlos: TicketWasher = { id: 'c', username: 'carlos', fullName: 'Carlos VIS' };
const jose: TicketWasher = { id: 'j', username: 'jose', fullName: 'José Pérez' };

describe('washers (035)', () => {
  it('nombra vacío, uno y varios', () => {
    expect(washersLabel({ washers: [] })).toBe('Sin asignar');
    expect(washersLabel({ washers: [carlos] })).toBe('Carlos VIS');
    expect(washersLabel({ washers: [carlos, jose] })).toBe('Carlos +1');
  });

  it('lista nombres o Sin asignar', () => {
    expect(washerNames([])).toBe('Sin asignar');
    expect(washerNames([carlos, jose])).toBe('Carlos VIS, José Pérez');
  });

  it('toma el nombre de pila', () => {
    expect(givenName('José Pérez')).toBe('José');
    expect(givenName('  ')).toBe('  ');
  });
});
