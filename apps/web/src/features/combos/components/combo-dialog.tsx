'use client';

import {
  COMBO_MAX_PRODUCT_QUANTITY,
  COMBO_NAME_MAX_LENGTH,
  MAX_PAGE_SIZE,
  type InventoryItemOption,
  type VehicleBodyType,
} from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/toast-provider';
import { listProductOptions } from '@/features/carwash/api';
import { useProductOptions } from '@/features/carwash/hooks/use-product-options';
import { toMilli } from '@/features/carwash/product-lines';
import { maskMoneyInput } from '@/features/carwash/pricing';
import { useCatalogServices } from '@/features/catalog/hooks/use-catalog';
import { formatCents, formatMoney } from '@/lib/money';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import {
  addPick,
  comboApiErrors,
  comboFormSchema,
  comboInputOf,
  hasPick,
  listSums,
  maskPercent,
  parsePercent,
  percentPriceCents,
  removePick,
  sameSums,
  stepPickQuantity,
  type ComboFormContext,
  type ComboFormValues,
  type ComboPick,
} from '../combo-draft';
import { WEEK_ORDER, WEEKDAY_LETTERS, WEEKDAY_NAMES } from '../combo-format';
import { useCreateCombo, useUpdateCombo } from '../hooks/use-combos';
import { Segmented } from './segmented';

const PRICING_MODES = [
  { value: 'FIXED', label: 'Precio fijo' },
  { value: 'PERCENT', label: 'Descuento %' },
] as const;

/**
 * El editor de un combo (104): una sola columna, mínimo texto. Nombre;
 * «Incluye» con buscador de servicios y productos; «Precio» fijo por tipo de
 * carro o con descuento, contra lo que suma por separado; «Vigencia» y
 * «Activo». Los errores salen al guardar, de dos o tres palabras.
 */
export function ComboDialog({
  title,
  comboId,
  initial,
  bodyTypes,
  onClose,
}: {
  title: string;
  /** El combo que se edita; `null` = alta (también al duplicar). */
  comboId: string | null;
  initial: ComboFormValues;
  bodyTypes: VehicleBodyType[];
  onClose: () => void;
}) {
  const create = useCreateCombo();
  const update = useUpdateCombo();
  const { toast } = useToast();
  const services = useCatalogServices({ active: true, pageSize: MAX_PAGE_SIZE });
  const serviceList = useMemo(() => services.data?.items ?? [], [services.data]);
  // El catálogo entero de productos da el precio de lo ya elegido; la búsqueda,
  // lo que se puede agregar.
  const allProducts = useProductOptions('carwash', listProductOptions, '');
  const bodyTypeIds = useMemo(() => bodyTypes.map((type) => type.id), [bodyTypes]);

  // El schema necesita las sumas del momento: el resolver las lee de acá.
  const context = useRef<ComboFormContext>({ bodyTypeIds, sums: {} });
  const resolver = useMemo<Resolver<ComboFormValues>>(
    () => (values, resolverContext, options) =>
      zodResolver(comboFormSchema(context.current))(values, resolverContext, options),
    [],
  );
  const form = useForm<ComboFormValues>({ resolver, defaultValues: initial });
  const { control, formState, setError } = form;
  const values = form.watch();
  const errors = formState.errors;

  /** Tras el primer «Guardar», cada cambio vuelve a validar y el error se apaga solo. */
  const setValue: typeof form.setValue = (name, value, options) =>
    form.setValue(name, value, { shouldValidate: formState.isSubmitted, ...options });
  const [general, setGeneral] = useState<string | null>(null);

  const productPrices = useMemo(
    () => Object.fromEntries((allProducts.data ?? []).map((option) => [option.id, option.price])),
    [allProducts.data],
  );
  const sums = listSums(values.items, bodyTypeIds, serviceList, productPrices);
  context.current = { bodyTypeIds, sums };

  const pending = create.isPending || update.isPending;

  const submit = form.handleSubmit((submitted) => {
    setGeneral(null);
    const input = comboInputOf(submitted, bodyTypeIds);
    const handlers = {
      onSuccess: () => {
        toast({
          title: comboId === null ? 'Combo creado' : 'Combo guardado',
          description: input.name,
        });
        onClose();
      },
      onError: (error: { code: string; message: string; details?: unknown }) => {
        const mapped = comboApiErrors(error, bodyTypeIds);
        for (const [field, message] of mapped.fields) setError(field, { message });
        setGeneral(mapped.general);
      },
    };

    if (comboId === null) create.mutate(input, handlers);
    else update.mutate({ id: comboId, input }, handlers);
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <FieldBox>
                <Label htmlFor="combo-name">Nombre</Label>
                <Input
                  id="combo-name"
                  autoComplete="off"
                  maxLength={COMBO_NAME_MAX_LENGTH}
                  aria-invalid={errors.name !== undefined}
                  {...form.register('name')}
                />
              </FieldBox>
              <FieldError message={errors.name?.message} />
            </div>

            <Section title="Incluye">
              <Controller
                control={control}
                name="items"
                render={({ field }) => (
                  <ItemsField
                    value={field.value}
                    onChange={field.onChange}
                    services={serviceList}
                    allProducts={allProducts.data ?? []}
                  />
                )}
              />
              <FieldError message={errors.items?.message ?? errors.items?.root?.message} />
            </Section>

            <Section title="Precio">
              <Segmented
                aria-label="Tipo de precio"
                items={PRICING_MODES}
                value={values.pricingMode}
                onChange={(mode) => setValue('pricingMode', mode)}
                className="sm:self-start"
              />

              {values.pricingMode === 'PERCENT' ? (
                <div className="flex flex-col gap-1.5 sm:max-w-48">
                  <FieldBox>
                    <Label htmlFor="combo-percent">Descuento</Label>
                    <div className="flex items-center gap-1.5">
                      <Controller
                        control={control}
                        name="discountPercent"
                        render={({ field }) => (
                          <Input
                            id="combo-percent"
                            inputMode="numeric"
                            className="min-w-0 flex-1 font-mono tabular-nums"
                            value={field.value}
                            onChange={(event) => field.onChange(maskPercent(event.target.value))}
                            onBlur={field.onBlur}
                            aria-invalid={errors.discountPercent !== undefined}
                          />
                        )}
                      />
                      <span className="text-text-faint">%</span>
                    </div>
                  </FieldBox>
                  <FieldError message={errors.discountPercent?.message} />
                </div>
              ) : null}

              {values.items.length < 2 ? null : (
                <PriceTable
                  values={values}
                  bodyTypes={bodyTypes}
                  sums={sums}
                  errors={errors.prices as Record<string, { message?: string } | undefined>}
                  onPrice={(bodyTypeId, price) =>
                    setValue(`prices.${bodyTypeId}`, maskMoneyInput(price))
                  }
                  onAllPrices={(price) => {
                    const clean = maskMoneyInput(price);
                    for (const id of bodyTypeIds) setValue(`prices.${id}`, clean);
                  }}
                />
              )}
            </Section>

            <Section title="Vigencia">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-text-faint text-label">Desde</span>
                  <DateField
                    value={values.validFrom}
                    onChange={(date) => setValue('validFrom', date)}
                    aria-label="Desde"
                  />
                  <FieldError message={errors.validFrom?.message} />
                </div>
                {values.noEnd ? null : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-text-faint text-label">Hasta</span>
                    <DateField
                      value={values.validTo === '' ? values.validFrom : values.validTo}
                      onChange={(date) => setValue('validTo', date)}
                      aria-label="Hasta"
                    />
                    <FieldError message={errors.validTo?.message} />
                  </div>
                )}
              </div>

              <SwitchRow
                id="combo-no-end"
                label="Sin fin"
                checked={values.noEnd}
                onChange={(noEnd) => {
                  setValue('noEnd', noEnd);
                  if (!noEnd && values.validTo === '') setValue('validTo', values.validFrom);
                }}
              />

              <div className="flex flex-col gap-1.5">
                <div role="group" aria-label="Días" className="flex flex-wrap gap-2">
                  {WEEK_ORDER.map((day) => {
                    const on = values.weekdays.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        aria-label={WEEKDAY_NAMES[day]}
                        onClick={() =>
                          setValue(
                            'weekdays',
                            on
                              ? values.weekdays.filter((value) => value !== day)
                              : [...values.weekdays, day],
                          )
                        }
                        className={cn(
                          'grid size-touch shrink-0 cursor-pointer place-items-center rounded-full border-(length:--selectable-border) font-semibold',
                          'transition-colors duration-(--duration-state) ease-standard',
                          on
                            ? 'border-flame bg-flame/12 text-text'
                            : 'border-line bg-surface-2 text-text-dim hover:border-text-faint',
                        )}
                      >
                        {WEEKDAY_LETTERS[day]}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={errors.weekdays?.message} />
              </div>

              <SwitchRow
                id="combo-active"
                label="Activo"
                checked={values.isActive}
                onChange={(isActive) => setValue('isActive', isActive)}
              />
            </Section>

            {general === null ? null : (
              <p className="text-danger-text text-body" role="alert">
                {general}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-text text-title">{title}</h3>
      {children}
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (message === undefined) return null;

  return (
    <p className="text-danger-text text-dense" role="alert">
      {message}
    </p>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * «Incluye»: lo elegido arriba (producto con su `− +` de 1 a 10) y el buscador
 * debajo. Los servicios se filtran acá; los productos, en el servidor. Las dos
 * cosas esperan el respiro de la búsqueda.
 */
function ItemsField({
  value,
  onChange,
  services,
  allProducts,
}: {
  value: ComboPick[];
  onChange: (next: ComboPick[]) => void;
  services: readonly { id: string; name: string; code: string; defaultPrice: string }[];
  allProducts: readonly InventoryItemOption[];
}) {
  const [term, setTerm] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const search = useDebouncedValue(term.trim());
  const found = useProductOptions('carwash', listProductOptions, search, search !== '');
  const needle = search.toLowerCase();
  const serviceOptions = services.filter(
    (service) =>
      needle === '' ||
      service.name.toLowerCase().includes(needle) ||
      service.code.toLowerCase().includes(needle),
  );
  const productOptions = search === '' ? allProducts : (found.data ?? []);
  const open = browsing || term !== '';

  return (
    <div className="flex flex-col gap-2.5">
      {value.map((pick, index) => (
        <div
          key={`${pick.kind}:${pick.id}`}
          className="bg-surface-2 border-line min-h-row flex items-center gap-3 rounded-row border px-(--field-px) py-1.5"
        >
          <span className="text-text min-w-0 flex-1 truncate font-semibold">{pick.name}</span>
          {pick.kind === 'PRODUCT' ? (
            <span
              role="group"
              aria-label={`Cantidad de ${pick.name}`}
              className="border-line bg-surface inline-flex shrink-0 items-center overflow-hidden rounded-control border"
            >
              <button
                type="button"
                aria-label="Uno menos"
                disabled={pick.quantity <= 1}
                onClick={() => onChange(stepPickQuantity(value, index, -1))}
                className="text-text hover:bg-surface-2 disabled:text-text-faint grid size-touch cursor-pointer place-items-center disabled:cursor-not-allowed"
              >
                <Minus aria-hidden strokeWidth={1.5} className="size-icon" />
              </button>
              <span
                aria-live="polite"
                className="text-text min-w-8 text-center font-mono font-bold tabular-nums"
              >
                {pick.quantity}
              </span>
              <button
                type="button"
                aria-label="Uno más"
                disabled={pick.quantity >= COMBO_MAX_PRODUCT_QUANTITY}
                onClick={() => onChange(stepPickQuantity(value, index, 1))}
                className="text-text hover:bg-surface-2 disabled:text-text-faint grid size-touch cursor-pointer place-items-center disabled:cursor-not-allowed"
              >
                <Plus aria-hidden strokeWidth={1.5} className="size-icon" />
              </button>
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quitar ${pick.name}`}
            onClick={() => onChange(removePick(value, index))}
          >
            <Trash2 aria-hidden strokeWidth={1.5} />
          </Button>
        </div>
      ))}

      <FieldBox>
        <Label htmlFor="combo-item-search">Agregar</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id="combo-item-search"
            type="search"
            className="min-w-0 flex-1"
            value={term}
            autoComplete="off"
            enterKeyHint="search"
            aria-expanded={open}
            aria-controls="combo-item-options"
            onFocus={() => setBrowsing(true)}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
              if (event.key === 'Escape') {
                event.stopPropagation();
                setTerm('');
                setBrowsing(false);
              }
            }}
          />
          {open ? (
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => {
                setTerm('');
                setBrowsing(false);
              }}
              className="text-text-faint hover:bg-surface-3 hover:text-text grid size-touch shrink-0 cursor-pointer place-items-center rounded-control"
            >
              <X aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          ) : null}
        </div>
      </FieldBox>

      {open ? (
        <div
          id="combo-item-options"
          className="border-line-soft bg-surface flex max-h-72 flex-col overflow-y-auto rounded-row border p-1.5"
        >
          {serviceOptions.length === 0 && productOptions.length === 0 ? (
            <p className="text-text-faint text-dense px-2 py-2">
              {found.isFetching ? 'Buscando…' : 'Sin resultados'}
            </p>
          ) : null}
          {serviceOptions.length === 0 ? null : (
            <OptionGroup label="Servicios">
              {serviceOptions.map((service) => (
                <OptionRow
                  key={service.id}
                  name={service.name}
                  meta={formatMoney(service.defaultPrice)}
                  added={hasPick(value, 'SERVICE', service.id)}
                  onAdd={() =>
                    onChange(
                      addPick(value, { kind: 'SERVICE', id: service.id, name: service.name }),
                    )
                  }
                />
              ))}
            </OptionGroup>
          )}
          {productOptions.length === 0 ? null : (
            <OptionGroup label="Productos">
              {productOptions.map((product) => (
                <OptionRow
                  key={product.id}
                  name={product.name}
                  meta={toMilli(product.stockOnHand) <= 0 ? 'Agotado' : formatMoney(product.price)}
                  added={hasPick(value, 'PRODUCT', product.id)}
                  onAdd={() =>
                    onChange(
                      addPick(value, { kind: 'PRODUCT', id: product.id, name: product.name }),
                    )
                  }
                />
              ))}
            </OptionGroup>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col">
      <p className="text-text-faint text-label px-2 pt-1.5 pb-1">{label}</p>
      {children}
    </div>
  );
}

function OptionRow({
  name,
  meta,
  added,
  onAdd,
}: {
  name: string;
  meta: string;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      disabled={added}
      onClick={onAdd}
      className="text-text hover:bg-surface-2 flex min-h-(--touch-min) cursor-pointer items-center justify-between gap-3 rounded-control px-2 text-left disabled:cursor-default disabled:text-text-faint"
    >
      <span className="min-w-0 truncate">{name}</span>
      {added ? (
        <Check
          aria-label="Agregado"
          strokeWidth={1.5}
          className="text-go-text size-icon shrink-0"
        />
      ) : (
        <span className="text-text-faint shrink-0 font-mono text-dense tabular-nums">{meta}</span>
      )}
    </button>
  );
}

/**
 * La tabla Separado / Combo. En precio fijo, un campo por tipo de carro —o uno
 * solo si todos suman igual—; con descuento, el precio calculado.
 */
function PriceTable({
  values,
  bodyTypes,
  sums,
  errors,
  onPrice,
  onAllPrices,
}: {
  values: ComboFormValues;
  bodyTypes: VehicleBodyType[];
  sums: Record<string, number | null>;
  errors: Record<string, { message?: string } | undefined> | undefined;
  onPrice: (bodyTypeId: string, price: string) => void;
  onAllPrices: (price: string) => void;
}) {
  const fixed = values.pricingMode === 'FIXED';
  const firstId = bodyTypes[0]?.id;
  const shared =
    firstId !== undefined &&
    sameSums(sums) &&
    bodyTypes.every((type) => (values.prices[type.id] ?? '') === (values.prices[firstId] ?? ''));
  const rows = shared ? bodyTypes.slice(0, 1) : bodyTypes;
  const percent = parsePercent(values.discountPercent);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((type) => {
        const sum = sums[type.id] ?? null;
        const message = shared
          ? bodyTypes.map((each) => errors?.[each.id]?.message).find(Boolean)
          : errors?.[type.id]?.message;
        const inputId = `combo-price-${type.id}`;

        return (
          <div key={type.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-text text-body font-semibold">
                  {shared ? 'Todos' : type.name}
                </span>
                <span className="text-text-faint is-ruled-out font-mono text-dense tabular-nums">
                  {sum === null ? '—' : formatCents(sum)}
                </span>
              </span>

              {fixed ? (
                <FieldBox className="w-36 shrink-0">
                  <Label htmlFor={inputId}>Combo</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-text-faint">$</span>
                    <Input
                      id={inputId}
                      inputMode="decimal"
                      className="min-w-0 flex-1 font-mono tabular-nums"
                      value={values.prices[type.id] ?? ''}
                      aria-invalid={message !== undefined}
                      onChange={(event) =>
                        shared
                          ? onAllPrices(event.target.value)
                          : onPrice(type.id, event.target.value)
                      }
                    />
                  </div>
                </FieldBox>
              ) : (
                <span className="text-text shrink-0 font-mono text-title font-semibold tabular-nums">
                  {sum === null || percent === null || Number.isNaN(percent)
                    ? '—'
                    : formatCents(percentPriceCents(sum, percent))}
                </span>
              )}
            </div>
            {fixed ? <FieldError message={message} /> : null}
          </div>
        );
      })}
    </div>
  );
}
