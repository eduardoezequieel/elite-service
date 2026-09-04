'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

/**
 * Envoltorio cliente sobre `next-themes`.
 *
 * El sistema es **oscuro por defecto**: azul marino de taller. El tema claro
 * existe y está igual de cuidado, y «Automático» sigue disponible, pero quien
 * entra sin haber elegido nada entra en oscuro.
 *
 * `next-themes` inyecta su propio script antes de la primera pintura, por eso el
 * tema no parpadea y no hace falta escribir uno a mano. Con `attribute="class"`
 * el `<html>` acaba con `.dark` o `.light`; `globals.css` define oscuro como
 * «cualquier cosa que no sea `.light`», así que el HTML del servidor —que
 * todavía no tiene clase— ya sale oscuro. El `<html>` del layout lleva
 * `suppressHydrationWarning` porque ese script escribe la clase antes de que
 * React hidrate.
 *
 * Todas las opciones se pueden sobrescribir desde fuera vía props.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
