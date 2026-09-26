'use client';

import { useState, type ReactNode } from 'react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Volver a la ventana cuenta como volver (spec 062). TanStack solo escucha
 * `visibilitychange`, y el mostrador con dos monitores cambia de ventana sin
 * que la pestaña se oculte: sin `focus`, no pediría nada.
 */
if (typeof window !== 'undefined') {
  focusManager.setEventListener((handleFocus) => {
    const onVisibility = () => handleFocus(document.visibilityState === 'visible');
    const onFocus = () => handleFocus(true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Entrar a una pantalla o volver a la ventana pide de nuevo (062). No
        // hay SSR con hidratación que proteger; lo que casi no cambia, como los
        // catálogos, fija su propio `staleTime` en el hook.
        staleTime: 0,
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
