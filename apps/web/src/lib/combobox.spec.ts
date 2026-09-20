import {
  filterOptions,
  foldText,
  nextTypeaheadBuffer,
  placeComboboxPanel,
  typeaheadIndex,
  type ComboboxOption,
} from './combobox';

const BODY: ComboboxOption[] = [
  { value: 'sedan', label: 'Sedán' },
  { value: 'pickup', label: 'Camioneta' },
  { value: 'moto', label: 'Moto' },
];

const PEOPLE: ComboboxOption[] = [
  { value: 'c1', label: 'Juan Pérez', meta: '7777-8888' },
  { value: 'c2', label: 'Juana Ramírez', meta: '7012-3344' },
  { value: 'c3', label: 'José Martínez', meta: '6555-0101' },
];

describe('combobox (spec 034)', () => {
  it('pliega acentos para comparar', () => {
    expect(foldText('José')).toBe('jose');
    expect(foldText('SEDÁN')).toBe('sedan');
  });

  it('filtra por etiqueta y por teléfono, sin acento', () => {
    expect(filterOptions(PEOPLE, 'jose').map((option) => option.value)).toEqual(['c3']);
    expect(filterOptions(PEOPLE, 'juan').map((option) => option.value)).toEqual(['c1', 'c2']);
    expect(filterOptions(PEOPLE, '6555').map((option) => option.value)).toEqual(['c3']);
    expect(filterOptions(PEOPLE, '')).toHaveLength(3);
  });

  it('la fila de acción sobrevive a cualquier filtro (047)', () => {
    const withAction: ComboboxOption[] = [
      ...PEOPLE,
      { value: '__create__', label: 'Crear nuevo: «Zoe»', kind: 'action' },
    ];

    expect(filterOptions(withAction, 'zzz').map((option) => option.value)).toEqual(['__create__']);
    expect(filterOptions(withAction, 'jose').map((option) => option.value)).toEqual([
      'c3',
      '__create__',
    ]);
  });

  it('el typeahead salta al prefijo y recorre la misma letra', () => {
    expect(typeaheadIndex(BODY, 'c', -1)).toBe(1);
    expect(typeaheadIndex(BODY, 's', -1)).toBe(0);
    expect(typeaheadIndex(BODY, 'ss', 0)).toBe(0);

    const sameStart: ComboboxOption[] = [
      { value: 'a', label: 'Sedán' },
      { value: 'b', label: 'SUV' },
    ];
    expect(typeaheadIndex(sameStart, 'ss', 0)).toBe(1);
  });

  it('el buffer de typeahead se reinicia a los 700 ms', () => {
    expect(nextTypeaheadBuffer('s', 0, 'e', 100).buffer).toBe('se');
    expect(nextTypeaheadBuffer('s', 0, 'e', 701).buffer).toBe('e');
  });

  it('el panel abre abajo, se da vuelta y scrollea si no cabe', () => {
    const box = { top: 100, bottom: 148, left: 40, width: 280 };
    const viewport = { width: 1280, height: 800 };

    const below = placeComboboxPanel(box, 120, 112, viewport);
    expect(below.top).toBe(156);
    expect(below.width).toBe(280);
    expect(below.listMaxHeight).toBeNull();

    const tight = { top: 700, bottom: 748, left: 40, width: 280 };
    const above = placeComboboxPanel(tight, 120, 112, viewport);
    expect(above.top).toBe(700 - 8 - 120);
    expect(above.listMaxHeight).toBeNull();

    const squeezed = { top: 300, bottom: 348, left: 40, width: 280 };
    const tiny = { width: 400, height: 400 };
    const clipped = placeComboboxPanel(squeezed, 360, 340, tiny);
    expect(clipped.listMaxHeight).not.toBeNull();
    expect(clipped.listMaxHeight ?? 0).toBeGreaterThanOrEqual(64);
  });

  it('el ancla manda el ancho y nunca se sale de la pantalla (047)', () => {
    const box = { top: 100, bottom: 148, left: 40, width: 280 };
    const viewport = { width: 1280, height: 800 };

    const wide = placeComboboxPanel(box, 120, 112, viewport, { left: 40, width: 600 });
    expect(wide.left).toBe(40);
    expect(wide.width).toBe(600);

    const phone = { width: 390, height: 800 };
    const tooWide = placeComboboxPanel(box, 120, 112, phone, { left: 24, width: 600 });
    expect(tooWide.width).toBe(390 - 12 * 2);
    expect(tooWide.left).toBe(12);

    const offRight = placeComboboxPanel(box, 120, 112, phone, { left: 300, width: 200 });
    expect(offRight.left).toBe(390 - 12 - 200);
  });
});
