'use client';

import { INSPECTION_ZONE_LABELS } from '@elite/shared';
import type { InspectionZone } from '@elite/shared';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CarScene, CarView, ZoneState } from '../car-3d-scene';

/** Las vistas fijas; se repiten acá para no traer la escena al bundle principal. */
const VIEW_BUTTONS: readonly { key: CarView; label: string }[] = [
  { key: 'front', label: 'Frontal' },
  { key: 'left', label: 'Izquierda' },
  { key: 'right', label: 'Derecha' },
  { key: 'rear', label: 'Trasera' },
  { key: 'top', label: 'Superior' },
];

/** Cuánto espera la cámara antes de girar hacia la línea apuntada. */
const FOCUS_DELAY_MS = 120;

/**
 * spec 126, ADR-016 — El visor 3D de golpes. La escena (`car-3d-scene.ts`,
 * con three) baja con `import()` al montar el paso Golpes y se libera al salir.
 * Sin WebGL, o si el `import()` falla, se muestra `fallback` (el `CarDiagram`
 * 2D) con el mismo comportamiento. Se repinta solo al cambiar el tema.
 */
export function Car3dViewer({
  states,
  listZone,
  onToggle,
  onHover,
  fallback,
}: {
  states: Partial<Record<InspectionZone, ZoneState>>;
  /** La zona de la línea que se está apuntando en la lista. */
  listZone: InspectionZone | null;
  onToggle: (zone: InspectionZone) => void;
  onHover: (zone: InspectionZone | null) => void;
  fallback: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CarScene | null>(null);
  const handlers = useRef({ onToggle, onHover });
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [view, setView] = useState<CarView | null>(null);

  useEffect(() => {
    handlers.current = { onToggle, onHover };
  }, [onToggle, onHover]);

  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    let alive = true;

    import('../car-3d-scene')
      .then(({ createCarScene }) =>
        createCarScene(element, {
          labelOf: (zone) => INSPECTION_ZONE_LABELS[zone],
          onToggle: (zone) => handlers.current.onToggle(zone),
          onHover: (zone) => handlers.current.onHover(zone),
          onFreeView: () => setView(null),
        }),
      )
      .then((created) => {
        if (!alive) {
          created?.dispose();
          return;
        }
        if (created === null) {
          setStatus('failed');
          return;
        }
        scene.current = created;
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('failed');
      });

    // El tema vive en la clase del `<html>` (next-themes): al cambiar, se releen los tokens.
    const themeWatch = new MutationObserver(() => scene.current?.repaint());
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      alive = false;
      themeWatch.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    if (status === 'ready') scene.current?.sync(states);
  }, [states, status]);

  useEffect(() => {
    if (status !== 'ready') return;
    scene.current?.highlight(listZone);
    if (listZone === null) return;
    const timer = window.setTimeout(() => {
      scene.current?.focusZone(listZone);
      setView(null);
    }, FOCUS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [listZone, status]);

  if (status === 'failed') return <>{fallback}</>;

  return (
    <div
      className={cn(
        'border-line-soft relative h-(--car-view-h) max-h-[70vw] w-full overflow-hidden rounded-row border',
        'bg-[radial-gradient(120%_90%_at_50%_35%,var(--surface-3),var(--surface-2)_70%)]',
      )}
    >
      <div ref={host} className="absolute inset-0" />
      <p className="text-dense text-text-dim bg-surface/80 pointer-events-none absolute top-2 left-2 rounded-full px-3 py-1 backdrop-blur-sm [[data-density=bahia]_&]:text-body">
        <b className="text-text font-semibold">Golpes</b> · toque la pieza dañada
      </p>
      {status === 'loading' ? (
        <span className="text-dense text-text-faint absolute inset-0 grid place-items-center">
          Cargando…
        </span>
      ) : (
        <div
          role="group"
          aria-label="Vista"
          className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center-safe gap-1 overflow-x-auto [scrollbar-width:none] [[data-density=bahia]_&]:bottom-2.5 [[data-density=bahia]_&]:gap-1.5"
        >
          {VIEW_BUTTONS.map((candidate) => (
            <Button
              key={candidate.key}
              type="button"
              variant="outline"
              size="xs"
              aria-pressed={view === candidate.key}
              className={cn(
                'bg-surface/80 pointer-events-auto flex-none rounded-full backdrop-blur-sm',
                '[[data-density=bahia]_&]:h-(--touch-min) [[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:text-body',
                view === candidate.key ? 'border-flame text-text' : 'text-text-dim',
              )}
              onClick={() => {
                scene.current?.view(candidate.key);
                setView(candidate.key);
              }}
            >
              {candidate.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
