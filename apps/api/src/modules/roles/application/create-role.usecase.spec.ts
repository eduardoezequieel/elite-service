import { API_ERROR_CODES, type CreateRoleInput } from '@elite/shared';

import { InMemoryRoleRepository, buildRole } from '../infrastructure/in-memory-role.repository';
import { CreateRoleUseCase } from './create-role.usecase';

/**
 * Una clave que no existe en el catálogo. Los tipos de `@elite/shared` la
 * rechazan en compilación, pero por HTTP puede llegar cualquier cosa: la capa
 * de aplicación no confía a ciegas (RN-2).
 */
const unknownPermissionKey =
  'work-orders.read' as unknown as CreateRoleInput['permissionKeys'][number];

describe('CreateRoleUseCase', () => {
  it('creates a role without any permission (RN-6b: an empty role is valid)', async () => {
    const roles = new InMemoryRoleRepository();
    const useCase = new CreateRoleUseCase(roles);

    const created = await useCase.execute({ name: 'Recepción', permissionKeys: [] });

    expect(created).toMatchObject({
      name: 'Recepción',
      description: null,
      permissionKeys: [],
      userCount: 0,
    });
    await expect(roles.findById(created.id)).resolves.not.toBeNull();
  });

  it('creates a role with permissions, deduplicated and in a stable order', async () => {
    const useCase = new CreateRoleUseCase(new InMemoryRoleRepository());

    const created = await useCase.execute({
      name: 'Taller',
      description: 'La bahía',
      permissionKeys: ['roles.read', 'users.read', 'roles.read'],
    });

    expect(created.permissionKeys).toEqual(['roles.read', 'users.read']);
    expect(created.description).toBe('La bahía');
  });

  it('rejects a name already taken with 409 NAME_TAKEN', async () => {
    const roles = new InMemoryRoleRepository([buildRole({ id: 'role-1', name: 'Recepción' })]);
    const useCase = new CreateRoleUseCase(roles);

    await expect(useCase.execute({ name: 'recepción', permissionKeys: [] })).rejects.toMatchObject({
      status: 409,
      response: { code: API_ERROR_CODES.NAME_TAKEN },
    });
    await expect(roles.findAll()).resolves.toHaveLength(1);
  });

  it('rejects permission keys outside the shared catalog with 422 (RN-2)', async () => {
    const roles = new InMemoryRoleRepository();
    const useCase = new CreateRoleUseCase(roles);

    await expect(
      useCase.execute({ name: 'Inventado', permissionKeys: [unknownPermissionKey] }),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        details: { permissionKeys: ['work-orders.read'] },
      },
    });
    await expect(roles.findAll()).resolves.toHaveLength(0);
  });
});
