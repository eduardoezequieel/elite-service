import {
  pageParam,
  pageValue,
  pushQuery,
  replaceParam,
  replaceQuery,
  singleParam,
} from './list-params';

describe('el estado de la lista en la URL (076)', () => {
  it('toma el valor solo si vino una vez', () => {
    expect(singleParam('abc')).toBe('abc');
    expect(singleParam('')).toBe('');
    expect(singleParam(['a', 'b'])).toBeNull();
    expect(singleParam(undefined)).toBeNull();
    expect(singleParam(null)).toBeNull();
  });

  it('la página es un entero desde 1; lo demás es la primera', () => {
    expect(pageParam('3')).toBe(3);
    expect(pageParam('0')).toBe(1);
    expect(pageParam('-2')).toBe(1);
    expect(pageParam('1.5')).toBe(1);
    expect(pageParam('dos')).toBe(1);
    expect(pageParam(undefined)).toBe(1);
  });

  it('la primera página no se escribe en la URL (101)', () => {
    expect(pageValue(1)).toBeNull();
    expect(pageValue(4)).toBe('4');
  });

  describe('replaceQuery y pushQuery', () => {
    const calls: string[] = [];
    const pushed: string[] = [];
    const location = { pathname: '/inventory', search: '' };

    beforeEach(() => {
      calls.length = 0;
      pushed.length = 0;
      location.search = '';
      Object.assign(globalThis, {
        window: {
          location,
          history: {
            replaceState: (_: unknown, __: string, url: string) => calls.push(url),
            pushState: (_: unknown, __: string, url: string) => pushed.push(url),
          },
        },
      });
    });

    afterAll(() => {
      Reflect.deleteProperty(globalThis, 'window');
    });

    it('escribe la query sin navegar, y una vacía deja la ruta limpia', () => {
      replaceQuery('kind=SUPPLY');
      location.search = '?kind=SUPPLY';
      replaceQuery('');

      expect(calls).toEqual(['/inventory?kind=SUPPLY', '/inventory']);
    });

    it('no reescribe si la barra ya dice lo mismo', () => {
      location.search = '?kind=SUPPLY';
      replaceQuery('kind=SUPPLY');

      expect(calls).toEqual([]);
    });

    it('replaceParam cambia una clave y deja las demás (101)', () => {
      location.search = '?q=ana&page=2';
      replaceParam('page', '3');
      replaceParam('page', null);

      expect(calls).toEqual(['/inventory?q=ana&page=3', '/inventory?q=ana']);
    });

    it('pushQuery apila la entrada, salvo que la barra ya diga lo mismo', () => {
      pushQuery('employee=e1');
      location.search = '?employee=e1';
      pushQuery('employee=e1');

      expect(pushed).toEqual(['/inventory?employee=e1']);
      expect(calls).toEqual([]);
    });
  });
});
