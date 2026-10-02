import { withPageQuery } from './use-list-page';

describe('withPageQuery (spec 102)', () => {
  it('agrega la página a lo que la pantalla ya escribe', () => {
    expect(withPageQuery('kind=supplies', 3)).toBe('kind=supplies&page=3');
  });

  it('lee la query tal como la da `location.search`', () => {
    expect(withPageQuery('?from=%2Fx&page=2', 3)).toBe('from=%2Fx&page=3');
  });

  it('la primera página deja la URL sin `page`', () => {
    expect(withPageQuery('kind=supplies&page=4', 1)).toBe('kind=supplies');
    expect(withPageQuery('', 1)).toBe('');
  });
});
