import { API_ERROR_CODES } from '@elite/shared';

import { InMemoryRoleRepository, buildRole } from '../infrastructure/in-memory-role.repository';
import { DeleteRoleUseCase } from './delete-role.usecase';

describe('DeleteRoleUseCase', () => {
  it('deletes a role that nobody has assigned', async () => {
    const roles = new InMemoryRoleRepository([buildRole({ id: 'role-1', name: 'Vacío' })]);
    const useCase = new DeleteRoleUseCase(roles);

    await useCase.execute('role-1');

    await expect(roles.findById('role-1')).resolves.toBeNull();
  });

  it('refuses to delete a role with users assigned: 409 ROLE_IN_USE (RN-6)', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({ id: 'role-1', name: 'Recepción', userCount: 3 }),
    ]);
    const useCase = new DeleteRoleUseCase(roles);

    await expect(useCase.execute('role-1')).rejects.toMatchObject({
      status: 409,
      response: { code: API_ERROR_CODES.ROLE_IN_USE, details: { userCount: 3 } },
    });
    await expect(roles.findById('role-1')).resolves.not.toBeNull();
  });

  it('answers 404 NOT_FOUND for a role that does not exist', async () => {
    const useCase = new DeleteRoleUseCase(new InMemoryRoleRepository());

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      status: 404,
      response: { code: API_ERROR_CODES.NOT_FOUND },
    });
  });
});
