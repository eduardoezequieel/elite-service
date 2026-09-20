'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

import { currentOrigin, withBackTo } from '@/components/app-shell/back-link';

/**
 * Un enlace que le dice al destino de dónde salió (spec 056).
 *
 * Las filas de `DataTable` ya lo hacen solas, pero un `<Link>` suelto —el aviso
 * de la campana, la placa dentro de una fila— no pasa por ahí, y sin esto la
 * ficha que abre vuelve al padre de su ruta en vez de a esta pantalla.
 *
 * El `href` se queda tal cual para que ⌘/Ctrl+clic, el botón del medio y
 * «copiar enlace» den la URL limpia: una pestaña nueva no tiene de dónde volver
 * (RN-6). El origen se agrega solo en el clic normal, ya en el navegador, donde
 * se puede leer la query que la pantalla escribió con `history.replaceState`.
 */
export function OriginLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const router = useRouter();

  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        router.push(withBackTo(href, currentOrigin()));
      }}
      {...props}
    />
  );
}
