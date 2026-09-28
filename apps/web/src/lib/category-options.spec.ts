import { CREATE_CATEGORY_VALUE, categoryOptions } from './category-options';

const OPTIONS = [
  { value: 'a', label: 'Lavado premium' },
  { value: 'b', label: 'Pulido de pintura' },
  { value: 'c', label: 'Limpieza de tapicería' },
];

const CAN = { canCreate: true, creating: false };

describe('categoryOptions', () => {
  it('lists every category when nothing is typed, without the create row', () => {
    expect(categoryOptions(OPTIONS, '  ', CAN)).toEqual(OPTIONS);
  });

  it('filters ignoring accents and case', () => {
    const values = categoryOptions(OPTIONS, 'TAPICERIA', CAN).map((option) => option.value);
    expect(values).toContain('c');
    expect(values).not.toContain('a');
  });

  it('offers to create what was typed when no category has that name', () => {
    const result = categoryOptions(OPTIONS, '  Pulido ', CAN);
    expect(result.map((option) => option.value)).toEqual(['b', CREATE_CATEGORY_VALUE]);
    expect(result[1]).toEqual({
      value: CREATE_CATEGORY_VALUE,
      label: 'Crear categoría: «Pulido»',
      kind: 'action',
    });
  });

  it('does not offer to create a name that already exists', () => {
    const values = categoryOptions(OPTIONS, 'lavado PREMIUM', CAN).map((option) => option.value);
    expect(values).toEqual(['a']);
  });

  it('shows the create row even when nothing matches', () => {
    const values = categoryOptions(OPTIONS, 'Motos', CAN).map((option) => option.value);
    expect(values).toEqual([CREATE_CATEGORY_VALUE]);
  });

  it('marks the row while the category is being created', () => {
    const result = categoryOptions(OPTIONS, 'Motos', { canCreate: true, creating: true });
    expect(result.at(-1)?.label).toBe('Creando…');
  });

  it('never offers to create without the permission', () => {
    expect(categoryOptions(OPTIONS, 'Motos', { canCreate: false, creating: false })).toEqual([]);
  });
});
