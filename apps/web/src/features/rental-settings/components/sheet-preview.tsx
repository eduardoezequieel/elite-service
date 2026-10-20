'use client';

import type { RentalSettings } from '@elite/shared';
import { ChevronRight, Printer } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContractBack, ContractFront } from '@/features/rental-documents/components/contract-sheet';
import { PRINT_CSS } from '@/features/rental-documents/components/print-screen';
import { cn } from '@/lib/utils';
import { blankAgreement, SHEET_ZONES, type SheetZone } from '../sheet-preview';

/**
 * La hoja del contrato dentro de Ajustes (120): `ContractFront` y
 * `ContractBack` de la 097 con un contrato en blanco, escalados al ancho de su
 * caja. La zona del campo que se edita se marca en la llama; impresa, la hoja
 * sale sin marcas, igual que desde una renta.
 */

/** Marca la zona caliente y la cláusula elegida. Solo en pantalla. */
const MARK_CSS = `
${SHEET_ZONES.map((zone) => `[data-hot-zone='${zone}'] [data-zone='${zone}']`).join(',\n')},
[data-slot='rental-print'] [data-clause].is-hot {
  outline: 3px solid var(--flame-hot);
  outline-offset: 2px;
  background-color: color-mix(in srgb, var(--flame-hot) 14%, transparent);
}
@media print { [data-hot-zone] [data-zone], [data-clause] { outline: none !important; background: none !important; } }
`;

/** Las medidas del papel (097) y las marcas, una vez por pantalla. */
export function SheetStyles() {
  return <style>{`${PRINT_CSS}\n${MARK_CSS}`}</style>;
}

export type SheetSide = 'front' | 'back';

/** Una cara carta escalada al ancho que tenga su caja. */
function ScaledPage({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0, height: 0 });

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = page.current;
    if (outer === null || inner === null) return;

    const measure = () => {
      const width = inner.offsetWidth;
      const scale = width === 0 ? 0 : outer.clientWidth / width;
      setFit({ scale, height: inner.offsetHeight * scale });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="relative w-full overflow-hidden" style={{ height: fit.height }}>
      <div
        ref={page}
        className="absolute top-0 left-0 w-(--paper-w) origin-top-left"
        style={{ transform: `scale(${fit.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** El papel claro con las medidas de la 097, como en la vista de impresión. */
function Paper({
  children,
  zone = null,
  interactive = false,
}: {
  children: ReactNode;
  zone?: SheetZone | null;
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="rental-print"
      data-theme="light"
      data-hot-zone={zone ?? undefined}
      className={cn(
        'bg-bg text-text select-none',
        interactive ? '[&_[data-clause]]:cursor-pointer' : 'pointer-events-none',
      )}
    >
      {children}
    </div>
  );
}

export function SheetFace({
  side,
  settings,
  zone = null,
  clause = null,
  onClauseClick,
}: {
  side: SheetSide;
  settings: RentalSettings;
  zone?: SheetZone | null;
  /** La cláusula marcada en el reverso. */
  clause?: number | 'intro' | null;
  /** Con esto, un toque en un párrafo del reverso lo elige. */
  onClauseClick?: (clause: number | 'intro') => void;
}) {
  const agreement = useMemo(() => blankAgreement(settings), [settings]);
  const ref = useRef<HTMLDivElement>(null);

  // La cláusula elegida lleva la marca; se pone a mano porque el papel es de la 097.
  useLayoutEffect(() => {
    const root = ref.current;
    if (root === null) return;
    root.querySelectorAll('[data-clause]').forEach((node) => {
      node.classList.toggle(
        'is-hot',
        clause !== null && node.getAttribute('data-clause') === String(clause),
      );
    });
  });

  return (
    <div
      ref={ref}
      onClick={(event) => {
        if (onClauseClick === undefined || !(event.target instanceof Element)) return;
        const value = event.target.closest('[data-clause]')?.getAttribute('data-clause');
        if (value === undefined || value === null) return;
        onClauseClick(value === 'intro' ? 'intro' : Number(value));
      }}
    >
      <Paper zone={zone} interactive={onClauseClick !== undefined}>
        <ScaledPage>
          {side === 'front' ? (
            <ContractFront
              agreement={agreement}
              settings={settings}
              renter={null}
              copy="original"
            />
          ) : (
            <ContractBack agreement={agreement} settings={settings} copy="original" />
          )}
        </ScaledPage>
      </Paper>
    </div>
  );
}

/** La miniatura del anverso: un toque la abre en grande. */
export function MiniSheet({
  settings,
  zone,
  onOpen,
}: {
  settings: RentalSettings;
  zone: SheetZone | null;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="border-line relative overflow-hidden rounded-control border">
        <div aria-hidden>
          <SheetFace side="front" settings={settings} zone={zone} />
        </div>
        <button type="button" onClick={onOpen} className="absolute inset-0 cursor-zoom-in">
          <span className="sr-only">Ver la hoja en grande</span>
        </button>
      </div>
      <Button type="button" variant="ghost" size="sm" className="self-end" onClick={onOpen}>
        Ver en grande
      </Button>
    </div>
  );
}

/**
 * Al lado del formulario en escritorio; abajo y plegable en tablet y bahía.
 * Arranca abierta solo cuando hay lugar al lado.
 */
export function PreviewAside({
  caption,
  defaultOpen,
  children,
}: {
  caption: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? defaultOpen;

  return (
    <aside className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-4 [[data-density=bahia]_&]:static">
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen(!shown)}
        className="text-text-faint hover:text-text-dim text-dense inline-flex min-h-(--touch-min) items-center gap-1.5 self-start font-semibold"
      >
        <ChevronRight
          className={cn(
            'size-icon transition-transform duration-(--duration-state) ease-standard',
            shown && 'rotate-90',
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        {caption}
      </button>
      {shown ? children : null}
    </aside>
  );
}

/** «Ver hoja»: frente o reverso en grande, e Imprimir las dos caras. */
export function SheetDialog({
  open,
  onOpenChange,
  side,
  onSideChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: SheetSide;
  onSideChange: (side: SheetSide) => void;
  settings: RentalSettings;
}) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="md:max-w-4xl">
          <DialogHeader className="flex-row flex-wrap items-center gap-2.5">
            <DialogTitle className="mr-auto">Hoja del contrato</DialogTitle>
            <div
              role="group"
              aria-label="Lado"
              className="bg-surface-3 inline-flex rounded-control p-0.5"
            >
              {(
                [
                  ['front', 'Frente'],
                  ['back', 'Reverso'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={side === value}
                  onClick={() => onSideChange(value)}
                  className={cn(
                    'text-dense min-h-(--touch-min) rounded-control px-3 font-semibold transition-colors duration-(--duration-state) ease-standard',
                    side === value ? 'bg-surface text-text' : 'text-text-dim hover:text-text',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button type="button" size="sm" onClick={() => window.print()}>
              <Printer className="size-icon" strokeWidth={1.5} aria-hidden />
              Imprimir
            </Button>
          </DialogHeader>
          <div className="bg-surface-2 min-h-0 flex-1 overflow-y-auto p-4">
            <SheetFace side={side} settings={settings} />
          </div>
        </DialogContent>
      </Dialog>
      {open ? <PrintCopy settings={settings} /> : null}
    </>
  );
}

/**
 * Lo que sale por la impresora: las dos caras a tamaño real, colgadas del
 * `body` y ocultas en pantalla. Mientras está montada, la impresión esconde
 * todo lo demás de la página.
 */
function PrintCopy({ settings }: { settings: RentalSettings }) {
  const agreement = useMemo(() => blankAgreement(settings), [settings]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div data-settings-print="" className="hidden print:block">
      <style>{`@media print { body > :not([data-settings-print]) { display: none !important; } }`}</style>
      <div data-slot="rental-print" data-theme="light" className="bg-bg text-text">
        <ContractFront agreement={agreement} settings={settings} renter={null} copy="original" />
        <ContractBack agreement={agreement} settings={settings} copy="original" />
      </div>
    </div>,
    document.body,
  );
}
