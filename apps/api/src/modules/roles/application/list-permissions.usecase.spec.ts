import { PERMISSION_KEYS, PERMISSIONS } from '@elite/shared';

import { ListPermissionsUseCase } from './list-permissions.usecase';

describe('ListPermissionsUseCase', () => {
  /**
   * Se compara contra el registro, no contra una lista escrita a mano: la regla
   * es "el codigo es la fuente de verdad" (RN-2), asi que cada spec que agrega
   * su modulo tiene que pasar sin editar este test. Fijar los nombres aca solo
   * probaria que alguien los copio dos veces.
   */
  it('returns the shared catalog grouped by module (RN-2: code is the source of truth)', () => {
    const groups = new ListPermissionsUseCase().execute();

    expect(groups.map((group) => group.module)).toEqual(Object.keys(PERMISSIONS));
    expect(
      groups.flatMap((group) => group.permissions.map((permission) => permission.key)),
    ).toEqual(PERMISSION_KEYS);
  });

  it('keys every permission as `module.action`, matching its group', () => {
    for (const group of new ListPermissionsUseCase().execute()) {
      for (const permission of group.permissions) {
        expect(permission.key.startsWith(`${group.module}.`)).toBe(true);
      }
    }
  });

  it('labels every permission so the matrix can be rendered', () => {
    const groups = new ListPermissionsUseCase().execute();

    for (const group of groups) {
      expect(group.label.length).toBeGreaterThan(0);

      for (const permission of group.permissions) {
        expect(permission.label.length).toBeGreaterThan(0);
      }
    }
  });
});
