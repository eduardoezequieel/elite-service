import { conflictOf, syncNote } from './use-ticket-note';

describe('la nota que tocan dos personas a la vez (041, 042)', () => {
  it('sin nada escrito, adopta la que llega del otro lado', () => {
    const draft = { value: 'test', base: 'test' };

    expect(syncNote(draft, 'Hola, nueva nota')).toEqual({
      value: 'Hola, nueva nota',
      base: 'Hola, nueva nota',
    });
    expect(conflictOf(syncNote(draft, 'Hola, nueva nota'), 'Hola, nueva nota')).toBeNull();
  });

  it('con algo escrito, no lo pisa y avisa del conflicto', () => {
    const draft = { value: 'lo mío', base: 'test' };
    const next = syncNote(draft, 'lo de la pista');

    expect(next).toEqual(draft);
    expect(conflictOf(next, 'lo de la pista')).toBe('lo de la pista');
  });

  it('cuando la del servidor ya es lo tecleado, sincroniza sin conflicto', () => {
    const draft = { value: 'lo mío', base: 'test' };
    const next = syncNote(draft, 'lo mío');

    expect(next).toEqual({ value: 'lo mío', base: 'lo mío' });
    expect(conflictOf(next, 'lo mío')).toBeNull();
  });

  it('sin cambios del otro lado, no toca nada', () => {
    const draft = { value: 'a medio escribir', base: 'test' };

    expect(syncNote(draft, 'test')).toBe(draft);
    expect(conflictOf(draft, 'test')).toBeNull();
  });

  it('borrar la nota del otro lado también llega', () => {
    expect(syncNote({ value: 'test', base: 'test' }, '')).toEqual({ value: '', base: '' });
  });
});
