import type { RentalSettings } from '@elite/shared';
import type { ReactNode } from 'react';

import { rentalFileSrc } from '@/features/rental-settings/api';
import { cn } from '@/lib/utils';
import { COPY_LABELS, formatContractNumber, type DocumentCopy } from '../print-layout';

/**
 * Las piezas del papel (097): la hoja carta, el encabezado de la empresa, el
 * campo sobre la línea y los títulos de sección. Las medidas del papel son
 * tokens propios de la vista de impresión (`--paper-*`, en `PrintStyles`).
 */

/** Una cara tamaño carta. En pantalla, la hoja sobre la mesa; impresa, la página entera. */
export function PaperPage({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <section
      data-slot="paper-page"
      className={cn(
        'bg-surface text-text border-line-soft mx-auto flex w-full max-w-(--paper-w) min-h-(--paper-h) flex-col gap-2 border p-(--paper-pad) text-(length:--paper-text) leading-snug',
        'break-after-page print:max-w-none print:min-h-0 print:border-0 print:p-0',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Logo, empresa y número: la cabecera de las dos hojas. */
export function PaperHeader({
  settings,
  title,
  contractNumber,
  copy,
}: {
  settings: RentalSettings;
  title: string;
  contractNumber: number | null;
  copy: DocumentCopy;
}) {
  const number = formatContractNumber(contractNumber);

  return (
    <header className="border-text flex items-start gap-3 border-b-2 pb-2">
      {settings.logoUrl === null ? null : (
        // `<img>` y no `next/image`: el logo lo sirve el API con sesión.
        <img
          src={rentalFileSrc(settings.logoUrl)}
          alt=""
          className="h-(--paper-logo-h) w-auto max-w-(--paper-logo-w) shrink-0 object-contain"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="text-(length:--paper-title) leading-tight font-bold">
          {settings.companyName}
        </h1>
        {settings.taxId || settings.nrc ? (
          <span>
            {[
              settings.taxId ? `NIT: ${settings.taxId}` : null,
              settings.nrc ? `NRC: ${settings.nrc}` : null,
            ]
              .filter(Boolean)
              .join('   ')}
          </span>
        ) : null}
        {settings.address ? <span>{settings.address}</span> : null}
        {settings.phones || settings.email ? (
          <span>
            {[settings.phones ? `Tel. ${settings.phones}` : null, settings.email]
              .filter(Boolean)
              .join('   ')}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="border-text border px-1.5 py-0.5 font-bold">{COPY_LABELS[copy]}</span>
        <span>{title}</span>
        <span className="font-mono text-(length:--paper-title) font-bold">
          N° {number === '' ? '______' : number}
        </span>
      </div>
    </header>
  );
}

/** Un título de sección del papel. */
export function PaperSection({ children }: { children: ReactNode }) {
  return <h2 className="border-line mt-1 border-b pb-0.5 font-bold first:mt-0">{children}</h2>;
}

/** Etiqueta y valor sobre la línea, como en el talonario. Vacío, la línea queda para escribir. */
export function PaperField({
  label,
  value,
  className,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div
      className={cn('border-line flex min-w-0 flex-1 items-end gap-1.5 border-b py-0.5', className)}
    >
      <span className="text-text-dim shrink-0">{label}</span>
      <span className={cn('min-w-0 font-semibold break-words', mono && 'font-mono')}>
        {value === null || value === undefined || value === '' ? ' ' : value}
      </span>
    </div>
  );
}

/** Campos en fila. */
export function PaperRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}

/** Una línea para firmar con su leyenda debajo. */
export function SignatureLine({ label, name }: { label: string; name?: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 text-center">
      <span className="border-text h-(--paper-sign-h) w-full border-b" aria-hidden />
      {name ? <span className="font-semibold">{name}</span> : null}
      <span className="text-text-dim">{label}</span>
    </div>
  );
}

/** Celda de tabla del papel. */
export function Cell({
  children,
  className,
  head = false,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  head?: boolean;
  colSpan?: number;
}) {
  const Tag = head ? 'th' : 'td';

  return (
    <Tag
      colSpan={colSpan}
      className={cn(
        'border-line border px-1.5 py-0.5 text-left align-top',
        head && 'bg-surface-2 font-semibold',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
