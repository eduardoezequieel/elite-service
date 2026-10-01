/**
 * Un CSV exportado de Excel a filas `{ encabezado: valor }` (095 RN-9). El web
 * parsea y manda JSON; el API reconoce las columnas por nombre.
 *
 * Excel en español exporta con `;` y no con `,`: el separador se deduce de la
 * primera línea. Respeta comillas dobles (`"Pérez, Juan"`, `""` adentro) y
 * saltos de línea dentro de un campo entrecomillado.
 */

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', ',', '\t'].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));

  return counts.sort((left, right) => right.count - left.count)[0]?.delimiter ?? ',';
}

/** Las celdas crudas, fila por fila. */
export function parseCsvCells(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

/** El CSV con encabezados a filas `{ encabezado: valor }`; sin datos, `[]`. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [headerCells, ...dataRows] = parseCsvCells(text);
  const headers = (headerCells ?? []).map((header) => header.trim());

  return {
    headers,
    rows: dataRows.map((cells) =>
      Object.fromEntries(
        headers.map((header, index) => [header, (cells[index] ?? '').trim()] as const),
      ),
    ),
  };
}
