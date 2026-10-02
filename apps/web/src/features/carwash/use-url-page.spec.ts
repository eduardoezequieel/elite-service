import { withUrlPage } from './hooks/use-url-page';

describe('withUrlPage (spec 102)', () => {
  it('pone la página con su nombre y conserva lo demás', () => {
    expect(withUrlPage('?page=2&from=%2Fcarwash', 'vehiclesPage', 3)).toBe(
      'page=2&from=%2Fcarwash&vehiclesPage=3',
    );
  });

  it('la primera página no se escribe', () => {
    expect(withUrlPage('?vehiclesPage=4', 'vehiclesPage', 1)).toBe('');
  });
});
