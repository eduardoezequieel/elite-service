import { matchesActor, sessionActors } from './cash-history';

const ANA = { id: 'u-1', fullName: 'Ana' };
const BETO = { id: 'u-2', fullName: 'Beto' };

const sameHands = { openedBy: ANA, closedBy: ANA };
const changedHands = { openedBy: ANA, closedBy: BETO };
const stillOpen = { openedBy: ANA, closedBy: null };

describe('las firmas del turno de caja (054)', () => {
  it('abierto y cerrado por la misma persona es un solo actor', () => {
    expect(sessionActors(sameHands)).toEqual([ANA]);
  });

  it('si cambió de mano salen los dos, en orden abrió → cerró', () => {
    expect(sessionActors(changedHands)).toEqual([ANA, BETO]);
  });

  it('un turno sin cerrar solo tiene a quien lo abrió', () => {
    expect(sessionActors(stillOpen)).toEqual([ANA]);
  });

  it('el filtro encuentra a quien abrió y a quien cerró', () => {
    expect(matchesActor(changedHands, ANA.id)).toBe(true);
    expect(matchesActor(changedHands, BETO.id)).toBe(true);
  });

  it('y no trae turnos de un tercero', () => {
    expect(matchesActor(changedHands, 'u-3')).toBe(false);
    expect(matchesActor(sameHands, BETO.id)).toBe(false);
  });
});
