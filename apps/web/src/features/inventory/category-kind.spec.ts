import { categoriesHref, categoryKindFromParam, categoryKindParam } from './category-kind';

describe('categorías por tipo en la URL (072)', () => {
  it('lee el tipo; sin tipo o uno inválido, productos', () => {
    expect(categoryKindFromParam('supplies')).toBe('SUPPLY');
    expect(categoryKindFromParam('products')).toBe('PRODUCT');
    expect(categoryKindFromParam(undefined)).toBe('PRODUCT');
    expect(categoryKindFromParam('SUPPLY')).toBe('PRODUCT');
    expect(categoryKindFromParam(['supplies', 'products'])).toBe('PRODUCT');
  });

  it('escribe el enlace con la palabra de la pestaña de Catálogo', () => {
    expect(categoryKindParam('SUPPLY')).toBe('supplies');
    expect(categoriesHref('PRODUCT')).toBe('/settings/inventory/categories?kind=products');
    expect(categoriesHref('SUPPLY')).toBe('/settings/inventory/categories?kind=supplies');
  });
});
