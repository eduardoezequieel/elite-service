import { PERMISSIONS } from '@elite/shared';

import {
  NAV_ITEMS,
  firstAllowedHrefFrom,
  isNavItemActive,
  navItemAllowed,
  resolveWorkspaceNav,
} from './nav-items';

const SERVICES = PERMISSIONS.services.actions.read.key;
const INVENTORY = PERMISSIONS.inventory.actions.read.key;
const CARWASH = PERMISSIONS.carwash.actions.read.key;
const RENTALS = PERMISSIONS.rentals.actions.read.key;
const USERS = PERMISSIONS.users.actions.read.key;
const ROLES = PERMISSIONS.roles.actions.read.key;

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

describe('Espacios de trabajo (094)', () => {
  function hrefs(nav: ReturnType<typeof resolveWorkspaceNav>) {
    return nav.sections.flatMap((section) => section.items.map((item) => item.href));
  }

  it('el espacio activo es el de la pestaña activa', () => {
    const can = owning(CARWASH, RENTALS);

    const carwash = resolveWorkspaceNav('/carwash', can);
    expect(carwash.workspaces.map((workspace) => workspace.key)).toEqual(['carwash', 'rentals']);
    expect(carwash.active?.key).toBe('carwash');
    expect(hrefs(carwash)).toEqual(['/carwash', '/sales']);

    const rentals = resolveWorkspaceNav('/rentals', can);
    expect(rentals.active?.key).toBe('rentals');
    expect(hrefs(rentals)).toEqual([
      '/rentals',
      '/rentals/calendar',
      '/rentals/agreements',
      '/rentals/availability',
    ]);
  });

  it('una subpantalla cae en el espacio de su pestaña', () => {
    expect(resolveWorkspaceNav('/carwash/cash/42', owning(CARWASH, RENTALS)).active?.key).toBe(
      'carwash',
    );
  });

  it('elegir un espacio lleva a su primera pestaña permitida', () => {
    const nav = resolveWorkspaceNav('/carwash', owning(CARWASH, RENTALS, ROLES));
    expect(nav.workspaces.map((workspace) => workspace.href)).toEqual([
      '/carwash',
      '/rentals',
      '/settings/roles',
    ]);
  });

  it('Usuarios y Roles viven en Administración, no en el lavado', () => {
    const nav = resolveWorkspaceNav('/settings/users', owning(USERS, ROLES, CARWASH));
    expect(nav.active?.key).toBe('admin');
    expect(hrefs(nav)).toEqual(['/settings/users', '/settings/roles']);
  });

  it('un espacio sin pestañas permitidas no existe', () => {
    const nav = resolveWorkspaceNav('/carwash', owning(CARWASH, USERS));
    expect(nav.workspaces.map((workspace) => workspace.key)).toEqual(['carwash', 'admin']);
  });

  it('con un solo espacio no hay nada que elegir', () => {
    const nav = resolveWorkspaceNav(
      '/carwash',
      owning(CARWASH, PERMISSIONS.carwash.actions.cash.key),
    );
    expect(nav.workspaces).toHaveLength(1);
    expect(hrefs(nav)).toEqual(['/carwash', '/carwash/cash', '/sales']);
  });

  it('una ruta que ninguna pestaña permitida cubre cae en el primer espacio', () => {
    expect(resolveWorkspaceNav('/settings/users', owning(CARWASH, RENTALS)).active?.key).toBe(
      'carwash',
    );
  });

  it('sin pestañas no hay espacio activo', () => {
    const nav = resolveWorkspaceNav('/carwash', owning());
    expect(nav.workspaces).toEqual([]);
    expect(nav.active).toBeNull();
    expect(nav.sections).toEqual([]);
  });

  it('el login recorre Lavado → Renta de carros → Administración', () => {
    expect(firstAllowedHrefFrom([RENTALS])).toBe('/rentals');
    expect(firstAllowedHrefFrom([USERS, RENTALS])).toBe('/rentals');
    expect(firstAllowedHrefFrom([USERS, RENTALS, CARWASH])).toBe('/carwash');
    expect(firstAllowedHrefFrom([USERS])).toBe('/settings/users');
  });
});

describe('Renta de carros en el riel (095)', () => {
  const RENTAL_HREFS = [
    '/rentals',
    '/rentals/calendar',
    '/rentals/agreements',
    '/rentals/availability',
    '/rentals/cash',
    '/rentals/customers',
    '/rentals/fleet',
    '/rentals/maintenance',
    '/rentals/expenses',
    '/rentals/profitability',
    '/rentals/settings',
  ];

  const ALL_RENTAL_KEYS = [
    RENTALS,
    PERMISSIONS.rentals.actions.charge.key,
    PERMISSIONS.rentals.actions.reports.key,
    PERMISSIONS.rentals.actions.settings.key,
    PERMISSIONS.fleet.actions.read.key,
    PERMISSIONS.renters.actions.read.key,
  ];

  it('declara las 11 rutas, en tres grupos del mismo espacio', () => {
    const nav = resolveWorkspaceNav('/rentals', owning(...ALL_RENTAL_KEYS));

    expect(nav.sections.map((section) => section.label)).toEqual([
      'Operación',
      'Flota',
      'Configuración',
    ]);
    expect(nav.sections.flatMap((section) => section.items.map((item) => item.href))).toEqual(
      RENTAL_HREFS,
    );
  });

  it('cada pestaña pide su clave', () => {
    expect(navItemAllowed(itemAt('/rentals/cash'), owning(RENTALS))).toBe(false);
    expect(
      navItemAllowed(itemAt('/rentals/cash'), owning(PERMISSIONS.rentals.actions.charge.key)),
    ).toBe(true);
    expect(
      navItemAllowed(itemAt('/rentals/fleet'), owning(PERMISSIONS.fleet.actions.read.key)),
    ).toBe(true);
    expect(
      navItemAllowed(itemAt('/rentals/customers'), owning(PERMISSIONS.renters.actions.read.key)),
    ).toBe(true);
    expect(
      navItemAllowed(itemAt('/rentals/settings'), owning(PERMISSIONS.rentals.actions.settings.key)),
    ).toBe(true);
    expect(
      navItemAllowed(
        itemAt('/rentals/profitability'),
        owning(PERMISSIONS.rentals.actions.reports.key),
      ),
    ).toBe(true);
  });

  it('con solo fleet.read, el espacio abre en Flota', () => {
    const nav = resolveWorkspaceNav('/carwash', owning(PERMISSIONS.fleet.actions.read.key));

    expect(nav.workspaces.map((workspace) => workspace.href)).toEqual(['/rentals/fleet']);
  });

  it('la ficha de un carro activa la pestaña Flota, no Inicio', () => {
    const nav = resolveWorkspaceNav('/rentals/fleet/abc', owning(...ALL_RENTAL_KEYS));

    expect(nav.active?.key).toBe('rentals');
    expect(isNavItemActive('/rentals/fleet/abc', '/rentals/fleet')).toBe(true);
    expect(isNavItemActive('/rentals/fleet/abc', '/rentals')).toBe(false);
  });
});
