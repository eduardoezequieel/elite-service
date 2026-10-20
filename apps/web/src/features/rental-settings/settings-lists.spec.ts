import {
  addAccessory,
  insertAt,
  insertToken,
  clausesToText,
  removeAt,
  renameAccessory,
  sortAccessories,
  textToClauses,
} from './settings-lists';

describe('accesorios (120)', () => {
  it('agrega arriba, sin espacios de más', () => {
    expect(addAccessory(['Antena'], '  Gata ')).toEqual({ ok: true, items: ['Gata', 'Antena'] });
  });

  it('no repite, sin mirar mayúsculas ni tildes', () => {
    expect(addAccessory(['Tapicería'], 'tapiceria')).toEqual({ ok: false, reason: 'duplicate' });
    expect(addAccessory(['Antena'], '   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('renombra en su lugar', () => {
    expect(renameAccessory(['Antena', 'Radio'], 1, 'Radio o pantalla')).toEqual({
      items: ['Antena', 'Radio o pantalla'],
      removed: false,
      duplicate: false,
    });
  });

  it('renombrar a vacío lo quita; a uno que ya existe no cambia nada', () => {
    expect(renameAccessory(['Antena', 'Radio'], 0, ' ')).toMatchObject({
      items: ['Radio'],
      removed: true,
    });
    expect(renameAccessory(['Antena', 'Radio'], 0, 'radio')).toMatchObject({
      items: ['Antena', 'Radio'],
      duplicate: true,
    });
  });

  it('ordena A–Z en español', () => {
    expect(sortAccessories(['Vidrios', 'antena', 'Ñandú', 'Nudo', 'Llavero'])).toEqual([
      'antena',
      'Llavero',
      'Nudo',
      'Ñandú',
      'Vidrios',
    ]);
  });

  it('quitar y deshacer vuelve al mismo lugar', () => {
    const items = ['a', 'b', 'c'];
    const without = removeAt(items, 1);

    expect(without).toEqual(['a', 'c']);
    expect(insertAt(without, 1, 'b')).toEqual(items);
    expect(insertAt(['a'], 9, 'z')).toEqual(['a', 'z']);
  });
});

describe('cláusulas (120)', () => {
  it('una cláusula por párrafo, separadas por una línea en blanco', () => {
    expect(clausesToText(['uno', 'dos'])).toBe('uno\n\ndos');
    expect(textToClauses('uno\n\ndos')).toEqual(['uno', 'dos']);
  });

  it('descarta párrafos vacíos y deja los saltos simples dentro de la cláusula', () => {
    expect(textToClauses('\n uno\nsigue \n \n\n\n dos \n\n')).toEqual(['uno\nsigue', 'dos']);
    expect(textToClauses('   ')).toEqual([]);
  });

  it('inserta {ARRENDANTE} donde está el cursor', () => {
    expect(insertToken('el concesionario  en', '{ARRENDANTE}', 17)).toEqual({
      text: 'el concesionario {ARRENDANTE} en',
      caret: 29,
    });
    expect(insertToken('reemplazar ESTO', '{X}', 11, 15)).toEqual({
      text: 'reemplazar {X}',
      caret: 14,
    });
  });
});
