'use client';

import { useRef, useState } from 'react';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { CREATE_CATEGORY_VALUE, categoryOptions } from '@/lib/category-options';

/**
 * El campo «Categoría» de los diálogos de servicio y de artículo (spec 086).
 * Un buscador: se escribe, filtra, y si ninguna se llama así ofrece crearla
 * ahí mismo, sin salir del diálogo. La nueva queda elegida.
 *
 * Sin escribir, la caja muestra la elegida; al enfocarla se selecciona el texto
 * para que lo que se teclee lo reemplace, y al salir sin elegir vuelve a ella.
 * Sin `onCreate` no hay fila de crear: quien lo monta decide por el permiso.
 */
export function CategoryField({
  id,
  options,
  value,
  onChange,
  onBlur,
  onCreate,
  invalid,
  pending = false,
}: {
  id?: string;
  options: readonly ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Crea la categoría y devuelve su id. */
  onCreate?: (name: string) => Promise<string>;
  invalid?: boolean;
  pending?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La recién creada, hasta que la lista vuelva del API con ella adentro.
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const busy = useRef(false);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    (created?.id === value ? created.name : '');
  const typed = editing ? query : '';
  const visible = categoryOptions(options, typed, {
    canCreate: onCreate !== undefined,
    creating,
  });

  async function create(name: string): Promise<void> {
    if (onCreate === undefined || busy.current) return;
    busy.current = true;
    setCreating(true);
    setError(null);
    try {
      const newId = await onCreate(name);
      setCreated({ id: newId, name });
      onChange(newId);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la categoría.');
    } finally {
      busy.current = false;
      setCreating(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-1.5"
      onFocus={(event) => {
        const input = event.target;
        // Después del clic, que si no deja el cursor donde cayó.
        if (input instanceof HTMLInputElement) requestAnimationFrame(() => input.select());
      }}
    >
      <Combobox
        mode="search"
        id={id}
        label="Categoría"
        placeholder={onCreate === undefined ? 'Buscá una categoría' : 'Buscá o creá una categoría'}
        options={visible}
        filter="off"
        value={value}
        query={editing ? query : selectedLabel}
        onQueryChange={(next) => {
          setEditing(true);
          setQuery(next);
          setError(null);
        }}
        onChange={(next, option) => {
          if (option.kind === 'action') {
            if (next === CREATE_CATEGORY_VALUE) void create(query.trim());
            return;
          }
          onChange(next);
          setEditing(false);
        }}
        onBlur={() => {
          if (!creating) setEditing(false);
          onBlur?.();
        }}
        invalid={invalid || error !== null}
        emptyText={pending ? 'Cargando…' : 'Todavía no hay categorías'}
      />
      {error === null ? null : (
        <p className="text-danger-text text-dense" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
