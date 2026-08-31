import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { DensityProvider } from '@/components/density-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/lib/query-client';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
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
      className={`${archivo.variable} ${jetBrainsMono.variable}`}
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
