'use client';

import { useMemo } from 'react';
import { CheckIcon } from 'lucide-react';
import type { PermissionDescriptor, PermissionGroup } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Reference } from '@/components/ui/reference';
import { cn } from '@/lib/utils';

/**
 * La matriz de permisos — pantalla firma del sistema.
 *
 * No es una lista de casillas sueltas: es una **tabla de referencias cruzadas
 * modulo × accion**. Los modulos son las filas —cada una con su numero de
 * referencia—, las acciones son las columnas, y la casilla vive en el cruce
 * (spec 001 → UI → `/settings/roles`).
 *
 * Las columnas se derivan del catalogo, nunca se escriben a mano: el dia que
 * una spec agregue una accion nueva, la matriz la muestra sin tocar este
 * archivo.
 *
 * Bajo `md` la matriz no se arrastra en horizontal: colapsa a un bloque por
 * modulo con sus acciones apiladas, que es la forma que se usa con el dedo
 * (DESIGN.md → «La tabla colapsa, no se arrastra»).
 */

/**
 * Nombre corto de cada accion para la cabecera de columna. Es solo la
 * traduccion: si aparece una accion que no esta aca se muestra su propia clave,
 * nunca se pierde una columna.
 */
const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  manage: 'Administrar',
  charge: 'Cobrar',
  cash: 'Caja',
  void: 'Anular',
  commissions: 'Comisiones',
};

/** La parte `action` de una clave `module.action`. */
function actionOf(key: string): string {
  const separator = key.lastIndexOf('.');
  return separator === -1 ? key : key.slice(separator + 1);
}

function labelOf(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

interface MatrixRow {
  group: PermissionGroup;
  /** El permiso de cada columna, o `null` si este modulo no tiene esa accion. */
  cells: (PermissionDescriptor | null)[];
  /** Todas las claves del modulo, para el atajo de fila. */
  keys: string[];
}

/** Deriva columnas y filas del catalogo, en el orden en que llega. */
function buildMatrix(groups: PermissionGroup[]): { columns: string[]; rows: MatrixRow[] } {
  const columns: string[] = [];

  for (const group of groups) {
    for (const permission of group.permissions) {
      const action = actionOf(permission.key);
      if (!columns.includes(action)) columns.push(action);
    }
  }

  const rows = groups.map((group) => {
    const byAction = new Map(
      group.permissions.map((permission) => [actionOf(permission.key), permission]),
    );

    return {
      group,
      cells: columns.map((action) => byAction.get(action) ?? null),
      keys: group.permissions.map((permission) => permission.key),
    };
  });

  return { columns, rows };
}

interface PermissionMatrixProps {
  /** El catalogo agrupado por modulo, tal como llega de `GET /permissions`. */
  groups: PermissionGroup[];
  /** Las claves marcadas. */
  value: string[];
  /** Reemplaza el conjunto completo de claves marcadas. */
  onChange: (keys: string[]) => void;
  /**
   * Sin `roles.manage` la matriz se lee, no se opera: en vez de casillas
   * muertas se muestran las palabras «Sí» y «No» (DESIGN.md → Inputs → solo
   * lectura por permiso).
   */
  readOnly?: boolean;
  /** El catalogo todavia no llego. */
  isLoading?: boolean;
  /** Id para atar la matriz a su etiqueta desde el formulario. */
  id?: string;
}

export function PermissionMatrix({
  groups,
  value,
  onChange,
  readOnly = false,
  isLoading = false,
  id,
}: PermissionMatrixProps) {
  const { columns, rows } = useMemo(() => buildMatrix(groups), [groups]);
  const granted = useMemo(() => new Set(value), [value]);

  function toggle(key: string, next: boolean) {
    onChange(next ? [...value, key] : value.filter((current) => current !== key));
  }

  function toggleRow(keys: string[], next: boolean) {
    const rest = value.filter((current) => !keys.includes(current));
    onChange(next ? [...rest, ...keys] : rest);
  }

  if (isLoading) {
    return (
      <p className="text-text-dim text-body" role="status">
        Cargando el catálogo de permisos…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-text-dim text-body">
        El catálogo de permisos está vacío: no hay nada que asignar todavía.
      </p>
    );
  }

  return (
    <div id={id} className="flex flex-col gap-2">
      {/* Escritorio: la tabla de referencias cruzadas módulo × acción. */}
      <div className="border-line-soft bg-surface hidden overflow-hidden rounded-row border md:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Permisos del rol, cruzando cada módulo con cada acción.
          </caption>
          <thead className="bg-surface-2">
            <tr className="border-line border-b">
              <th scope="col" className="text-text-faint h-row px-3 text-left text-label">
                Módulo
              </th>
              {columns.map((action) => (
                <th
                  key={action}
                  scope="col"
                  className="text-text-faint h-row px-3 text-center text-label"
                >
                  {labelOf(action)}
                </th>
              ))}
              {readOnly ? null : (
                <th scope="col" className="text-text-faint h-row px-3 text-right text-label">
                  Fila completa
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const marked = row.keys.filter((key) => granted.has(key));
              const allMarked = row.keys.length > 0 && marked.length === row.keys.length;

              return (
                <tr
                  key={row.group.module}
                  className="border-line-soft hover:bg-surface-2 border-b transition-colors duration-(--duration-state) ease-standard last:border-b-0"
                >
                  <th
                    scope="row"
                    className="h-row px-3 text-left align-middle text-dense font-normal"
                  >
                    <span className="flex items-center gap-2">
                      <Reference value={index + 1} />
                      <span className="text-text">{row.group.label}</span>
                    </span>
                  </th>

                  {row.cells.map((permission, cellIndex) => (
                    <td key={columns[cellIndex]} className="h-row px-3 align-middle">
                      <span className="flex items-center justify-center">
                        {permission ? (
                          <PermissionCell
                            permission={permission}
                            granted={granted.has(permission.key)}
                            readOnly={readOnly}
                            onToggle={(next) => toggle(permission.key, next)}
                          />
                        ) : (
                          <EmptyCell
                            moduleLabel={row.group.label}
                            actionLabel={labelOf(columns[cellIndex])}
                          />
                        )}
                      </span>
                    </td>
                  ))}

                  {readOnly ? null : (
                    <td className="h-row px-3 text-right align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRow(row.keys, !allMarked)}
                      >
                        {allMarked ? 'Quitar todo' : 'Marcar todo'}
                        <span className="sr-only"> en {row.group.label}</span>
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Táctil: un bloque por módulo con sus acciones apiladas. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row, index) => {
          const marked = row.keys.filter((key) => granted.has(key));
          const allMarked = row.keys.length > 0 && marked.length === row.keys.length;

          return (
            <section
              key={row.group.module}
              className="border-line-soft bg-surface overflow-hidden rounded-row border"
            >
              <header className="border-line bg-surface-2 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <span className="flex items-center gap-2">
                  <Reference value={index + 1} />
                  <span className="text-text text-body font-semibold">{row.group.label}</span>
                </span>
                {readOnly ? (
                  <span className="text-text-faint text-label font-normal tabular-nums">
                    {marked.length} de {row.keys.length}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRow(row.keys, !allMarked)}
                  >
                    {allMarked ? 'Quitar todo' : 'Marcar todo'}
                    <span className="sr-only"> en {row.group.label}</span>
                  </Button>
                )}
              </header>

              <ul>
                {row.cells.map((permission, cellIndex) => (
                  <li
                    key={columns[cellIndex]}
                    className={cn(
                      'border-line-soft flex min-h-(--touch-min) items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0',
                      permission ? null : 'bg-surface-2/60',
                    )}
                  >
                    <span className="flex flex-col">
                      <span className={cn('text-body', permission ? null : 'text-text-faint')}>
                        {labelOf(columns[cellIndex])}
                      </span>
                      <span className="text-text-faint text-label font-normal">
                        {permission ? permission.label : 'Este módulo no tiene esta acción.'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center justify-center">
                      {permission ? (
                        <PermissionCell
                          permission={permission}
                          granted={granted.has(permission.key)}
                          readOnly={readOnly}
                          onToggle={(next) => toggle(permission.key, next)}
                        />
                      ) : (
                        <EmptyCell
                          moduleLabel={row.group.label}
                          actionLabel={labelOf(columns[cellIndex])}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-text-faint text-label font-normal">
        El guion (—) marca una acción que ese módulo no tiene: no es una casilla sin marcar.
      </p>
    </div>
  );
}

/** La casilla del cruce, o su lectura en texto plano cuando no se puede editar. */
function PermissionCell({
  permission,
  granted,
  readOnly,
  onToggle,
}: {
  permission: PermissionDescriptor;
  granted: boolean;
  readOnly: boolean;
  onToggle: (next: boolean) => void;
}) {
  if (readOnly) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-dense',
          granted ? 'text-text font-semibold' : 'text-text-faint',
        )}
      >
        {granted ? <CheckIcon className="size-icon" strokeWidth={1.5} aria-hidden /> : null}
        {granted ? 'Sí' : 'No'}
        <span className="sr-only"> — {permission.label}</span>
      </span>
    );
  }

  return (
    <Checkbox
      checked={granted}
      onCheckedChange={(next) => onToggle(next === true)}
      aria-label={permission.label}
    />
  );
}

/** El cruce que no existe: se ve que no está, no que está desmarcado. */
function EmptyCell({ moduleLabel, actionLabel }: { moduleLabel: string; actionLabel: string }) {
  return (
    <span className="text-text-faint text-dense">
      <span aria-hidden>—</span>
      <span className="sr-only">
        {moduleLabel} no tiene la acción {actionLabel}.
      </span>
    </span>
  );
}
