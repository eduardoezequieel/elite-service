'use client';

import { PERMISSIONS } from '@elite/shared';
import type { ServiceDetail, VehicleBodyType } from '@elite/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Reference } from '@/components/ui/reference';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import {
  useCatalogBodyTypes,
  useCatalogCategories,
  useCatalogServices,
  useUpdateService,
} from '../hooks/use-catalog';

/**
 * El catálogo de lavado: los servicios y cuánto cuesta cada uno por tipo de
 * carro.
 *
 * La matriz es el corazón de la pantalla, así que se muestra desplegada en la
 * tabla en vez de escondida detrás de un diálogo: el precio de camioneta es un
 * dato que el dueño mira todos los días, no una configuración avanzada.
 *
 * **Una celda vacía no es cero: es «usa el precio base» (RN-2).** Se dibuja con
 * un guion, igual que en la matriz de permisos, porque ausente y cero son cosas
 * distintas y confundirlas haría un servicio gratis.
 */
export function CatalogScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.services.actions.read.key);
  const canManage = can(PERMISSIONS.services.actions.manage.key);
  const services = useCatalogServices(canRead);
  const categories = useCatalogCategories(canRead);
  const bodyTypes = useCatalogBodyTypes(canRead);
  const [editing, setEditing] = useState<ServiceDetail | null>(null);

  const types = bodyTypes.data ?? [];
  const columns = 4 + types.length + (canManage ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display">Catálogo</h1>
        <p className="text-muted-foreground text-dense">
          {categories.data?.length ?? 0} categorías · precios con IVA incluido
        </p>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Ref.</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead className="hidden md:table-cell">Categoría</TableHead>
            <TableHead className="text-right">Base</TableHead>
            {types.map((type) => (
              <TableHead key={type.id} className="text-right">
                {type.name}
              </TableHead>
            ))}
            <TableHead>Estado</TableHead>
            {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(services.data ?? []).length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns}
                className={cn(
                  'whitespace-normal text-dense',
                  services.error === null ? 'text-muted-foreground' : 'text-stamp-red',
                )}
              >
                {services.error?.message ??
                  (services.isPending ? 'Cargando…' : 'Todavía no hay servicios.')}
              </TableCell>
            </TableRow>
          ) : (
            (services.data ?? []).map((service, index) => (
              <TableRow key={service.id}>
                <TableCell className="align-middle">
                  <Reference value={index + 1} />
                </TableCell>
                <TableCell>
                  <span className={cn('text-body', !service.isActive && 'is-ruled-out')}>
                    {service.name}
                  </span>
                  <span className="text-muted-foreground text-dense block font-mono">
                    {service.code}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {service.category.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">${service.defaultPrice}</TableCell>
                {types.map((type) => {
                  const cell = service.prices.find((price) => price.bodyTypeId === type.id);

                  return (
                    <TableCell key={type.id} className="text-right tabular-nums">
                      {/* El guion dice «usa el base», no «cero» (RN-2). */}
                      {cell === undefined ? (
                        <span
                          className="text-muted-foreground"
                          title="Sin precio propio: usa el base"
                        >
                          —
                        </span>
                      ) : (
                        `$${cell.price}`
                      )}
                    </TableCell>
                  );
                })}
                <TableCell>
                  {service.isActive ? (
                    <Stamp tone="green" label="Activo" />
                  ) : (
                    <Stamp tone="neutral" label="Inactivo" />
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" onClick={() => setEditing(service)}>
                      Editar
                      <span className="sr-only"> {service.name}</span>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <p className="text-muted-foreground text-dense">
        Una celda con guion (—) significa que ese servicio usa su precio base para ese tipo de
        carro. No es cero.
      </p>

      {editing === null ? null : (
        <ServiceDialog
          service={editing}
          bodyTypes={types}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/**
 * Edición de un servicio y su matriz.
 *
 * Un precio en blanco **borra** esa celda y devuelve el servicio al precio
 * base para ese tipo de carro. Es la única forma de expresar «volvé a usar el
 * base», y por eso el campo se puede vaciar en vez de exigir un número.
 */
function ServiceDialog({
  service,
  bodyTypes,
  onClose,
}: {
  service: ServiceDetail;
  bodyTypes: VehicleBodyType[];
  onClose: () => void;
}) {
  const update = useUpdateService();
  const [name, setName] = useState(service.name);
  const [defaultPrice, setDefaultPrice] = useState(service.defaultPrice);
  const [isActive, setIsActive] = useState(service.isActive);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(service.prices.map((price) => [price.bodyTypeId, price.price])),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            update.mutate(
              {
                id: service.id,
                input: {
                  name: name.trim(),
                  defaultPrice,
                  isActive,
                  prices: Object.entries(prices)
                    .filter(([, price]) => price.trim() !== '')
                    .map(([bodyTypeId, price]) => ({ bodyTypeId, price })),
                },
              },
              { onSuccess: onClose },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Editar servicio</DialogTitle>
            <DialogDescription>
              Los precios llevan el IVA incluido. Dejá una celda vacía para que use el precio base.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="service-name">Nombre</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="service-price">Precio base</Label>
            <Input
              id="service-price"
              value={defaultPrice}
              onChange={(event) => setDefaultPrice(event.target.value)}
              inputMode="decimal"
              className="tabular-nums"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-label text-muted-foreground">Precio por tipo de carro</p>
            {bodyTypes.map((type) => (
              <div key={type.id} className="grid gap-1.5">
                <Label htmlFor={`price-${type.id}`}>{type.name}</Label>
                <Input
                  id={`price-${type.id}`}
                  value={prices[type.id] ?? ''}
                  placeholder={`Usa el base ($${defaultPrice})`}
                  onChange={(event) =>
                    setPrices((current) => ({ ...current, [type.id]: event.target.value }))
                  }
                  inputMode="decimal"
                  className="tabular-nums"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="service-active">Activo</Label>
            <Switch id="service-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {update.error ? (
            <p className="text-stamp-red text-body" role="alert">
              {update.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
