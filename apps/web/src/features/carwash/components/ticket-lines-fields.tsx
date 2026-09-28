'use client';

import type { InventoryItemOption, ServiceDetail } from '@elite/shared';
import { useFormContext, useWatch } from 'react-hook-form';

import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form';
import type { StockShortage } from '../product-lines';
import type { TicketFormInput, TicketFormOutput } from '../ticket-draft';
import { ProductPicker } from './product-picker';
import { ServicePicker } from './service-picker';

/**
 * «Servicios» del alta. El precio de cada uno se muestra **ya resuelto para el
 * tipo de carro elegido** (RN-2) y se toca para descontar, con el tope del
 * catálogo (022 RN-5). Sin tipo de carro no hay precio que mostrar.
 */
export function ServicesCard({ services }: { services: ServiceDetail[] }) {
  const { control } = useFormContext<TicketFormInput, unknown, TicketFormOutput>();
  const bodyTypeId = useWatch({ control, name: 'bodyTypeId' });

  return (
    <Card className="min-w-0 gap-0 px-card">
      <fieldset className="min-w-0">
        <legend className="text-title text-text">Servicios</legend>
        <p className="text-text-faint text-dense mt-1">
          {bodyTypeId === ''
            ? 'Elegí primero el carro: el precio depende del tipo.'
            : 'Tocá un rubro para abrirlo. Uno por rubro; los rubros se suman, y el precio se toca para descontar.'}
        </p>

        <div className="mt-4">
          {bodyTypeId === '' ? (
            <p className="text-text-dim text-body">Todavía no hay precio que mostrar.</p>
          ) : (
            <FormField
              control={control}
              name="selection"
              render={({ field }) => (
                <ServicePicker
                  services={services}
                  bodyTypeId={bodyTypeId}
                  value={field.value}
                  onChange={field.onChange}
                  idPrefix="ticket"
                />
              )}
            />
          )}
        </div>
      </fieldset>
    </Card>
  );
}

/**
 * «Productos» del alta (065): lo que se le aplica al carro y se cobra aparte,
 * con su cantidad. Sale del inventario al abrir el lavado; si justo se acabó,
 * el API responde `409 INSUFFICIENT_STOCK` y la fila dice cuánto hay.
 */
export function ProductsCard({
  scope,
  searchProducts,
  shortage,
}: {
  scope: string;
  searchProducts: (search: string) => Promise<InventoryItemOption[]>;
  shortage: StockShortage | null;
}) {
  const { control } = useFormContext<TicketFormInput, unknown, TicketFormOutput>();

  return (
    <Card className="min-w-0 gap-0 px-card">
      <fieldset className="min-w-0">
        <legend className="text-title text-text">Productos</legend>
        <p className="text-text-faint text-dense mt-1">
          Opcional. Salen del inventario al abrir el lavado y vuelven si se quitan.
        </p>

        <div className="mt-4">
          <FormField
            control={control}
            name="products"
            render={({ field }) => (
              <ProductPicker
                scope={scope}
                searchProducts={searchProducts}
                value={field.value}
                onChange={field.onChange}
                shortage={shortage}
                idPrefix="ticket"
              />
            )}
          />
        </div>
      </fieldset>
    </Card>
  );
}
