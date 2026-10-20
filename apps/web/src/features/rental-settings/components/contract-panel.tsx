'use client';

import { RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';
import type { RentalSettings } from '@elite/shared';
import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FieldError } from '@/features/inventory/components/form-fields';
import { cn } from '@/lib/utils';
import { clausesToText, insertToken, textToClauses } from '../settings-lists';
import { SheetFace } from './sheet-preview';
import type { NotifyUndo, SettingsFormApi } from './settings-form-types';
import { EDIT } from './settings-form-types';

const ICON = 'size-icon';
const TOKEN = '{ARRENDANTE}';

/** Crece con el texto: todo el contrato se lee en la página, sin scroll interno. */
const GROWING =
  'text-body leading-relaxed [field-sizing:content] [[data-density=bahia]_&]:text-title';

/**
 * Contrato (120): la introducción y las cláusulas en la misma página, cada
 * una en su párrafo. Una línea en blanco separa una cláusula de la otra; al
 * escribir, el texto se corta en la lista que guarda el formulario.
 */
export function ContractPanel({
  form,
  preview,
  canEdit,
  notifyUndo,
}: {
  form: SettingsFormApi;
  preview: RentalSettings;
  canEdit: boolean;
  notifyUndo: NotifyUndo;
}) {
  const clauses = form.watch('clauses');
  const intro = form.watch('contractIntro');
  const errors = form.formState.errors;
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const introRef = useRef<HTMLTextAreaElement>(null);

  // El texto se escribe tal cual (con sus líneas en blanco a medio escribir);
  // solo se rehace cuando las cláusulas cambian desde afuera: Descartar,
  // Deshacer o volver al texto original.
  const [draft, setDraft] = useState(() => clausesToText(clauses));
  const joined = clausesToText(clauses);
  useEffect(() => {
    setDraft((current) => (clausesToText(textToClauses(current)) === joined ? current : joined));
  }, [joined]);

  function writeClauses(value: string): void {
    setDraft(value);
    form.setValue('clauses', textToClauses(value), EDIT);
  }

  function insertLessor(): void {
    const node = introRef.current;
    const start = node?.selectionStart ?? intro.length;
    const end = node?.selectionEnd ?? start;
    const next = insertToken(intro, TOKEN, start, end);
    form.setValue('contractIntro', next.text, EDIT);
    requestAnimationFrame(() => {
      introRef.current?.focus();
      introRef.current?.setSelectionRange(next.caret, next.caret);
    });
  }

  function restoreOriginal(): void {
    const before = { intro, clauses };
    form.setValue('contractIntro', RENTAL_SETTINGS_DEFAULTS.contractIntro, EDIT);
    form.setValue('clauses', [...RENTAL_SETTINGS_DEFAULTS.clauses], EDIT);
    notifyUndo('Texto original restaurado', () => {
      form.setValue('contractIntro', before.intro, EDIT);
      form.setValue('clauses', before.clauses, EDIT);
    });
  }

  const clauseErrors = Array.isArray(errors.clauses)
    ? errors.clauses.find((item) => item?.message)?.message
    : undefined;
  const listError = errors.clauses?.message ?? errors.clauses?.root?.message ?? clauseErrors;
  const isOriginal =
    intro === RENTAL_SETTINGS_DEFAULTS.contractIntro &&
    joined === clausesToText(RENTAL_SETTINGS_DEFAULTS.clauses);

  return (
    <section className="border-line-soft bg-surface flex min-w-0 flex-col gap-5 rounded-card border p-4 [[data-density=bahia]_&]:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-title mr-auto font-bold">
          {mode === 'preview' ? 'Reverso del contrato' : 'Texto del contrato'}
        </h3>
        {canEdit && mode === 'edit' && !isOriginal ? (
          <Button type="button" variant="ghost" size="sm" onClick={restoreOriginal}>
            <RotateCcw className={ICON} strokeWidth={1.5} aria-hidden />
            Volver al texto original
          </Button>
        ) : null}
        <div
          role="group"
          aria-label="Modo"
          className="bg-surface-3 inline-flex rounded-control p-0.5"
        >
          {(
            [
              ['edit', 'Editar'],
              ['preview', 'Ver impreso'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'text-dense min-h-(--touch-min) rounded-control px-3 font-semibold transition-colors duration-(--duration-state) ease-standard',
                mode === value ? 'bg-surface text-text' : 'text-text-dim hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'preview' ? (
        <SheetFace side="back" settings={preview} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="rs-contract-intro" className="font-semibold">
              Introducción
            </label>
            <Textarea
              id="rs-contract-intro"
              ref={introRef}
              aria-invalid={errors.contractIntro ? true : undefined}
              value={intro}
              onChange={(event) => form.setValue('contractIntro', event.target.value, EDIT)}
              className={cn('min-h-24', GROWING)}
            />
            <div className="text-text-faint text-dense flex flex-wrap items-center gap-2">
              {canEdit ? (
                <button
                  type="button"
                  onClick={insertLessor}
                  className="border-line text-flame-text hover:border-solid inline-flex min-h-(--touch-min) items-center rounded-full border border-dashed px-3 font-mono font-bold"
                >
                  + {TOKEN}
                </button>
              ) : null}
              <span>Se cambia por el arrendante al imprimir.</span>
            </div>
            <FieldError message={errors.contractIntro?.message} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <label htmlFor="rs-contract-clauses" className="font-semibold">
                Cláusulas
              </label>
              <span className="text-text-faint text-dense font-mono tabular-nums">
                {clauses.length}
              </span>
            </div>
            <p className="text-text-faint text-dense">
              Separe cada cláusula con una línea en blanco. Se numeran solas.
            </p>
            <Textarea
              id="rs-contract-clauses"
              aria-invalid={listError ? true : undefined}
              value={draft}
              onChange={(event) => writeClauses(event.target.value)}
              className={cn('min-h-96', GROWING)}
            />
            <FieldError message={listError} />
          </div>
        </>
      )}
    </section>
  );
}
