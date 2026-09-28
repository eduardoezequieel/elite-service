import type { ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import type { CatalogTab } from '../catalog-tabs';

/**
 * El marco común de las pestañas de Catálogo (spec 068): la misma cabecera
 * —título, recuento y las acciones de la pestaña— y la barra de pestañas
 * debajo, para que el título no salte de sitio al cambiar de pestaña.
 *
 * Sin barra (el usuario ve una sola pestaña) el contenido va directo, como la
 * pantalla de siempre.
 */
export function CatalogFrame({
  tab,
  tabs,
  subtitle,
  actions,
  children,
}: {
  tab: CatalogTab;
  /** La barra de pestañas, o `null` si solo hay una. */
  tabs: ReactNode;
  subtitle: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <ScreenHeader title="Catálogo" subtitle={subtitle}>
        {actions}
      </ScreenHeader>

      {tabs === null ? (
        children
      ) : (
        <>
          <div className="mb-5">{tabs}</div>
          <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
