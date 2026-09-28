'use client';

import { CircleHelp } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/**
 * El globo flotante del sistema (spec 067): una explicación corta pegada a un
 * elemento. Vive en un portal con posición fija, así que ninguna tarjeta ni
 * tabla con `overflow` lo recorta. Va arriba del ancla, centrado; si no cabe,
 * abajo; y nunca se sale de la pantalla por los costados.
 *
 * No recibe foco ni clics (`pointer-events: none`): es lectura, no un menú.
 */
export function FloatingTip({
  anchor,
  open,
  id,
  children,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  id?: string;
  children: ReactNode;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const tip = tipRef.current;
    if (anchor === null || tip === null) return;

    const edge = 8;
    const gap = 8;
    const rect = anchor.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, edge),
      window.innerWidth - width - edge,
    );
    const above = rect.top - height - gap;
    const top = above >= edge ? above : rect.bottom + gap;

    setPosition({ left: Math.max(left, edge), top });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
  }, [open, place, children]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, { capture: true });
    };
  }, [open, place]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={tipRef}
      id={id}
      role="tooltip"
      style={
        position === null
          ? { left: 0, top: 0, visibility: 'hidden' }
          : { left: position.left, top: position.top }
      }
      className="bg-surface-3 border-line text-text pointer-events-none fixed z-[80] max-w-65 rounded-sm border px-2.5 py-2 text-dense"
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * El icono de ayuda (spec 067): qué significa una cifra o una columna.
 *
 * Se abre de tres maneras y ninguna depende de la otra, porque en la bahía no
 * hay puntero: al pasar el mouse, al llegar con el teclado (foco visible) y al
 * tocarlo, que lo deja fijo hasta otro toque, un toque afuera o Escape. El
 * icono mide `--icon-size`, pero el área que se toca mide `--touch-min`.
 */
export function HelpTip({ text, className }: { text: string; className?: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  useEffect(() => setAnchor(buttonRef.current), []);

  useEffect(() => {
    if (!open) return;

    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setFocused(false);
      setHovered(false);
    };
    const outside = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      setPinned(false);
    };

    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-slot="help-tip"
        aria-label={`Qué es: ${text}`}
        aria-describedby={open ? tipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={(event) => {
          // La fila o la tarjeta de abajo puede ser clickeable: esto no la abre.
          event.stopPropagation();
          setPinned((current) => !current);
        }}
        className={cn(
          'text-text-faint hover:text-text focus-visible:text-text relative inline-grid size-icon shrink-0 cursor-help place-items-center rounded-full align-middle transition-colors duration-(--duration-state) ease-standard',
          "before:absolute before:inset-[calc((var(--icon-size)_-_var(--touch-min))/2)] before:content-['']",
          className,
        )}
      >
        <CircleHelp className="size-full" strokeWidth={1.5} aria-hidden />
      </button>
      <FloatingTip anchor={anchor} open={open} id={tipId}>
        {text}
      </FloatingTip>
    </>
  );
}
