import { parseCsv } from './csv';

describe('parseCsv (095 RN-9)', () => {
  it('encabezados y filas con coma', () => {
    expect(parseCsv('Nombre,DUI\nAna López,0123\nBeto,\n')).toEqual({
      headers: ['Nombre', 'DUI'],
      rows: [
        { Nombre: 'Ana López', DUI: '0123' },
        { Nombre: 'Beto', DUI: '' },
      ],
    });
  });

  it('Excel en español: punto y coma, BOM y CRLF', () => {
    expect(parseCsv('\uFEFFNombre;Celular\r\nAna;7777-8888\r\n').rows).toEqual([
      { Nombre: 'Ana', Celular: '7777-8888' },
    ]);
  });

  it('respeta comillas, comillas dobles y saltos dentro del campo', () => {
    const { rows } = parseCsv('Nombre,Dirección\n"Pérez, Juan","Col. ""Escalón""\nSan Salvador"');

    expect(rows).toEqual([{ Nombre: 'Pérez, Juan', Dirección: 'Col. "Escalón"\nSan Salvador' }]);
  });

  it('ignora líneas vacías y un archivo sin datos', () => {
    expect(parseCsv('Nombre\n\n\n').rows).toEqual([]);
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });
});
