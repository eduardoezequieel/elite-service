'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

/**
 * Envoltorio cliente sobre `next-themes`.
 *
 * Claro = la página impresa del catálogo. Oscuro = la microficha. Ninguno es
 * secundario, así que el valor por defecto es `system`: manda el contexto físico.
 *
 * `next-themes` inyecta su propio script antes de la primera pintura, por eso el
 * tema no parpadea y no hace falta escribir uno a mano. El `<html>` del layout ya
 * lleva `suppressHydrationWarning`, necesario porque ese script escribe la clase
 * del tema antes de que React hidrate.
 *
 * Todas las opciones se pueden sobrescribir desde fuera vía props.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
