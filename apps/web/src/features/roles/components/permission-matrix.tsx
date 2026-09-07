'use client';

import { useMemo, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import type { PermissionGroup } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Reference } from '@/components/ui/reference';
import { cn } from '@/lib/utils';

/**
 * Panel de permisos — Master-Detail (spec 034).
 *
 * Reemplaza la matriz rígida cruzada por una vista dividida:
 * - Master (izquierda): lista de módulos con número de referencia (#1, #2...)
 *   y contador de permisos asignados vs totales.
 * - Detail (derecha): acciones reales de ese módulo con nombre, descripción
 *   y casilla interactiva. Cero celdas vacías con guiones (—).
 *
 * En móvil (<md) el master se convierte en una barra horizontal deslizable
 * para mantener la navegación fluida y sin desbordes.
 */

const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  manage: 'Administrar',
  charge: 'Cobrar',
  cash: 'Caja',
  void: 'Anular',
  reverse: 'Deshacer cobro',
  commissions: 'Comisiones',
};

/** La parte `action` de una clave `module.action`. */
function actionOf(key: string): string {
  const separator = key.lastIndexOf('.');
  return separator === -1 ? key : key.slice(separator + 1);
}

function labelOf(action: string): string {
  return ACTION_LABELS[action] ?? (action.charAt(0).toUpperCase() + action.slice(1));
}

export interface PermissionMatrixProps {
  /** El catálogo agrupado por módulo, tal como llega de `GET /permissions`. */
  groups: PermissionGroup[];
  /** Las claves marcadas. */
  value: string[];
  /** Reemplaza el conjunto completo de claves marcadas. */
  onChange: (keys: string[]) => void;
  /**
   * Sin `roles.manage` se mira, no se opera: en vez de casillas
   * muertas se muestran las palabras «Sí» y «No».
   */
  readOnly?: boolean;
  /** El catálogo todavía no llegó. */
  isLoading?: boolean;
  /** Id para atar el componente a su etiqueta desde el formulario. */
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
  const [selectedModule, setSelectedModule] = useState<string>('');

  const granted = useMemo(() => new Set(value), [value]);

  // Selección activa válida o primer módulo disponible.
  const activeGroup = useMemo(() => {
    if (groups.length === 0) return null;
    return groups.find((g) => g.module === selectedModule) ?? groups[0];
  }, [groups, selectedModule]);

  function toggle(key: string, next: boolean) {
    onChange(next ? [...value, key] : value.filter((current) => current !== key));
  }

  function toggleModule(keys: string[], next: boolean) {
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

  if (groups.length === 0 || !activeGroup) {
    return (
      <p className="text-text-dim text-body">
        El catálogo de permisos está vacío: no hay nada que asignar todavía.
      </p>
    );
  }

  const activeModuleIndex = groups.findIndex((g) => g.module === activeGroup.module);
  const activeGrantedKeys = activeGroup.permissions
    .map((p) => p.key)
    .filter((key) => granted.has(key));
  const isAllActiveMarked =
    activeGroup.permissions.length > 0 &&
    activeGrantedKeys.length === activeGroup.permissions.length;

  return (
    <div id={id} className="border-line-soft bg-surface flex flex-col overflow-hidden rounded-row border">
      {/* Móvil (<md): barra deslizable horizontal de módulos */}
      <div
        role="tablist"
        aria-label="Módulos de permisos"
        className="border-line-soft bg-surface-2 flex gap-1.5 overflow-x-auto p-2 border-b md:hidden scrollbar-none"
      >
        {groups.map((group, index) => {
          const isSelected = activeGroup.module === group.module;
          const groupGrantedCount = group.permissions.filter((p) => granted.has(p.key)).length;
          const totalCount = group.permissions.length;
          const hasAll = totalCount > 0 && groupGrantedCount === totalCount;

          return (
            <button
              key={group.module}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedModule(group.module)}
              className={cn(
                'flex shrink-0 min-h-(--touch-min) items-center gap-1.5 rounded-control px-3 py-1.5 text-dense transition-colors duration-(--duration-state) ease-standard border',
                isSelected
                  ? 'bg-surface border-flame text-text font-semibold'
                  : 'bg-surface-2 border-line-soft text-text-dim hover:bg-surface hover:text-text',
              )}
            >
              <Reference value={index + 1} active={isSelected} />
              <span>{group.label}</span>
              <span
                className={cn(
                  'text-label font-mono tabular-nums',
                  hasAll ? 'text-flame-text' : isSelected ? 'text-text' : 'text-text-faint',
                )}
              >
                {groupGrantedCount}/{totalCount}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col md:flex-row min-h-[360px] md:min-h-[420px]">
        {/* Escritorio y tablet (>=md): columna lateral Master */}
        <aside
          aria-label="Lista de módulos"
          className="w-full md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-line-soft bg-surface-2 hidden md:flex flex-col shrink-0"
        >
          <div className="border-line-soft flex items-center justify-between border-b px-3.5 py-2.5">
            <span className="text-text-faint text-label uppercase tracking-wider font-semibold">
              Módulos ({groups.length})
            </span>
            <span className="text-text-faint text-dense tabular-nums font-mono">
              {value.length} asignados
            </span>
          </div>

          <nav className="flex flex-col overflow-y-auto flex-1">
            {groups.map((group, index) => {
              const isSelected = activeGroup.module === group.module;
              const groupGrantedCount = group.permissions.filter((p) => granted.has(p.key)).length;
              const totalCount = group.permissions.length;
              const hasSome = groupGrantedCount > 0;
              const hasAll = totalCount > 0 && groupGrantedCount === totalCount;

              return (
                <button
                  key={group.module}
                  type="button"
                  onClick={() => setSelectedModule(group.module)}
                  className={cn(
                    'flex min-h-(--touch-min) items-center justify-between gap-2 px-3.5 py-2.5 text-left text-body transition-colors duration-(--duration-state) ease-standard border-b border-line-soft/60 last:border-b-0',
                    isSelected
                      ? 'bg-surface text-text font-semibold border-l-2 border-l-flame'
                      : 'text-text-dim hover:bg-surface/50 hover:text-text',
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Reference value={index + 1} active={isSelected} />
                    <span className="truncate">{group.label}</span>
                  </span>
                  <span
                    className={cn(
                      'text-dense font-mono tabular-nums shrink-0 px-2 py-0.5 rounded-full border text-label',
                      hasAll
                        ? 'bg-flame/15 border-flame/40 text-flame-text font-semibold'
                        : hasSome
                          ? 'bg-surface-3 border-line text-text font-medium'
                          : 'bg-transparent border-line-soft text-text-faint',
                    )}
                  >
                    {groupGrantedCount}/{totalCount}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Panel de Detalle */}
        <main className="flex-1 bg-surface flex flex-col p-4 md:p-5 overflow-y-auto">
          <header className="border-line-soft flex items-center justify-between pb-3.5 mb-3.5 border-b gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Reference value={activeModuleIndex + 1} />
                <h3 className="text-title text-text font-semibold">{activeGroup.label}</h3>
              </div>
              <p className="text-text-dim text-dense mt-0.5">
                {activeGrantedKeys.length} de {activeGroup.permissions.length} permisos concedidos
              </p>
            </div>

            {readOnly ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  toggleModule(
                    activeGroup.permissions.map((p) => p.key),
                    !isAllActiveMarked,
                  )
                }
              >
                {isAllActiveMarked ? 'Quitar todo' : 'Marcar todo'}
                <span className="sr-only"> en {activeGroup.label}</span>
              </Button>
            )}
          </header>

          <ul className="flex flex-col gap-2">
            {activeGroup.permissions.map((permission) => {
              const action = actionOf(permission.key);
              const actionLabel = labelOf(action);
              const isGranted = granted.has(permission.key);

              if (readOnly) {
                return (
                  <li
                    key={permission.key}
                    className="border-line-soft bg-surface-2/40 flex min-h-(--touch-min) items-center justify-between gap-3 rounded-control border p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-text text-body font-medium">{actionLabel}</span>
                      <span className="text-text-dim text-dense">{permission.label}</span>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-dense font-mono tabular-nums shrink-0',
                        isGranted ? 'text-text font-semibold' : 'text-text-faint',
                      )}
                    >
                      {isGranted ? (
                        <CheckIcon className="size-icon text-flame-text" strokeWidth={2} aria-hidden />
                      ) : null}
                      {isGranted ? 'Sí' : 'No'}
                      <span className="sr-only"> — {permission.label}</span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={permission.key}>
                  <label
                    className={cn(
                      'border-line-soft bg-surface-2/50 hover:bg-surface-2 hover:border-line flex min-h-(--touch-min) cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors duration-(--duration-state) ease-standard',
                      isGranted && 'border-flame/40 bg-flame/5',
                    )}
                  >
                    <Checkbox
                      checked={isGranted}
                      onCheckedChange={(next) => toggle(permission.key, next === true)}
                      aria-label={permission.label}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col select-none">
                      <span className="text-text text-body font-medium">{actionLabel}</span>
                      <span className="text-text-dim text-dense">{permission.label}</span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    </div>
  );
}
