import { sectionFor } from './frame-section';

describe('pestaña activa del marco de inventario', () => {
  it('la raíz es Existencias', () => {
    expect(sectionFor('/inventory')).toBe('stock');
  });

  it('cada pestaña sale de su propia ruta', () => {
    expect(sectionFor('/inventory/movements')).toBe('movements');
    expect(sectionFor('/inventory/consumption')).toBe('consumption');
  });

  it('cualquier otra ruta cae en Existencias', () => {
    expect(sectionFor('/inventory/movementsx')).toBe('stock');
    expect(sectionFor('/settings')).toBe('stock');
  });
});
