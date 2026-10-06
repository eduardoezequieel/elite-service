import { documentLabel, intervalLabel, whatsappUrl } from './maintenance-view';

describe('maintenance-view (099)', () => {
  it('rotula el intervalo y el documento', () => {
    expect(intervalLabel({ intervalKm: 5000, intervalDays: 90 })).toBe('Cada 5000 km o 90 días');
    expect(intervalLabel({ intervalKm: null, intervalDays: 1 })).toBe('Cada 1 día');
    expect(documentLabel(-3)).toBe('Venció hace 3 días');
    expect(documentLabel(0)).toBe('Vence hoy');
  });

  it('arma el enlace de wa.me con el texto codificado', () => {
    expect(whatsappUrl('*Hola* taller\nAceite')).toBe(
      'https://wa.me/?text=*Hola*%20taller%0AAceite',
    );
  });
});
