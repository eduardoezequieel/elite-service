'use client';

import type { LastWash } from '@elite/shared';
import { StickyNote } from 'lucide-react';

import { lastWashDateLabel, lastWashNote } from '../last-wash';

const ICON_STROKE_WIDTH = 1.5;

/**
 * La nota del lavado anterior, donde no se pueda pasar por alto (052).
 *
 * Hasta la 052 era un campo más de la ficha «Ya lo conocemos», del tamaño de
 * «Marca y color», y quien iba a lavar el carro no la veía nunca. Ahora es un
 * aviso de ancho completo, arriba de los datos y de los botones, en las tres
 * pantallas donde aparece un carro conocido: alta, detalle de pista y detalle
 * de oficina. Una sola pieza para las tres.
 *
 * El ámbar es el único relleno de bloque del sistema (DESIGN.md → «Aviso de
 * nota»): sale entero de `currentColor` con la utilidad `.tint`, igual que el
 * chip, así que funciona en los dos temas sin escribir un color. El rótulo y el
 * icono se quedan en ámbar —son la señal— y la nota va en `--text`, que es la
 * que hay que leer.
 *
 * Sin lavado anterior o sin nota no se dibuja nada: no se inventa texto.
 */
export function LastWashNote({ lastWash }: { lastWash: LastWash | null }) {
  const note = lastWashNote(lastWash);

  if (lastWash === null || note === '') return null;

  const heading = `Nota del último lavado · ${lastWashDateLabel(lastWash.createdAt)}`;

  return (
    <div
      role="note"
      aria-label={heading}
      className="tint text-warn-text rounded-row flex w-full items-start gap-3 border px-4 py-3.5"
    >
      <StickyNote
        aria-hidden
        strokeWidth={ICON_STROKE_WIDTH}
        className="size-icon mt-0.5 shrink-0"
      />

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-label">{heading}</p>
        {/* En la bahía se lee de pie y a un brazo de distancia: la nota sube un
            escalón de letra, que es lo único que cambia entre densidades. */}
        <p className="text-text text-body [[data-density=bahia]_&]:text-title whitespace-pre-wrap">
          {note}
        </p>
      </div>
    </div>
  );
}
