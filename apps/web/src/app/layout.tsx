import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from 'next/font/google';
import type { ReactNode } from 'react';

import { DensityProvider } from '@/components/density-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/lib/query-client';
import './globals.css';

/**
 * Atkinson Hyperlegible Next — dibujada por el Braille Institute para que las
 * letras que se confunden no se confundan. Responde al problema real de la
 * bahía: mala luz, mirada de reojo y pantalla sucia.
 */
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-atkinson',
  display: 'swap',
  // Next no trae metricas de respaldo para esta familia: las declaramos a mano
  // para que el texto no salte al cargar.
  adjustFontFallback: false,
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

/** La mono de la misma familia: el VIN y el folio hablan con la misma voz. */
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ['latin'],
  variable: '--font-atkinson-mono',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Elite Service',
  description: 'Sistema de gestion de taller',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="es"
      data-density="mostrador"
      className={`${atkinson.variable} ${atkinsonMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <DensityProvider>
            <Providers>{children}</Providers>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
