import { PERMISSION_KEYS } from '@elite/shared';

import { ListPermissionsUseCase } from './list-permissions.usecase';

describe('ListPermissionsUseCase', () => {
  it('returns the shared catalog grouped by module (RN-2: code is the source of truth)', () => {
    const groups = new ListPermissionsUseCase().execute();

    expect(groups.map((group) => group.module)).toEqual(['users', 'roles']);
    expect(groups.flatMap((group) => group.permissions.map((permission) => permission.key))).toEqual(
      PERMISSION_KEYS,
    );
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
