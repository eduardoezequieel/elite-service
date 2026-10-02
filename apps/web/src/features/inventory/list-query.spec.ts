import { listQuery } from './list-query';

describe('listQuery (spec 102)', () => {
  it('manda `false` y deja fuera lo vacío', () => {
    expect(listQuery({ active: false, search: '', page: 2, roleId: undefined })).toBe(
      '?active=false&page=2',
    );
  });

  it('sin nada no agrega `?`', () => {
    expect(listQuery({})).toBe('');
  });
});
