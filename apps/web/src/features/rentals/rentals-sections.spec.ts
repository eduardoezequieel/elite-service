import { RENTALS_SECTIONS, rentalsSectionFor } from './rentals-sections';

describe('los tabs de Rentas (117)', () => {
  it('son Libre, Rentas e Historial, cada uno con su URL', () => {
    expect(RENTALS_SECTIONS.map((section) => [section.label, section.href])).toEqual([
      ['Libre', '/rentals/available'],
      ['Rentas', '/rentals/agreements'],
      ['Historial', '/rentals/agreements/history'],
    ]);
  });

  it('el tab activo sale de la ruta', () => {
    expect(rentalsSectionFor('/rentals/available')).toBe('free');
    expect(rentalsSectionFor('/rentals/agreements')).toBe('current');
    expect(rentalsSectionFor('/rentals/agreements/history')).toBe('history');
  });
});
