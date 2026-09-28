import { PERMISSIONS } from '@elite/shared';

import { NAV_ITEMS, firstAllowedHrefFrom, navItemAllowed } from './nav-items';

const SERVICES = PERMISSIONS.services.actions.read.key;
const INVENTORY = PERMISSIONS.inventory.actions.read.key;

function itemAt(href: string) {
  const item = NAV_ITEMS.find((candidate) => candidate.href === href);
  if (item === undefined) throw new Error(`sin pestaña ${href}`);
  return item;
}

function owning(...keys: string[]) {
  const owned = new Set(keys);
  return (key: string) => owned.has(key);
}

describe('Catálogo en el riel (068)', () => {
  it('se ve con servicios o con inventario', () => {
    const catalog = itemAt('/settings/catalog');
    expect(navItemAllowed(catalog, owning(SERVICES))).toBe(true);
    expect(navItemAllowed(catalog, owning(INVENTORY))).toBe(true);
    expect(navItemAllowed(catalog, owning())).toBe(false);
  });

  it('«Categorías de inventario» ya no es una pestaña', () => {
    expect(NAV_ITEMS.some((item) => item.href === '/settings/inventory/categories')).toBe(false);
  });

  it('una clave suelta sigue pidiendo exactamente esa', () => {
    const employees = itemAt('/settings/employees');
    expect(navItemAllowed(employees, owning(PERMISSIONS.employees.actions.read.key))).toBe(true);
    expect(navItemAllowed(employees, owning(SERVICES))).toBe(false);
  });

  it('el login manda a la primera pestaña que alguna clave cubre', () => {
    expect(firstAllowedHrefFrom([SERVICES])).toBe('/settings/catalog');
    expect(firstAllowedHrefFrom([INVENTORY])).toBe('/inventory');
  });
});
