import { PERMISSIONS, PERMISSION_KEYS, isPermissionKey, listPermissionGroups } from './permissions';

describe('isPermissionKey', () => {
  it.each(['users.read', 'roles.manage', 'carwash.void', 'banking.manage'])(
    'reconoce %s',
    (key) => {
      expect(isPermissionKey(key)).toBe(true);
    },
  );

  it.each(['users.delete', 'admin', '', 'USERS.READ', 'users.read ', 'users'])(
    'rechaza %p',
    (value) => {
      expect(isPermissionKey(value)).toBe(false);
    },
  );

  it.each([
    'rentals.read',
    'rentals.manage',
    'rentals.charge',
    'rentals.reports',
    'rentals.settings',
    'fleet.read',
    'fleet.manage',
    'renters.read',
    'renters.manage',
  ])('reconoce la clave de renta de carros %s (095)', (key) => {
    expect(isPermissionKey(key)).toBe(true);
  });

  it('acepta todas las claves del catálogo', () => {
    expect(PERMISSION_KEYS.every(isPermissionKey)).toBe(true);
  });
});

describe('grupos de renta de carros (095)', () => {
  it('declara rentals, fleet y renters con sus acciones, en ese orden', () => {
    expect(Object.keys(PERMISSIONS.rentals.actions)).toEqual([
      'read',
      'manage',
      'charge',
      'reports',
      'settings',
    ]);
    expect(Object.keys(PERMISSIONS.fleet.actions)).toEqual(['read', 'manage']);
    expect(Object.keys(PERMISSIONS.renters.actions)).toEqual(['read', 'manage']);
  });
});

describe('grupo de combos (104)', () => {
  it('declara combos.read y combos.manage', () => {
    expect(Object.keys(PERMISSIONS.combos.actions)).toEqual(['read', 'manage']);
    expect(isPermissionKey('combos.read')).toBe(true);
    expect(isPermissionKey('combos.manage')).toBe(true);
  });
});

describe('listPermissionGroups', () => {
  const groups = listPermissionGroups();
  const listed = groups.flatMap((group) => group.permissions.map((permission) => permission.key));

  it('trae un grupo por módulo del catálogo, en el mismo orden', () => {
    expect(groups.map((group) => group.module)).toEqual(
      Object.values(PERMISSIONS).map((group) => group.module),
    );
  });

  it('cubre todas las claves, sin repetir ninguna', () => {
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it('cada clave es `module.action` de su propio grupo y tiene texto visible', () => {
    for (const group of groups) {
      expect(group.label).not.toBe('');

      for (const permission of group.permissions) {
        expect(permission.key).toMatch(new RegExp(`^${group.module}\\.[a-z]+$`));
        expect(permission.label.trim()).not.toBe('');
      }
    }
  });

  it('devuelve una copia: tocarla no cambia el catálogo', () => {
    groups[0]?.permissions.pop();

    expect(listPermissionGroups()[0]?.permissions.length).toBe(
      Object.keys(Object.values(PERMISSIONS)[0]?.actions ?? {}).length,
    );
  });
});
