import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El color de texto de cada tono. `.tint` deriva de él el relleno y el filete, así
 * que quien necesite pintar algo «del tono de un estado» —la marca de 063— lo toma
 * de acá y no elige colores por su cuenta.
 */
const STAMP_TONE_TEXT = {
  /* --- Los cinco tonos históricos --- */
  /** Recibido, en espera, neutro. */
  neutral: 'text-text-dim',
  /** En proceso, requiere atención. */
  amber: 'text-warn-text',
  /** Listo, aprobado, pagado. */
  green: 'text-go-text',
  /** Vencido, rechazado, detenido. */
  red: 'text-danger-text',
  /** Informativo, programado. */
  blue: 'text-text-dim',

  /* --- El ciclo de un lavado --- */
  /** En espera: todavía nadie lo tocó. */
  queue: 'text-text-dim',
  /** Lavando: el único chip que late. */
  washing: 'text-flame-text',
  /** Listo para cobrar. */
  ready: 'text-go-text',
  /**
   * Cobrado: azul informativo (064). Compartía el verde de «Listo» y solo el
   * icono los separaba; ahora «listo para cobrar» y «ya cobrado» se distinguen
   * de lejos.
   */
  paid: 'text-info-text',
  /** Anulado. */
  void: 'text-danger-text',
} as const;

/**
 * El chip de estado — componente firma del sistema.
 *
 * Punto de color + palabra, en píldora con relleno suave: el propio tono al 12%
 * como fondo, al 40% en el filete y pleno como texto. La utilidad `.tint` de
 * `globals.css` deriva las tres cosas de `currentColor`, así que cada tono se
 * resuelve con una sola clase y funciona igual en claro y en oscuro.
 *
 * DESIGN.md → «El estado nunca se comunica solo con color»: el chip **siempre**
 * lleva la palabra escrita. Por eso `label` es obligatorio y el componente no
 * acepta hijos: es imposible renderizar un chip mudo.
 *
 * Los cinco tonos históricos (`neutral`, `amber`, `green`, `red`, `blue`) siguen
 * existiendo y ahora apuntan a la paleta nueva; los cinco del ciclo de un lavado
 * (`queue`, `washing`, `ready`, `paid`, `void`) se agregaron al lado.
 *
 * El punto es el relleno por defecto. Donde el chip nombra un estado del ciclo
 * lleva icono en su lugar (053), y `TicketStatusStamp` es quien lo elige: un
 * tono no implica un icono, porque `washing` también rotula «Carro nuevo» y un
 * descuento.
 */
const stampVariants = cva(
  [
    'tint inline-flex w-fit shrink-0 items-center justify-center gap-1.75 whitespace-nowrap',
    'rounded-full border font-semibold',
  ],
  {
    variants: {
      tone: STAMP_TONE_TEXT,
      /** `lg` es el del título de una ficha (064): un escalón más, no otro componente. */
      size: {
        md: 'px-2.75 py-1.25 text-dense [&_[data-slot=stamp-icon]_svg]:size-3.5',
        lg: 'gap-2 px-3.5 py-1.5 text-body [&_[data-slot=stamp-icon]_svg]:size-4',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  },
);

type StampTone = NonNullable<VariantProps<typeof stampVariants>['tone']>;
type StampSize = NonNullable<VariantProps<typeof stampVariants>['size']>;

/** El único tono que late por su cuenta: algo está pasando ahora mismo. */
const PULSING_TONES: readonly StampTone[] = ['washing'];

interface StampProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** La palabra del estado, en español y en caja normal: «Listo». */
  label: string;
  /** El tono del chip. Nunca comunica el estado por sí solo. */
  tone?: StampTone;
  /** Icono opcional de `lucide-react`, en lugar del punto. */
  icon?: React.ReactNode;
  /**
   * Fuerza el latido del punto, o lo apaga. Por defecto late solo el tono
   * `washing`. `prefers-reduced-motion` lo apaga siempre.
   */
  pulse?: boolean;
  size?: StampSize;
}

function Stamp({
  label,
  tone = 'neutral',
  icon,
  pulse,
  size = 'md',
  className,
  ...props
}: StampProps) {
  const beats = pulse ?? PULSING_TONES.includes(tone);

  return (
    <span
      data-slot="stamp"
      data-tone={tone}
      className={cn(stampVariants({ tone, size }), className)}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden
          data-slot="stamp-icon"
          className={cn(
            'flex shrink-0 items-center',
            beats && 'animate-[elite-pulse_1.6s_ease-in-out_infinite]',
          )}
        >
          {icon}
        </span>
      ) : (
        <span
          aria-hidden
          data-slot="stamp-dot"
          className={cn(
            'size-1.5 shrink-0 rounded-full bg-current',
            beats && 'animate-[elite-pulse_1.6s_ease-in-out_infinite]',
          )}
        />
      )}
      {label}
    </span>
  );
}

export { Stamp, STAMP_TONE_TEXT, stampVariants };
export type { StampProps, StampSize, StampTone };
