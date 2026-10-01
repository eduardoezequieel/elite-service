'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { moveItem } from '../settings-form';

const ICON = 'size-icon';

/**
 * Una lista de textos que se edita en el lugar (095): las cláusulas del
 * contrato y los accesorios del carro. Cada renglón se escribe, se sube, se
 * baja o se quita; al pie, agregar uno. Los botones son de icono con su nombre
 * para el lector y miden `--touch-min`: en la bahía no hay arrastrar.
 */
export function EditableTextList({
  id,
  items,
  onChange,
  itemLabel,
  addLabel,
  multiline = false,
}: {
  id: string;
  items: readonly string[];
  onChange: (items: string[]) => void;
  /** «Cláusula», «Accesorio»: se numera sola. */
  itemLabel: string;
  addLabel: string;
  multiline?: boolean;
}) {
  const set = (index: number, value: string) =>
    onChange(items.map((item, position) => (position === index ? value : item)));

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {items.map((item, index) => {
          const fieldId = `${id}-${index}`;
          const name = `${itemLabel} ${index + 1}`;

          return (
            <li key={index} className="flex items-start gap-2">
              <FieldBox className="min-w-0 flex-1">
                <Label htmlFor={fieldId}>{name}</Label>
                {multiline ? (
                  <Textarea
                    id={fieldId}
                    rows={4}
                    value={item}
                    onChange={(event) => set(index, event.target.value)}
                  />
                ) : (
                  <Input
                    id={fieldId}
                    autoComplete="off"
                    value={item}
                    onChange={(event) => set(index, event.target.value)}
                  />
                )}
              </FieldBox>
              <div className="flex shrink-0 flex-col gap-1 [[data-density=mostrador]_&]:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => onChange(moveItem(items, index, index - 1))}
                >
                  <ArrowUp className={ICON} strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Subir {name}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === items.length - 1}
                  onClick={() => onChange(moveItem(items, index, index + 1))}
                >
                  <ArrowDown className={ICON} strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Bajar {name}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(items.filter((_, position) => position !== index))}
                >
                  <Trash2 className={`${ICON} text-danger-text`} strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Quitar {name}</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        className="w-fit max-sm:w-full"
        onClick={() => onChange([...items, ''])}
      >
        <Plus className={ICON} strokeWidth={1.5} aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}
