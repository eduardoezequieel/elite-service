/**
 * La query de un `GET` de lista paginada (spec 102). Solo cae lo que no vino:
 * `false` sí viaja, porque `active=false` es «solo los inactivos».
 */
export type ListQueryValue = string | number | boolean | undefined;

export function listQuery(params: Record<string, ListQueryValue>): string {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter((entry): entry is [string, string | number | boolean] => {
        const value = entry[1];
        return value !== undefined && value !== '';
      })
      .map(([key, value]) => [key, String(value)]),
  ).toString();

  return search === '' ? '' : `?${search}`;
}
