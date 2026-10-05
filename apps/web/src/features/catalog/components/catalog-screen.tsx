'use client';

import { PERMISSIONS, createServiceSchema } from '@elite/shared';
import type { ServiceDetail, VehicleBodyType } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, FolderTree, Pencil, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { CategoryField } from '@/components/category-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DetailField } from '@/components/ui/detail-field';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { CombosPanel } from '@/features/combos/components/combos-panel';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import {
  activityFlag,
  activityOptions,
  countActiveFilters,
  isAll,
  withAllOption,
} from '@/lib/list-filters';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { replaceQuery } from '@/lib/list-params';
import {
  CATALOG_TAB_LABELS,
  allowedCatalogTabs,
  catalogTabKind,
  catalogTabQuery,
  resolveCatalogTab,
  type CatalogTab,
} from '../catalog-tabs';
import {
  useCatalogBodyTypes,
  useCatalogCategories,
  useCatalogServices,
  useCreateCategory,
  useCreateService,
  useUpdateService,
} from '../hooks/use-catalog';
import { CatalogFrame } from './catalog-frame';
import { ItemDefinitionsPanel } from './item-definitions-panel';

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
function countsLabel(active: number, inactive: number): string {
  if (inactive === 0) {
    return active === 1 ? '1 servicio activo' : `${active} servicios activos`;
  }

  return `${active} ${active === 1 ? 'activo' : 'activos'} · ${inactive} ${
    inactive === 1 ? 'inactivo' : 'inactivos'
  }`;
}

/**
 * `/settings/catalog` (spec 068): Servicios · Combos (104) · Productos · Insumos en pestañas.
 * Se junta la pantalla, no los datos: servicios y artículos siguen siendo
 * modelos distintos. La pestaña viaja en la URL y cada una pide su permiso.
 */
export function CatalogScreen({ initialTab }: { initialTab?: string | string[] }) {
  const { can } = usePermissions();
  const allowed = useMemo(() => allowedCatalogTabs(can), [can]);
  const [requested, setRequested] = useState(initialTab);
  const tab = resolveCatalogTab(requested, allowed);

  useEffect(() => {
    if (tab !== null) replaceQuery(catalogTabQuery(tab, allowed));
  }, [tab, allowed]);

  if (tab === null) return null;

  const tabs =
    allowed.length > 1 ? (
      <Tabs<CatalogTab>
        aria-label="Sección del catálogo"
        value={tab}
        onValueChange={setRequested}
        items={allowed.map((value) => ({ value, label: CATALOG_TAB_LABELS[value] }))}
      />
    ) : null;

  if (tab === 'combos') return <CombosPanel tabs={tabs} />;

  const kind = catalogTabKind(tab);

  return kind === null ? (
    <ServicesPanel tabs={tabs} />
  ) : (
    <ItemDefinitionsPanel key={tab} tab={tab} kind={kind} tabs={tabs} />
  );
}

/** Catálogo → Servicios: la pantalla de la spec 016, tal cual. */
function ServicesPanel({ tabs }: { tabs: ReactNode }) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.services.actions.read.key);
  const canManage = can(PERMISSIONS.services.actions.manage.key);
  const bodyTypes = useCatalogBodyTypes(canRead);
  const [editing, setEditing] = useState<ServiceDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const types = bodyTypes.data ?? [];
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const extra = useFilterValues(['category', 'active'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = search !== '' || extraActive > 0;
  // Búsqueda y filtros los resuelve el API (102). La página vive en el estado,
  // como en las pestañas de Productos e Insumos: la URL ya lleva la pestaña.
  const narrowedBy = `${search}|${extra.values.category}|${extra.values.active}`;
  const [paging, setPaging] = useState({ narrowedBy, page: 1 });
  const page = paging.narrowedBy === narrowedBy ? paging.page : 1;
  const services = useCatalogServices(
    {
      search: search === '' ? undefined : search,
      categoryId: isAll(extra.values.category) ? undefined : extra.values.category,
      active: activityFlag(extra.values.active),
      page,
      pageSize: LIST_PAGE_SIZE,
    },
    canRead,
  );
  // Las cuentas del subtítulo son del catálogo entero, no de la búsqueda.
  const activeCount = useCatalogServices({ active: true, pageSize: 1 }, canRead);
  const inactiveCount = useCatalogServices({ active: false, pageSize: 1 }, canRead);
  const totalCount = (activeCount.data?.total ?? 0) + (inactiveCount.data?.total ?? 0);
  const counted = activeCount.data !== undefined && inactiveCount.data !== undefined;
  // El filtro ofrece todas las categorías del catálogo, no solo las de la página.
  const categories = useCatalogCategories(canRead);
  const categoryOptions = useMemo(
    () =>
      withAllOption(
        'Todas las categorías',
        (categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
      ),
    [categories.data],
  );
  const rows = services.data?.items ?? [];

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
    <CatalogFrame
      tab="services"
      tabs={tabs}
      subtitle={
        counted
          ? `${countsLabel(activeCount.data?.total ?? 0, inactiveCount.data?.total ?? 0)} · precios con IVA incluido`
          : 'Precios con IVA incluido'
      }
      actions={
        <>
          {canManage ? (
            <Button asChild variant="outline">
              <Link href="/settings/catalog/categories">
                <FolderTree className="size-icon" strokeWidth={1.5} aria-hidden />
                Categorías
              </Link>
            </Button>
          ) : null}
          {totalCount > 0 ? newServiceButton : null}
        </>
      }
    >
      <FilterBar className="mb-4">
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="catalog-search">Buscar por nombre, código o categoría</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
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
        <FiltersPopover
          fields={[
            {
              id: 'category',
              label: 'Categoría',
              value: extra.values.category,
              options: categoryOptions,
              onChange: (value) => extra.set('category', value),
            },
            {
              id: 'active',
              label: 'Estado',
              value: extra.values.active,
              options: activityOptions('Todos los estados', 'Activos', 'Inactivos'),
              onChange: (value) => extra.set('active', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      <DataTable
        rows={rows}
        rowKey={(service) => service.id}
        reference={(_service, index) => pagedReference(services.data, index)}
        isLoading={services.isPending}
        errorMessage={services.error?.message ?? null}
        emptyTitle={narrowing ? 'Ningún servicio coincide' : 'Todavía no hay servicios'}
        emptyMessage={
          search !== ''
            ? `No hay nombre, código ni categoría que coincida con «${search}».`
            : extraActive > 0
              ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
              : 'Cuando el catálogo tenga servicios de lavado van a aparecer acá con sus precios por tipo de vehículo.'
        }
        emptyAction={!narrowing && counted && totalCount === 0 ? newServiceButton : undefined}
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
                <Stamp tone="green" label="Activo" />
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

      <div className="mt-4">
        <Pager
          page={services.data}
          noun={{ one: 'servicio', many: 'servicios' }}
          onPageChange={(next) => setPaging({ narrowedBy, page: next })}
        />
      </div>

      {hasDash ? (
        <p className="text-text-faint mt-4 text-dense">
          Una celda con guion (—) significa que ese servicio usa su precio base para ese tipo de
          carro. No es cero.
        </p>
      ) : null}

      {creating ? (
        <ServiceDialog
          key="new"
          service={null}
          bodyTypes={types}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editing === null ? null : (
        <ServiceDialog
          key={editing.id}
          service={editing}
          bodyTypes={types}
          onClose={() => setEditing(null)}
        />
      )}
    </CatalogFrame>
  );
}

const moneyField = createServiceSchema.shape.defaultPrice;

function moneyIssue(value: string): string | null {
  const result = moneyField.safeParse(value);
  if (result.success) return null;

  return result.error.issues[0]?.message ?? 'Escribí un monto válido, con hasta dos decimales.';
}

const serviceFormSchema = z
  .object({
    name: createServiceSchema.shape.name,
    categoryId: z.string(),
    defaultPrice: z.string(),
    isActive: z.boolean(),
    prices: z.record(z.string(), z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.categoryId.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Elegí la categoría.' });
    }

    const baseIssue = moneyIssue(values.defaultPrice);
    if (baseIssue !== null) {
      ctx.addIssue({ code: 'custom', path: ['defaultPrice'], message: baseIssue });
    }

    for (const [bodyTypeId, price] of Object.entries(values.prices)) {
      if (price.trim() === '') continue;
      const cellIssue = moneyIssue(price);
      if (cellIssue !== null) {
        ctx.addIssue({ code: 'custom', path: ['prices', bodyTypeId], message: cellIssue });
      }
    }
  });

type ServiceFormValues = z.input<typeof serviceFormSchema>;
type ServiceFormOutput = z.output<typeof serviceFormSchema>;

function matrixOf(prices: Record<string, string>): { bodyTypeId: string; price: string }[] {
  return Object.entries(prices)
    .filter(([, price]) => price.trim() !== '')
    .map(([bodyTypeId, price]) => ({ bodyTypeId, price: price.trim() }));
}

/**
 * Edición de un servicio y su matriz.
 *
 * Un precio en blanco **borra** esa celda y devuelve el servicio al precio
 * base para ese tipo de carro. Es la única forma de expresar «volvé a usar el
 * base», y por eso el campo se puede vaciar en vez de exigir un número.
 *
 * Sin `services.manage` la ficha es texto plano: nombre, categoría, precios y
 * estado. Nunca un control editable sin botón de guardar. DESIGN.md → Inputs.
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
  const categories = useCatalogCategories(canManage);
  const createCategory = useCreateCategory();
  const { toast } = useToast();
  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(serviceFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: service?.name ?? '',
      categoryId: service?.category.id ?? '',
      defaultPrice: service?.defaultPrice ?? '',
      isActive: service?.isActive ?? true,
      prices: Object.fromEntries(
        bodyTypes.map((type) => [
          type.id,
          service?.prices.find((price) => price.bodyTypeId === type.id)?.price ?? '',
        ]),
      ),
    },
  });

  // La categoría actual se ofrece aunque esté inactiva: editar el precio no
  // obliga a mudar el servicio de categoría.
  const activeCategories = (categories.data ?? []).filter(
    (category) => category.isActive || category.id === service?.category.id,
  );
  const name = form.watch('name');
  const categoryId = form.watch('categoryId');
  const defaultPrice = form.watch('defaultPrice');
  const complete =
    name.trim() !== '' &&
    defaultPrice.trim() !== '' &&
    moneyIssue(defaultPrice) === null &&
    categoryId !== '';
  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  const submit = form.handleSubmit((values) => {
    const prices = matrixOf(values.prices);

    if (isNew) {
      create.mutate(
        {
          name: values.name,
          categoryId: values.categoryId,
          defaultPrice: values.defaultPrice,
          prices,
        },
        {
          onSuccess: () => {
            toast({ title: 'Servicio creado', description: values.name });
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
          name: values.name,
          categoryId: values.categoryId,
          defaultPrice: values.defaultPrice,
          isActive: values.isActive,
          prices,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Servicio guardado', description: values.name });
          onClose();
        },
      },
    );
  });

  if (!canManage) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ver servicio</DialogTitle>
            <DialogDescription>
              Solo lectura: no tenés permiso para administrar el catálogo.
            </DialogDescription>
          </DialogHeader>
          {service ? <ServiceDetail service={service} bodyTypes={bodyTypes} /> : null}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={submit}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>{isNew ? 'Nuevo servicio' : 'Editar servicio'}</DialogTitle>
              <DialogDescription>
                Los precios llevan el IVA incluido. Dejá una celda vacía para que use el precio
                base.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input id="service-name" autoComplete="off" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    {/* Sin categorías, o sin la que hace falta, se crea
                            desde acá sin salir del diálogo (086). */}
                    <CategoryField
                      id="service-category"
                      options={activeCategories.map((category) => ({
                        value: category.id,
                        label: category.name,
                      }))}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      onCreate={async (name) => (await createCategory.mutateAsync({ name })).id}
                      invalid={fieldState.invalid}
                      pending={categories.isPending}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultPrice"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Precio base</FormLabel>
                      <FormControl>
                        <Input
                          id="service-price"
                          inputMode="decimal"
                          className="font-mono tabular-nums"
                          {...field}
                        />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <p className="text-text-faint text-label">Precio por tipo de vehículo</p>
                {bodyTypes.map((type) => (
                  <FormField
                    key={type.id}
                    control={form.control}
                    name={`prices.${type.id}`}
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox>
                          <FormLabel>{type.name}</FormLabel>
                          <FormControl>
                            <Input
                              id={`price-${type.id}`}
                              placeholder={`Usa el base ($${defaultPrice || '0.00'})`}
                              inputMode="decimal"
                              className="font-mono tabular-nums"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FieldBox>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {isNew ? null : (
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                        <FormLabel>Activo</FormLabel>
                        <FormControl>
                          <Switch
                            id="service-active"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {error ? (
                <p className="text-danger-text text-body" role="alert">
                  {error.message}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!complete} loading={isPending}>
                {isNew ? 'Crear servicio' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function priceOrDash(value: string | undefined): ReactNode {
  if (value === undefined || value.trim() === '') {
    return <span className="text-text-faint">—</span>;
  }

  return <span className="font-mono tabular-nums">${value}</span>;
}

function ServiceDetail({
  service,
  bodyTypes,
}: {
  service: ServiceDetail;
  bodyTypes: VehicleBodyType[];
}) {
  return (
    <>
      <DialogBody>
        <DetailField label="Nombre">{service.name}</DetailField>
        <DetailField label="Categoría">{service.category.name}</DetailField>
        <DetailField label="Precio base">{priceOrDash(service.defaultPrice)}</DetailField>
        {bodyTypes.map((type) => {
          const cell = service.prices.find((price) => price.bodyTypeId === type.id);

          return (
            <DetailField key={type.id} label={type.name}>
              {priceOrDash(cell?.price)}
            </DetailField>
          );
        })}
        <DetailField label="Estado">
          {service.isActive ? (
            <Stamp tone="green" label="Activo" />
          ) : (
            <Stamp tone="neutral" label="Inactivo" />
          )}
        </DetailField>
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cerrar
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
