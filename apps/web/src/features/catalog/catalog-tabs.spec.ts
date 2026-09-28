import { PERMISSIONS } from '@elite/shared';

import {
  CATALOG_PERMISSIONS,
  allowedCatalogTabs,
  catalogTabKind,
  catalogTabQuery,
  resolveCatalogTab,
} from './catalog-tabs';

const SERVICES = PERMISSIONS.services.actions.read.key;
const INVENTORY = PERMISSIONS.inventory.actions.read.key;

function owning(...keys: string[]) {
  const owned = new Set(keys);
  return (key: string) => owned.has(key);
}

describe('allowedCatalogTabs', () => {
  it('cada pestaña pide su permiso', () => {
    expect(allowedCatalogTabs(owning(SERVICES, INVENTORY))).toEqual([
      'services',
      'products',
      'supplies',
    ]);
    expect(allowedCatalogTabs(owning(SERVICES))).toEqual(['services']);
    expect(allowedCatalogTabs(owning(INVENTORY))).toEqual(['products', 'supplies']);
    expect(allowedCatalogTabs(owning())).toEqual([]);
  });

  it('la pantalla se abre con cualquiera de las dos claves', () => {
    expect([...CATALOG_PERMISSIONS].sort()).toEqual([INVENTORY, SERVICES].sort());
  });
});

describe('resolveCatalogTab', () => {
  const all = allowedCatalogTabs(owning(SERVICES, INVENTORY));
  const inventoryOnly = allowedCatalogTabs(owning(INVENTORY));

  it('respeta la pestaña de la URL si se puede ver', () => {
    expect(resolveCatalogTab('supplies', all)).toBe('supplies');
    expect(resolveCatalogTab('products', inventoryOnly)).toBe('products');
  });

  it('sin pestaña, desconocida o sin permiso, cae en la primera permitida', () => {
    expect(resolveCatalogTab(undefined, all)).toBe('services');
    expect(resolveCatalogTab(null, inventoryOnly)).toBe('products');
    expect(resolveCatalogTab('stock', all)).toBe('services');
    expect(resolveCatalogTab(['supplies'], all)).toBe('services');
    expect(resolveCatalogTab('services', inventoryOnly)).toBe('products');
  });

  it('sin ninguna pestaña permitida no hay pestaña', () => {
    expect(resolveCatalogTab('services', [])).toBeNull();
  });
});

describe('catalogTabQuery', () => {
  it('la pestaña por defecto deja la URL limpia', () => {
    const all = allowedCatalogTabs(owning(SERVICES, INVENTORY));
    expect(catalogTabQuery('services', all)).toBe('');
    expect(catalogTabQuery('products', all)).toBe('tab=products');
    expect(catalogTabQuery('products', ['products', 'supplies'])).toBe('');
  });
});

describe('catalogTabKind', () => {
  it('traduce la pestaña al tipo de artículo', () => {
    expect(catalogTabKind('products')).toBe('PRODUCT');
    expect(catalogTabKind('supplies')).toBe('SUPPLY');
    expect(catalogTabKind('services')).toBeNull();
  });
});
