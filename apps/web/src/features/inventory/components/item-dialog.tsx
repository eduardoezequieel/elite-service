'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  INVENTORY_UNIT_SUGGESTIONS,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  type InventoryItem,
  type InventoryItemKind,
} from '@elite/shared';
import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  EMPTY_ITEM_FORM,
  createItemDraft,
  itemFormValuesOf,
  updateItemDraft,
  type ItemFormValues,
} from '../item-form';
import {
  useCreateInventoryItem,
  useInventoryCategories,
  useUpdateInventoryItem,
} from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FieldError, FormAlert, TextField } from './form-fields';
import { ItemKindStamp } from './movement-type-stamp';

const createFormSchema = z.preprocess(
  (values: ItemFormValues) => createItemDraft(values),
  createInventoryItemSchema,
);

const updateFormSchema = z.preprocess(
  (values: ItemFormValues) => updateItemDraft(values),
  updateInventoryItemSchema,
);

const KINDS: readonly { value: InventoryItemKind; label: string; hint: string }[] = [
  { value: 'PRODUCT', label: 'Producto', hint: 'Se vende en el lavado' },
  { value: 'SUPPLY', label: 'Insumo', hint: 'Se despacha al equipo' },
];

const NO_CATEGORY = '';

const ITEM_FIELDS = ['name', 'categoryId', 'unit', 'price', 'minStock', 'barcode'] as const;

const UNIT_OPTIONS: readonly ComboboxOption[] = INVENTORY_UNIT_SUGGESTIONS.map((unit) => ({
  value: unit,
  label: unit,
}));

/**
 * Nuevo / Editar artículo (065). El tipo va arriba y se elige solo al crear
 * (RN-1): un insumo no muestra precio. La unidad es texto libre; las
 * sugerencias son atajos, no un catálogo (RN-16).
 */
export function ItemDialog({
  item,
  initialKind = 'PRODUCT',
  onClose,
  onCreated,
}: {
  /** El artículo que se edita. Ausente en el alta. */
  item?: InventoryItem;
  /** Con qué tipo abre el alta: la pestaña en la que estaba la lista. */
  initialKind?: InventoryItemKind;
  onClose: () => void;
  onCreated?: (item: InventoryItem) => void;
}) {
  const isNew = item === undefined;
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem();
  const categories = useInventoryCategories();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ItemFormValues, unknown, z.output<typeof updateFormSchema>>({
    resolver: zodResolver(updateFormSchema),
    defaultValues: isNew ? { ...EMPTY_ITEM_FORM, kind: initialKind } : itemFormValuesOf(item),
  });
  const createForm = useForm<ItemFormValues, unknown, z.output<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { ...EMPTY_ITEM_FORM, kind: initialKind },
  });
  // Un solo formulario visible; el de alta y el de edición validan contra su
  // propio schema del contrato.
  const active = isNew ? createForm : form;
  const kind = active.watch('kind');

  const categoryOptions = [
    { value: NO_CATEGORY, label: 'Sin categoría' },
    ...(categories.data ?? [])
      .filter((category) => category.isActive || category.id === item?.category?.id)
      .map((category) => ({ value: category.id, label: category.name })),
  ];

  function onApiError(error: Parameters<typeof applyInventoryError>[0]): void {
    setFormError(applyInventoryError(error, active.setError, ITEM_FIELDS));
  }

  const submitCreate = createForm.handleSubmit((input) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (saved) => {
        toast({ title: 'Artículo creado', description: `${saved.code} · ${saved.name}` });
        onCreated?.(saved);
        onClose();
      },
      onError: onApiError,
    });
  });

  const submitUpdate = form.handleSubmit((input) => {
    if (item === undefined) return;
    setFormError(null);
    update.mutate(
      { id: item.id, input },
      {
        onSuccess: (saved) => {
          toast({ title: 'Artículo guardado', description: saved.name });
          onClose();
        },
        onError: onApiError,
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={isNew ? submitCreate : submitUpdate}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nuevo artículo' : 'Editar artículo'}</DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Nace con existencia 0. La primera cantidad entra con «Registrar entrada».'
                : `${item.code} · el tipo no cambia después del alta.`}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {isNew ? (
              <div
                role="radiogroup"
                aria-label="Tipo de artículo"
                className="grid grid-cols-2 gap-2"
              >
                {KINDS.map((option) => {
                  const selected = kind === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => createForm.setValue('kind', option.value)}
                      className={cn(
                        'border-line bg-surface-2 flex min-h-(--touch-min) flex-col items-start gap-0.5 rounded-control border px-4 py-2.5 text-left transition-colors duration-(--duration-state) ease-standard',
                        '[[data-density=bahia]_&]:py-3.5',
                        selected ? 'border-flame' : 'hover:border-flame',
                      )}
                    >
                      <span className={cn('text-body', selected ? 'font-bold' : 'font-semibold')}>
                        {option.label}
                      </span>
                      <span className="text-text-faint text-dense">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-text-faint text-label">Tipo</span>
                <ItemKindStamp kind={item.kind} />
              </div>
            )}

            <ItemFields
              form={active}
              categoryOptions={categoryOptions}
              categoriesPending={categories.isPending}
            />

            {isNew ? null : (
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                    <label htmlFor="item-active" className="text-body font-semibold">
                      Activo
                      <span className="text-text-faint block text-dense font-normal">
                        Inactivo no se vende ni se despacha; su kardex queda.
                      </span>
                    </label>
                    <Switch
                      id="item-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            )}

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {isNew ? 'Crear artículo' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Los campos comunes al alta y a la edición. Genérico en la salida del schema:
 * cada formulario valida contra el suyo del contrato.
 */
function ItemFields<Output>({
  form,
  categoryOptions,
  categoriesPending,
}: {
  form: UseFormReturn<ItemFormValues, unknown, Output>;
  categoryOptions: readonly ComboboxOption[];
  categoriesPending: boolean;
}) {
  const errors = form.formState.errors;
  const kind = form.watch('kind');

  return (
    <>
      <TextField
        id="item-name"
        label="Nombre"
        placeholder={kind === 'PRODUCT' ? 'Cera en pasta' : 'Franela de microfibra'}
        error={errors.name?.message}
        {...form.register('name')}
      />

      <div className="flex flex-col gap-1.5">
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <Combobox
              label="Categoría"
              options={categoryOptions}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              invalid={errors.categoryId !== undefined}
              emptyText={categoriesPending ? 'Cargando…' : 'Sin categorías'}
            />
          )}
        />
        <FieldError message={errors.categoryId?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Controller
          control={form.control}
          name="unit"
          render={({ field }) => (
            <Combobox
              mode="search"
              id="item-unit"
              label="Unidad"
              placeholder="unidad, litro, caja…"
              options={UNIT_OPTIONS}
              value={field.value}
              query={field.value}
              // La unidad es texto libre (RN-16): lo que se escribe es el valor,
              // y la lista solo sugiere.
              onQueryChange={(query) => field.onChange(query)}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              invalid={errors.unit !== undefined}
              emptyText="Se guarda tal como la escribiste"
            />
          )}
        />
        <FieldError message={errors.unit?.message} />
      </div>

      <div className={cn('grid gap-4', kind === 'PRODUCT' && 'sm:grid-cols-2')}>
        {kind === 'PRODUCT' ? (
          <TextField
            id="item-price"
            label="Precio de venta (IVA incl.)"
            inputMode="decimal"
            placeholder="0.00"
            mono
            error={errors.price?.message}
            {...form.register('price')}
          />
        ) : null}
        <TextField
          id="item-min"
          label="Mínimo (0 = sin aviso)"
          inputMode="decimal"
          mono
          error={errors.minStock?.message}
          {...form.register('minStock')}
        />
      </div>

      <TextField
        id="item-barcode"
        label="Código de barras (opcional)"
        mono
        error={errors.barcode?.message}
        {...form.register('barcode')}
      />
    </>
  );
}
