'use client';

import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const NOTE_MAX = 500;

/**
 * La nota de **este** lavado: la escribe quien lava o quien cobra (041).
 * No es la del último lavado; esa se lee en la ficha «Ya lo conocemos».
 */
export function TicketNoteField({
  id,
  value,
  original,
  saving,
  error,
  help,
  conflict = null,
  onChange,
  onSave,
  onAcceptConflict,
}: {
  id: string;
  value: string;
  original: string | null;
  saving: boolean;
  error?: string | null;
  help?: string;
  /**
   * La nota que el otro lado guardó mientras acá se escribía (041). No se pisa
   * lo tecleado: se muestra y se elige.
   */
  conflict?: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onAcceptConflict?: () => void;
}) {
  const dirty = value.trim() !== (original ?? '').trim();

  return (
    <div className="flex flex-col gap-3">
      <FieldBox>
        <Label htmlFor={id}>Nota</Label>
        <Textarea
          id={id}
          rows={3}
          maxLength={NOTE_MAX}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
      </FieldBox>
      <p className="text-text-faint text-dense tabular-nums">
        {value.length}/{NOTE_MAX}
      </p>
      {help !== undefined ? <p className="text-text-faint text-dense">{help}</p> : null}
      {conflict !== null ? (
        <div className="border-line bg-surface-2 flex flex-col gap-2 rounded-row border p-3">
          <p className="text-text text-dense">
            Mientras escribías, del otro lado guardaron:{' '}
            <span className="font-semibold">
              {conflict.trim() === '' ? 'sin nota' : `«${conflict}»`}
            </span>
          </p>
          <p className="text-text-faint text-dense">
            Lo tuyo no se perdió. Guardá para que quede lo que escribiste, o usá la de ellos.
          </p>
          {onAcceptConflict ? (
            <Button type="button" variant="outline" size="sm" onClick={onAcceptConflict}>
              Usar la de ellos
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-danger-text text-dense" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="outline" disabled={!dirty} loading={saving} onClick={onSave}>
        Guardar nota
      </Button>
    </div>
  );
}
