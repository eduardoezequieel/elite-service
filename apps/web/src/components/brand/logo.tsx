import Image from 'next/image';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import logoSrc from './logo-elite-service.png';

/**
 * La marca de Elite Service: el medidor cromado con la aguja y el wordmark
 * «ELITE / SERVICE». Es el archivo original del taller (068), recortado a su
 * contorno y con fondo transparente, así que va igual sobre el riel azul marino
 * y sobre el claro.
 *
 * Todas las pantallas —login, pista, riel y la referencia de diseño— cuelgan de
 * este componente: si la marca cambia, cambia acá y en ningún otro sitio.
 *
 * Es una imagen, así que no se anima: el medidor de carga (`gauge-loader.tsx`)
 * conserva su dibujo vectorial del isotipo porque la aguja tiene que moverse.
 */
export interface LogoProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** Alto en píxeles; el ancho sale de la proporción del archivo. */
  height?: number;
  /** Para el logo que se ve al entrar (login): se carga antes que el resto. */
  priority?: boolean;
}

export function Logo({ height = 64, priority = false, className, ...props }: LogoProps) {
  const width = Math.round((height * logoSrc.width) / logoSrc.height);

  return (
    <span data-slot="logo" className={cn('inline-flex shrink-0', className)} {...props}>
      <Image
        src={logoSrc}
        alt="Elite Service"
        width={width}
        height={height}
        priority={priority}
        className="h-auto max-w-full select-none"
        draggable={false}
      />
    </span>
  );
}
