'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Evita refetch inmediato en el cliente tras el render del servidor.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

/**
 * Proveedores globales de la aplicacion (componente cliente).
 *
 * El `QueryClient` se crea con `useState` para que cada render del servidor
 * tenga su propia instancia y no se comparta cache entre peticiones.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
