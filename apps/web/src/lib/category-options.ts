import { filterOptions, foldText, type ComboboxOption } from './combobox';

/** El valor de la fila «Crear categoría»: nunca choca con un id (son uuid). */
export const CREATE_CATEGORY_VALUE = '__create_category__';

/**
 * Lo que muestra el buscador de categorías (spec 086): las que coinciden con lo
 * escrito y, si ninguna se llama igual —sin acentos ni mayúsculas—, la fila para
 * crearla. Sin permiso para crear, o sin nada escrito, no hay fila.
 */
export function categoryOptions(
  options: readonly ComboboxOption[],
  typed: string,
  { canCreate, creating }: { canCreate: boolean; creating: boolean },
): ComboboxOption[] {
  const name = typed.trim();
  const visible = filterOptions(options, name);
  if (!canCreate || name === '') return visible;

  const needle = foldText(name);
  if (options.some((option) => foldText(option.label.trim()) === needle)) return visible;

  return [
    ...visible,
    {
      value: CREATE_CATEGORY_VALUE,
      label: creating ? 'Creando…' : `Crear categoría: «${name}»`,
      kind: 'action',
    },
  ];
}
