'use client';

import { ArrowDownAZ, Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/features/inventory/components/form-fields';
import {
  addAccessory,
  insertAt,
  removeAt,
  renameAccessory,
  sortAccessories,
} from '../settings-lists';
import type { NotifyUndo, SettingsFormApi } from './settings-form-types';
import { EDIT } from './settings-form-types';

const DUPLICATE = 'Ese accesorio ya está en la lista.';

/**
 * Accesorios (120): fichas. Se agrega arriba sin repetir, un toque en el
 * nombre lo renombra, × lo quita con Deshacer, y «Ordenar A–Z».
 */
export function AccessoriesPanel({
  form,
  canEdit,
  notifyUndo,
}: {
  form: SettingsFormApi;
  canEdit: boolean;
  notifyUndo: NotifyUndo;
}) {
  const items = form.watch('accessories');
  const errors = form.formState.errors;
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);

  const setItems = (next: string[]) => form.setValue('accessories', next, EDIT);

  function add(): void {
    const result = addAccessory(items, draft);
    if (!result.ok) {
      setMessage(result.reason === 'duplicate' ? DUPLICATE : null);
      return;
    }
    setItems(result.items);
    setDraft('');
    setMessage(null);
  }

  function remove(index: number): void {
    const gone = items[index];
    if (gone === undefined) return;
    setItems(removeAt(items, index));
    notifyUndo(`Quitado: ${gone}`, () =>
      setItems(insertAt(form.getValues('accessories'), index, gone)),
    );
  }

  function commitRename(index: number, name: string): void {
    setRenaming(null);
    const before = items[index];
    if (before === undefined || name.trim() === before) return;

    const result = renameAccessory(items, index, name);
    if (result.duplicate) {
      setMessage(DUPLICATE);
      return;
    }
    setMessage(null);
    setItems(result.items);
    if (result.removed) {
      notifyUndo(`Quitado: ${before}`, () =>
        setItems(insertAt(form.getValues('accessories'), index, before)),
      );
    }
  }

  function onRenameKey(event: KeyboardEvent<HTMLInputElement>, index: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename(index, event.currentTarget.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setRenaming(null);
    }
  }

  const listError =
    errors.accessories?.message ??
    errors.accessories?.root?.message ??
    (Array.isArray(errors.accessories)
      ? errors.accessories.find((error) => error?.message)?.message
      : undefined);

  return (
    <div className="border-line-soft bg-surface flex flex-col rounded-card border">
      {canEdit ? (
        <div className="border-line-soft flex flex-col gap-2 border-b px-4.5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-60 flex-1 gap-2">
              <Input
                aria-label="Nuevo accesorio"
                placeholder="Agregar accesorio, p. ej. Gata"
                maxLength={80}
                autoComplete="off"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setMessage(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    add();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={add}>
                <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
                Agregar
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={items.length < 2}
              onClick={() => setItems(sortAccessories(items))}
            >
              <ArrowDownAZ className="size-icon" strokeWidth={1.5} aria-hidden />
              Ordenar A–Z
            </Button>
          </div>
          {message === null ? null : (
            <p className="text-danger-text text-label" role="alert">
              {message}
            </p>
          )}
        </div>
      ) : null}

      <ul className="flex flex-wrap gap-2 px-4.5 pt-4 pb-4.5">
        {items.map((name, index) => (
          <li
            key={`${index}-${name}`}
            className="border-line bg-surface-2 inline-flex min-h-9 items-center rounded-full border pr-0.5 pl-1 [[data-density=bahia]_&]:min-h-12"
          >
            {renaming === index ? (
              <input
                aria-label={`Renombrar ${name}`}
                defaultValue={name}
                maxLength={80}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => commitRename(index, event.currentTarget.value)}
                onKeyDown={(event) => onRenameKey(event, index)}
                className="bg-surface text-text ml-1 h-7 w-[16ch] rounded-full px-2 [[data-density=bahia]_&]:h-10"
              />
            ) : (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setRenaming(index)}
                className="text-text hover:decoration-text-faint px-2 font-medium underline-offset-4 hover:underline disabled:no-underline"
              >
                {name}
              </button>
            )}
            {canEdit ? (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-text-dim hover:bg-surface-3 hover:text-danger-text inline-flex size-7 items-center justify-center rounded-full [[data-density=bahia]_&]:size-(--touch-min)"
              >
                <X className="size-3.5" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">Quitar {name}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="px-4.5 pb-4">
        {canEdit ? (
          <p className="text-text-faint text-dense">Toque un nombre para cambiarlo.</p>
        ) : null}
        <FieldError message={listError} />
      </div>
    </div>
  );
}
