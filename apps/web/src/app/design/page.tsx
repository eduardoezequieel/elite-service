import type { Metadata } from 'next';

import { DesignReference } from '@/components/design-reference/design-reference';

export const metadata: Metadata = {
  title: 'Sistema de diseño · Elite Service',
  description: 'Referencia visual del sistema: color, tipografía, componentes y densidades.',
};

/**
 * `/design` vive fuera de `(app)`: no tiene riel, no pide sesión y no depende de
 * ningún permiso. Es la referencia del sistema, no una pantalla del taller.
 */
export default function DesignPage() {
  return <DesignReference />;
}
