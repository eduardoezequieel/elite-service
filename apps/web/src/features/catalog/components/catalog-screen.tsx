'use client';

import { PERMISSIONS } from '@elite/shared';
import type { ServiceDetail, VehicleBodyType } from '@elite/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Eye, Pencil, Search } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import {
  useCatalogBodyTypes,
  useCatalogCategories,
  useCatalogServices,
  useCreateService,
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
 *
 * **El precio que se sale del base se lee de un vistazo:** va en la llama y en
 * negrita, que es el único sitio del sistema donde el naranja marca un dato y
 * no una acción (DESIGN.md → «datos que se salen del valor base»).
 */

/** Los precios llegan como cadena decimal («8.00»); se comparan por valor. */
function samePrice(left: string, right: string): boolean {
  const a = Number(left);
  const b = Number(right);

  return Number.isNaN(a) || Number.isNaN(b) ? left.trim() === right.trim() : a === b;
}

/** «3 servicios activos», o «3 activos · 1 inactivo» cuando hay de los dos. */
function countsLabel(services: readonly ServiceDetail[]): string {
  const active = services.filter((service) => service.isActive).length;
  const inactive = services.length - active;

  if (inactive === 0) {
    return active === 1 ? '1 servicio activo' : `${active} servicios activos`;
  }

  return `${active} ${active === 1 ? 'activo' : 'activos'} · ${inactive} ${
    inactive === 1 ? 'inactivo' : 'inactivos'
  }`;
}

export function CatalogScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.services.actions.read.key);
  const canManage = can(PERMISSIONS.services.actions.manage.key);
  const services = useCatalogServices(canRead);
  const bodyTypes = useCatalogBodyTypes(canRead);
  const [editing, setEditing] = useState<ServiceDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const types = bodyTypes.data ?? [];
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim().toLowerCase());
  const rows = useMemo(() => {
    const all = services.data ?? [];
    if (search === '') return all;

    return all.filter(
      (service) =>
        service.name.toLowerCase().includes(search) ||
        service.code.toLowerCase().includes(search) ||
        service.category.name.toLowerCase().includes(search),
    );
  }, [search, services.data]);

  const newServiceButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      Nuevo servicio
    </Button>
  ) : null;

  // La nota del guion solo aparece si de verdad hay un guion en la tabla: si
  // todos los servicios tienen precio propio para todos los tipos, explicar el
  // guion sería explicar algo que no está.
  const hasDash = rows.some((service) =>
    types.some((type) => !service.prices.some((price) => price.bodyTypeId === type.id)),
  );

  return (
    <div>
      <ScreenHeader title="Catálogo" subtitle={`${countsLabel(rows)} · precios con IVA incluido`}>
        {canManage ? (
          <Button asChild variant="outline">
            <Link href="/settings/catalog/categories">Categorías</Link>
          </Button>
        ) : null}
        {rows.length > 0 ? newServiceButton : null}
      </ScreenHeader>

      <div className="mb-4 max-w-md">
        <FieldBox>
          <Label htmlFor="catalog-search">Buscar por nombre, código o categoría</Label>
          <div className="flex items-center gap-2">
            <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
            <Input
              id="catalog-search"
              className="min-w-0 flex-1"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
            />
          </div>
        </FieldBox>
      </div>

      <DataTable
        rows={rows}
        rowKey={(service) => service.id}
        isLoading={services.isPending}
        errorMessage={services.error?.message ?? null}
        emptyTitle="Todavía no hay servicios"
        emptyMessage="Cuando el catálogo tenga servicios de lavado van a aparecer acá con sus precios por tipo de carro."
        emptyAction={rows.length === 0 ? newServiceButton : undefined}
        columns={[
          {
            key: 'service',
            header: 'Servicio',
            headerClassName: 'w-full',
            stack: 'title',
            cell: (service) => (
              <>
                <span
                  className={cn('text-body font-semibold', !service.isActive && 'is-ruled-out')}
                >
                  {service.name}
                </span>
                <span className="text-text-faint block font-mono text-dense">{service.code}</span>
              </>
            ),
          },
          {
            key: 'category',
            header: 'Categoría',
            className: 'whitespace-nowrap',
            cell: (service) => <Stamp tone="queue" label={service.category.name} />,
          },
          {
            key: 'base',
            header: 'Base',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (service) => (
              <span className="font-mono tabular-nums">${service.defaultPrice}</span>
            ),
          },
          // La matriz de precios se despliega en la tabla en vez de esconderse
          // detrás de un diálogo: el precio de camioneta es un dato que el dueño
          // mira todos los días, no una configuración avanzada. En la lámina
          // táctil cada tipo de carro baja como una línea rotulada.
          ...types.map((type): DataTableColumn<ServiceDetail> => ({
            key: type.id,
            header: type.name,
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (service) => {
              const cell = service.prices.find((price) => price.bodyTypeId === type.id);

              // El guion dice «usa el base», no «cero» (RN-2).
              if (cell === undefined) {
                return (
                  <span className="text-text-faint" title="Sin precio propio: usa el base">
                    —
                  </span>
                );
              }

              return (
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    !samePrice(cell.price, service.defaultPrice) && 'text-flame-text font-bold',
                  )}
                >
                  ${cell.price}
                </span>
              );
            },
          })),
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (service) =>
              service.isActive ? (
                <Stamp tone="queue" label="Activo" />
              ) : (
                <Stamp tone="neutral" label="Inactivo" />
              ),
          },
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions' as const,
            className: 'whitespace-nowrap',
            cell: (service: ServiceDetail) => (
              <Button type="button" variant="outline" onClick={() => setEditing(service)}>
                {canManage ? (
                  <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                ) : (
                  <Eye className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                )}
                {canManage ? 'Editar' : 'Ver'}
                <span className="sr-only"> {service.name}</span>
              </Button>
            ),
          },
        ]}
      />

      {hasDash ? (
        <p className="text-text-faint mt-4 text-dense">
          Una celda con guion (—) significa que ese servicio usa su precio base para ese tipo de
          carro. No es cero.
        </p>
      ) : null}

      {creating ? (
        <ServiceDialog key="new" service={null} bodyTypes={types} onClose={() => setCreating(false)} />
      ) : null}
      {editing === null ? null : (
        <ServiceDialog
          key={editing.id}
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
  service: ServiceDetail | null;
  bodyTypes: VehicleBodyType[];
  onClose: () => void;
}) {
  const isNew = service === null;
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.services.actions.manage.key);
  const create = useCreateService();
  const update = useUpdateService();
  const categories = useCatalogCategories(isNew);
  const { toast } = useToast();
  const [name, setName] = useState(service?.name ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(service?.defaultPrice ?? '');
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((service?.prices ?? []).map((price) => [price.bodyTypeId, price.price])),
  );

  const activeCategories = (categories.data ?? []).filter((category) => category.isActive);
  const needsCategory = isNew && activeCategories.length === 0;
  const matrix = Object.entries(prices)
    .filter(([, price]) => price.trim() !== '')
    .map(([bodyTypeId, price]) => ({ bodyTypeId, price }));
  const complete =
    name.trim() !== '' &&
    defaultPrice.trim() !== '' &&
    (!isNew || categoryId !== '');
  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete || needsCategory) return;

            if (isNew) {
              create.mutate(
                {
                  name: name.trim(),
                  categoryId,
                  defaultPrice,
                  prices: matrix,
                },
                {
                  onSuccess: () => {
                    toast({ title: 'Servicio creado', description: name.trim() });
                    onClose();
                  },
                },
              );
              return;
            }

            update.mutate(
              {
                id: service.id,
                input: {
                  name: name.trim(),
                  defaultPrice,
                  isActive,
                  prices: matrix,
                },
              },
              {
                onSuccess: () => {
                  toast({ title: 'Servicio guardado', description: name.trim() });
                  onClose();
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nuevo servicio' : 'Editar servicio'}</DialogTitle>
            <DialogDescription>
              {needsCategory
                ? 'Primero hace falta una categoría activa.'
                : 'Los precios llevan el IVA incluido. Dejá una celda vacía para que use el precio base.'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {needsCategory ? (
              <p className="text-body text-text-dim">
                Creá una categoría y volvé a este diálogo.{' '}
                <Link href="/settings/catalog/categories" className="text-flame-text font-semibold">
                  Ir a Categorías
                </Link>
              </p>
            ) : (
              <>
                <FieldBox>
                  <Label htmlFor="service-name">Nombre</Label>
                  <Input
                    id="service-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FieldBox>

                {isNew ? (
                  <FieldBox>
                    <Label htmlFor="service-category">Categoría</Label>
                    <select
                      id="service-category"
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      className="text-text text-body w-full bg-transparent"
                    >
                      <option value="">Elegí una categoría</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </FieldBox>
                ) : null}

                <FieldBox>
                  <Label htmlFor="service-price">Precio base</Label>
                  <Input
                    id="service-price"
                    value={defaultPrice}
                    onChange={(event) => setDefaultPrice(event.target.value)}
                    inputMode="decimal"
                    className="font-mono tabular-nums"
                  />
                </FieldBox>

                <div className="flex flex-col gap-2">
                  <p className="text-text-faint text-label">Precio por tipo de carro</p>
                  {bodyTypes.map((type) => (
                    <FieldBox key={type.id}>
                      <Label htmlFor={`price-${type.id}`}>{type.name}</Label>
                      <Input
                        id={`price-${type.id}`}
                        value={prices[type.id] ?? ''}
                        placeholder={`Usa el base ($${defaultPrice})`}
                        onChange={(event) =>
                          setPrices((current) => ({ ...current, [type.id]: event.target.value }))
                        }
                        inputMode="decimal"
                        className="font-mono tabular-nums"
                      />
                    </FieldBox>
                  ))}
                </div>

                {isNew ? null : (
                  <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                    <Label htmlFor="service-active">Activo</Label>
                    <Switch id="service-active" checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                )}
              </>
            )}

            {error ? (
              <p className="text-danger-text text-body" role="alert">
                {error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {needsCategory || !canManage ? 'Cerrar' : 'Cancelar'}
            </Button>
            {needsCategory || !canManage ? null : (
              <Button type="submit" disabled={!complete} loading={isPending}>
                {isNew ? 'Crear servicio' : 'Guardar cambios'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
