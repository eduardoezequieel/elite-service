import type { Metadata } from 'next';
import { Inter, Saira } from 'next/font/google';
import type { ReactNode } from 'react';

import { DensityProvider } from '@/components/density-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/toast-provider';
import { Providers } from '@/lib/query-client';
import './globals.css';

/**
 * Saira — la itálica ancha del logo de Elite Service. Es la voz de la marca:
 * títulos de pantalla, cifras de estadística, totales grandes y el wordmark.
 * Se cargan las variantes que el sistema usa de verdad: 600 y 700 en redonda,
 * 700 y 800 en itálica.
 */
const saira = Saira({
  subsets: ['latin'],
  variable: '--font-saira',
  display: 'swap',
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
});

/** Inter — la interfaz. Cuerpo 14.5px, pesos 400/500/600/700. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
      className={`${saira.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <DensityProvider>
            <Providers>
              <ToastProvider>{children}</ToastProvider>
            </Providers>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
