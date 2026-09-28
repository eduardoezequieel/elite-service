import { arrivedKeys, changeMark, countChange, rose } from './motion';

describe('arrivedKeys', () => {
  it('marks one new row when the rest of the list stays', () => {
    expect([...arrivedKeys(['a', 'b'], ['c', 'a', 'b'])]).toEqual(['c']);
  });

  it('marks up to two new rows at once', () => {
    expect([...arrivedKeys(['a'], ['c', 'b', 'a'])]).toEqual(['c', 'b']);
  });

  it('marks nothing when the list was empty (first data after loading)', () => {
    expect(arrivedKeys([], ['a', 'b']).size).toBe(0);
  });

  it('marks nothing when no row is shared (another page)', () => {
    expect(arrivedKeys(['a', 'b'], ['c', 'd']).size).toBe(0);
  });

  it('marks nothing when more than two rows are new (another filter)', () => {
    expect(arrivedKeys(['a'], ['a', 'b', 'c', 'd']).size).toBe(0);
  });

  it('marks nothing when rows only leave or reorder', () => {
    expect(arrivedKeys(['a', 'b', 'c'], ['c', 'a']).size).toBe(0);
  });
});

describe('countChange', () => {
  it('does not count the initial value', () => {
    const state = { value: 'Listo', count: 0 };

    expect(countChange(state, 'Listo')).toBe(state);
  });

  it('counts every difference by default', () => {
    const once = countChange({ value: 'En espera', count: 0 }, 'Lavando');
    const twice = countChange(once, 'Listo');

    expect(once).toEqual({ value: 'Lavando', count: 1 });
    expect(twice).toEqual({ value: 'Listo', count: 2 });
  });

  it('tracks the value without counting when the change does not qualify', () => {
    expect(countChange({ value: 3, count: 1 }, 2, rose)).toEqual({ value: 2, count: 1 });
    expect(countChange({ value: 2, count: 1 }, 4, rose)).toEqual({ value: 4, count: 2 });
  });
});

describe('changeMark', () => {
  it('has no mark before the first change', () => {
    expect(changeMark(0)).toBeUndefined();
  });

  it('alternates so consecutive changes restart the animation', () => {
    expect([1, 2, 3].map(changeMark)).toEqual(['odd', 'even', 'odd']);
  });
});
