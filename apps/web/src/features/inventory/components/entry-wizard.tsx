'use client';

import type { InventoryItem, InventoryItemKind } from '@elite/shared';
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Minus,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/toast-provider';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatCents, formatMoney } from '@/lib/money';
import {
  formatQuantity,
  formatQuantityWithUnit,
  milliToQuantity,
  quantityMilli,
} from '@/lib/quantity';
import { groupItems } from '../delivery';
import {
  ENTRY_STEPS,
  averageAfter,
  backStepOf,
  entriesDraft,
  entryTotalCents,
  kindWord,
  lineCostCents,
  quantityOf,
  stepIndex,
  unitCostOf,
  upsertLine,
  type EntryLine,
  type EntryStep,
} from '../entry-wizard';
import { inventoryErrorView } from '../errors';
import { useCreateInventoryEntries, useInventoryItems } from '../hooks/use-inventory';
import { FieldError, FormAlert, TextField, detailsItemId, keepLocalEscape } from './form-fields';
import { ItemKindStamp } from './movement-type-stamp';

const ICON = 'size-icon';

/** Una página grande alcanza para elegir; con más, se sigue buscando. */
const ITEMS_PAGE_SIZE = 100;

/** Los atajos de cantidad: una caja, una docena, dos. */
const QUICK_ADDS = [6, 12, 24] as const;

/**
 * «Registrar entrada» paso a paso (spec 091): una pregunta por pantalla, con
 * la barra de progreso arriba. Tipo → artículo → cuánto → cuánto te costó →
 * revisar. En «Revisar» se suma otro artículo de la misma factura o se
 * registra todo junto, en una sola petición (RN-2).
 *
 * Desde la ficha de un artículo arranca en la cantidad, con ese artículo.
 */
export function EntryWizard({
  item: initialItem,
  onClose,
}: {
  /** Desde la ficha: el artículo ya elegido. */
  item?: InventoryItem;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const entries = useCreateInventoryEntries();
  const bodyRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<EntryStep>(initialItem ? 'quantity' : 'kind');
  const [kind, setKind] = useState<InventoryItemKind | null>(initialItem?.kind ?? null);
  const [current, setCurrent] = useState<InventoryItem | null>(initialItem ?? null);
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<EntryLine[]>([]);
  // Lo elegido en esta entrada, para dibujar «Revisar» sin volver a pedirlo.
  const [picked, setPicked] = useState<Record<string, InventoryItem>>(
    initialItem ? { [initialItem.id]: initialItem } : {},
  );
  const [reference, setReference] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Cada paso arranca con el foco en su primera pregunta.
  useEffect(() => {
    const target = bodyRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }, [step]);

  function go(next: EntryStep): void {
    setError(null);
    setFormError(null);
    if (next === 'item' || next === 'kind') setTerm('');
    setStep(next);
  }

  function pick(item: InventoryItem): void {
    setPicked((previous) => ({ ...previous, [item.id]: item }));
    setCurrent(item);
    // Un artículo va una sola vez (RN-3): si ya estaba, se edita su línea.
    const existing = lines.find((line) => line.itemId === item.id);
    setQuantity(existing?.quantity ?? '1');
    setUnitCost(existing?.unitCost ?? '');
    setEditing(existing !== undefined);
    go('quantity');
  }

  function edit(line: EntryLine): void {
    const item = picked[line.itemId];
    if (item === undefined) return;
    setCurrent(item);
    setKind(item.kind);
    setQuantity(line.quantity);
    setUnitCost(line.unitCost);
    setEditing(true);
    go('quantity');
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (step === 'quantity') {
      if (quantityOf(quantity) === null) return setError('Escribí cuánto llegó.');
      return go('cost');
    }

    if (step === 'cost') {
      if (unitCostOf(unitCost) === undefined) return setError('Un número, como 0.75.');
      if (current === null) return;
      setLines((previous) => upsertLine(previous, { itemId: current.id, quantity, unitCost }));
      setCurrent(null);
      setEditing(false);
      return go('review');
    }

    if (step === 'review') {
      if (lines.length === 0) return setFormError('Agregá al menos un artículo.');
      setFormError(null);
      entries.mutate(entriesDraft(lines, reference), {
        onSuccess: ({ results }) => {
          const first = results[0];
          toast({
            title: 'Entrada registrada',
            description:
              results.length === 1 && first !== undefined
                ? `+${formatQuantityWithUnit(first.movement.quantity, first.item.unit)} de ${first.item.name}`
                : `${results.length} artículos entraron al inventario`,
          });
          onClose();
        },
        onError: (apiError) => {
          const view = inventoryErrorView(apiError);
          const itemId = detailsItemId(apiError.details);
          const name = itemId === null ? null : picked[itemId]?.name;
          setFormError(name ? `${name}: ${view.message}` : view.message);
        },
      });
    }
  }

  const back = backStepOf(step, editing);
  const primary =
    step === 'quantity' || step === 'cost'
      ? 'Siguiente'
      : step === 'review'
        ? lines.length > 1
          ? `Registrar entrada · ${lines.length}`
          : 'Registrar entrada'
        : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-2xl" onEscapeKeyDown={keepLocalEscape}>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Registrar entrada</DialogTitle>
            <DialogDescription className="sr-only">
              Lo que llegó al taller, de a una pregunta por paso.
            </DialogDescription>
            <StepsBar step={step} />
          </DialogHeader>

          <DialogBody ref={bodyRef} className="space-y-5">
            {step === 'kind' ? (
              <KindStep
                kind={kind}
                onPick={(next) => {
                  setKind(next);
                  go('item');
                }}
              />
            ) : null}

            {step === 'item' && kind !== null ? (
              <ItemStep kind={kind} term={term} onTerm={setTerm} lines={lines} onPick={pick} />
            ) : null}

            {step === 'quantity' && current !== null ? (
              <QuantityStep
                item={current}
                quantity={quantity}
                onQuantity={(next) => {
                  setQuantity(next);
                  setError(null);
                }}
                canChange={!editing}
                onChange={() => go('item')}
                error={error}
              />
            ) : null}

            {step === 'cost' && current !== null ? (
              <CostStep
                item={current}
                quantity={quantity}
                unitCost={unitCost}
                onUnitCost={(next) => {
                  setUnitCost(next);
                  setError(null);
                }}
                error={error}
              />
            ) : null}

            {step === 'review' ? (
              <ReviewStep
                lines={lines}
                picked={picked}
                reference={reference}
                onReference={setReference}
                onEdit={edit}
                onRemove={(itemId) =>
                  setLines((previous) => previous.filter((line) => line.itemId !== itemId))
                }
                onMore={() => {
                  setKind(null);
                  go('kind');
                }}
              />
            ) : null}

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            {back === null ? null : (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  if (back === 'review') {
                    setCurrent(null);
                    setEditing(false);
                  }
                  go(back);
                }}
              >
                <ChevronLeft className={ICON} strokeWidth={1.5} aria-hidden />
                Atrás
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {primary === null ? null : (
              <Button
                type="submit"
                loading={entries.isPending}
                disabled={step === 'review' && lines.length === 0}
              >
                {primary}
                {step === 'review' ? null : (
                  <ChevronRight className={ICON} strokeWidth={1.5} aria-hidden />
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** La barra de progreso: cinco tramos, lleno lo hecho y el paso actual. */
function StepsBar({ step }: { step: EntryStep }) {
  const at = stepIndex(step);

  return (
    <ol
      aria-label={`Paso ${at + 1} de ${ENTRY_STEPS.length}: ${ENTRY_STEPS[at]?.label ?? ''}`}
      className="mt-3 grid grid-cols-5 gap-1.5"
    >
      {ENTRY_STEPS.map((candidate, index) => (
        <li
          key={candidate.key}
          aria-current={index === at ? 'step' : undefined}
          className={cn(
            'flex flex-col gap-1.5 text-label font-semibold',
            index === at ? 'text-text' : index < at ? 'text-text-dim' : 'text-text-faint',
          )}
        >
          <span
            aria-hidden
            className={cn('h-1 rounded-full', index <= at ? 'bg-flame' : 'bg-line')}
          />
          {/* En el teléfono solo se lee el paso actual; los otros son la barra. */}
          <span className={cn(index !== at && 'max-narrow:invisible')}>{candidate.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Question({ children, hint }: { children: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-headline text-text">{children}</h3>
      {hint === undefined ? null : <p className="text-text-dim mt-1 text-body">{hint}</p>}
    </div>
  );
}

/** 1 · ¿Qué vas a ingresar? */
function KindStep({
  kind,
  onPick,
}: {
  kind: InventoryItemKind | null;
  onPick: (kind: InventoryItemKind) => void;
}) {
  const options = [
    {
      value: 'PRODUCT' as const,
      title: 'Producto',
      hint: 'Lo que se vende en el lavado: bebidas, cera, ambientadores…',
      icon: ShoppingBag,
    },
    {
      value: 'SUPPLY' as const,
      title: 'Insumo',
      hint: 'Lo que usa el equipo: franelas, shampoo, químicos…',
      icon: Droplets,
    },
  ];

  return (
    <>
      <Question>¿Qué vas a ingresar?</Question>
      <div className="grid gap-2.5">
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            data-autofocus={index === 0 ? true : undefined}
            aria-pressed={kind === option.value}
            onClick={() => onPick(option.value)}
            className={cn(
              'bg-surface-2 flex min-h-19 cursor-pointer items-center gap-3.5 rounded-row border-(length:--selectable-border) px-4.5 py-3.5 text-left',
              'transition-colors duration-(--duration-state) ease-standard hover:border-flame',
              '[[data-density=bahia]_&]:min-h-22',
              kind === option.value ? 'border-flame' : 'border-line',
            )}
          >
            <span className="border-line bg-surface text-flame-text grid size-11 shrink-0 place-items-center rounded-control border">
              <option.icon className={ICON} strokeWidth={1.5} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-text block text-title">{option.title}</span>
              <span className="text-text-faint block text-dense">{option.hint}</span>
            </span>
            <ChevronRight className={cn(ICON, 'text-text-faint')} strokeWidth={1.5} aria-hidden />
          </button>
        ))}
      </div>
    </>
  );
}

/** 2 · ¿Qué producto llegó? Buscador con el respiro de la app y la lista del tipo. */
function ItemStep({
  kind,
  term,
  onTerm,
  lines,
  onPick,
}: {
  kind: InventoryItemKind;
  term: string;
  onTerm: (term: string) => void;
  lines: readonly EntryLine[];
  onPick: (item: InventoryItem) => void;
}) {
  const search = useDebouncedValue(term.trim());
  const items = useInventoryItems({
    kind,
    search: search === '' ? undefined : search,
    pageSize: ITEMS_PAGE_SIZE,
  });
  const pending = search !== term.trim() || items.isFetching;
  const groups = groupItems(items.data?.items ?? []);
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <Question>{`¿Qué ${kindWord(kind)} llegó?`}</Question>
      <FieldBox>
        <Label htmlFor="entry-search">{`Buscar ${kindWord(kind)}`}</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id="entry-search"
            data-autofocus
            className="min-w-0 flex-1"
            type="search"
            value={term}
            onChange={(event) => onTerm(event.target.value)}
            onKeyDown={(event) => {
              // Enter no manda el asistente: si queda uno solo, lo elige.
              if (event.key === 'Enter') {
                event.preventDefault();
                const only = groups.length === 1 ? groups[0]?.items : undefined;
                if (!pending && only?.length === 1 && only[0] !== undefined) onPick(only[0]);
              }
              if (event.key === 'Escape' && term !== '') {
                event.preventDefault();
                onTerm('');
              }
            }}
            placeholder="Nombre, código INV o código de barras"
            autoComplete="off"
            enterKeyHint="search"
            // Con algo escrito, Escape borra la búsqueda y no cierra el diálogo.
            data-keeps-escape={term !== '' || undefined}
          />
          {term === '' ? null : (
            <button
              type="button"
              onClick={() => onTerm('')}
              aria-label="Borrar búsqueda"
              className="text-text-faint hover:bg-surface-3 hover:text-text grid size-touch shrink-0 cursor-pointer place-items-center rounded-control transition-colors duration-(--duration-state) ease-standard"
            >
              <X aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          )}
        </div>
      </FieldBox>

      {!pending && count === 0 ? (
        <p className="text-text-dim text-body">
          {search === ''
            ? `Todavía no hay ${kindWord(kind, true)} activos. Se crean en Catálogo.`
            : `Nada con «${search}». Probá con otra palabra o con el código INV.`}
        </p>
      ) : (
        <div
          role="listbox"
          aria-label={kindWord(kind, true)}
          className="border-line bg-surface-2 overflow-hidden rounded-row border"
        >
          <p className="bg-surface-3 text-text-faint px-4 py-1.5 text-label">
            {pending
              ? 'Buscando…'
              : `${count} ${count === 1 ? kindWord(kind) : kindWord(kind, true)}`}
          </p>
          {groups.map((group) => (
            <div key={group.key}>
              <p className="border-line-soft text-text-faint border-t px-4 pt-2 pb-1 text-label">
                {group.name}
              </p>
              {group.items.map((item) => {
                const line = lines.find((candidate) => candidate.itemId === item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={line !== undefined}
                    onClick={() => onPick(item)}
                    className="border-line-soft hover:bg-surface-3 flex min-h-touch w-full cursor-pointer items-center gap-3 border-t px-4 py-2.5 text-left transition-colors duration-(--duration-state) ease-standard"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-text block font-semibold [[data-density=bahia]_&]:text-title">
                        {item.name}
                        <span className="text-text-faint ml-1.5 font-mono text-dense font-normal">
                          {item.code}
                        </span>
                      </span>
                      <span className="text-text-faint block text-dense">
                        Hay {formatQuantityWithUnit(item.stockOnHand, item.unit)}
                      </span>
                    </span>
                    {line === undefined ? null : (
                      <span className="tint text-go-text shrink-0 rounded-full border px-2 text-label">
                        Ya en esta entrada · {formatQuantity(line.quantity)}
                      </span>
                    )}
                    <ChevronRight
                      className={cn(ICON, 'text-text-faint shrink-0')}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** El artículo en juego, arriba de la pregunta. */
function ItemCard({ item, onChange }: { item: InventoryItem; onChange?: () => void }) {
  return (
    <div className="border-line bg-surface-2 flex items-center gap-3 rounded-row border px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="text-text block font-semibold">{item.name}</span>
        <span className="text-text-faint flex flex-wrap items-center gap-x-2 gap-y-1 text-dense">
          <ItemKindStamp kind={item.kind} />
          <span className="font-mono">{item.code}</span>
          <span>hay {formatQuantityWithUnit(item.stockOnHand, item.unit)}</span>
        </span>
      </span>
      {onChange === undefined ? null : (
        <Button type="button" variant="ghost" size="sm" onClick={onChange}>
          Cambiar
        </Button>
      )}
    </div>
  );
}

/** 3 · ¿Cuánto llegó? El número grande, con `−` `+` y los atajos de a caja. */
function QuantityStep({
  item,
  quantity,
  onQuantity,
  canChange,
  onChange,
  error,
}: {
  item: InventoryItem;
  quantity: string;
  onQuantity: (quantity: string) => void;
  canChange: boolean;
  onChange: () => void;
  error: string | null;
}) {
  const milli = quantityMilli(quantity);
  const step = (delta: number) =>
    onQuantity(
      formatQuantity(
        milliToQuantity(Math.max(0, (milli === null || milli < 0 ? 0 : milli) + delta * 1000)),
      ),
    );
  const after = quantityOf(quantity);
  const stock = quantityMilli(item.stockOnHand) ?? 0;

  return (
    <>
      <ItemCard item={item} onChange={canChange ? onChange : undefined} />
      <Question hint={`En ${item.unit}.`}>¿Cuánto llegó?</Question>

      <div className="flex items-stretch justify-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-16 w-14 [[data-density=bahia]_&]:min-h-18"
          onClick={() => step(-1)}
          aria-label="Uno menos"
        >
          <Minus className={ICON} strokeWidth={1.5} aria-hidden />
        </Button>
        <input
          id="entry-quantity"
          data-autofocus
          inputMode="decimal"
          autoComplete="off"
          value={quantity}
          onChange={(event) => onQuantity(event.target.value)}
          aria-label={`Cantidad en ${item.unit}`}
          aria-invalid={error ? true : undefined}
          className={cn(
            'bg-surface-2 text-text font-display min-h-16 w-40 rounded-control border px-3 text-center text-figure italic tabular-nums',
            'focus-visible:border-flame [[data-density=bahia]_&]:min-h-18',
            error ? 'border-danger' : 'border-line',
          )}
        />
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-16 w-14 [[data-density=bahia]_&]:min-h-18"
          onClick={() => step(1)}
          aria-label="Uno más"
        >
          <Plus className={ICON} strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <div className="flex justify-center gap-2" role="group" aria-label="Sumar de a varios">
        {QUICK_ADDS.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => step(amount)}
          >
            +{amount}
          </Button>
        ))}
      </div>

      <FieldError message={error ?? undefined} />
      <p className="text-text-dim text-center text-body" aria-live="polite">
        {after === null ? (
          <>Hay {formatQuantityWithUnit(item.stockOnHand, item.unit)} ahora.</>
        ) : (
          <>
            Hay <b className="text-text font-mono">{formatQuantity(item.stockOnHand)}</b> → quedan{' '}
            <b className="text-text font-mono">{formatQuantity(milliToQuantity(stock + after))}</b>{' '}
            {item.unit}
          </>
        )}
      </p>
    </>
  );
}

/** 4 · ¿Cuánto te costó cada unidad? Opcional: sin costo, el promedio no cambia. */
function CostStep({
  item,
  quantity,
  unitCost,
  onUnitCost,
  error,
}: {
  item: InventoryItem;
  quantity: string;
  unitCost: string;
  onUnitCost: (unitCost: string) => void;
  error: string | null;
}) {
  const milli = quantityOf(quantity) ?? 0;
  const cents = unitCostOf(unitCost);

  return (
    <>
      <ItemCard item={item} />
      <Question hint="Lo que le pagaste al proveedor, no el precio de venta. Es opcional: si lo dejás vacío, el costo promedio no cambia.">
        {`¿Cuánto te costó cada ${item.unit}?`}
      </Question>

      <div className="mx-auto flex w-full max-w-64 flex-col gap-1.5">
        <FieldBox>
          <Label htmlFor="entry-cost">{`Te costó por ${item.unit}`}</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-text-faint font-mono">$</span>
            <Input
              id="entry-cost"
              data-autofocus
              className="min-w-0 flex-1 font-mono"
              inputMode="decimal"
              autoComplete="off"
              value={unitCost}
              onChange={(event) => onUnitCost(event.target.value)}
              placeholder="0.00"
              aria-invalid={error ? true : undefined}
            />
          </div>
        </FieldBox>
        <FieldError message={error ?? undefined} />
      </div>

      <p className="text-text-dim text-center text-body" aria-live="polite">
        {typeof cents === 'number' ? (
          <>
            {formatQuantity(milliToQuantity(milli))} × {formatCents(cents)} ={' '}
            <b className="text-text font-mono">{formatCents(Math.round((milli * cents) / 1000))}</b>
            {' · '}tu costo promedio {formatMoney(item.averageCost)} →{' '}
            <b className="text-text font-mono">
              {formatCents(averageAfter(item.stockOnHand, item.averageCost, milli, cents))}
            </b>
          </>
        ) : (
          <>
            Hoy te cuesta en promedio{' '}
            <b className="text-text font-mono">{formatMoney(item.averageCost)}</b> por {item.unit}.
          </>
        )}
      </p>
    </>
  );
}

/** 5 · Revisar: lo que entra, la factura y el botón que lo registra todo. */
function ReviewStep({
  lines,
  picked,
  reference,
  onReference,
  onEdit,
  onRemove,
  onMore,
}: {
  lines: readonly EntryLine[];
  picked: Readonly<Record<string, InventoryItem>>;
  reference: string;
  onReference: (reference: string) => void;
  onEdit: (line: EntryLine) => void;
  onRemove: (itemId: string) => void;
  onMore: () => void;
}) {
  const withCost = lines.filter((line) => lineCostCents(line) !== null).length;

  return (
    <>
      <Question>Revisá la entrada</Question>

      {lines.length === 0 ? (
        <p className="text-text-dim text-body">
          No queda nada en esta entrada. Agregá un artículo.
        </p>
      ) : (
        <ul className="grid gap-2">
          {lines.map((line) => {
            const item = picked[line.itemId];
            if (item === undefined) return null;
            const cents = unitCostOf(line.unitCost);
            const cost = lineCostCents(line);
            const milli = quantityOf(line.quantity) ?? 0;
            const stock = quantityMilli(item.stockOnHand) ?? 0;

            return (
              <li
                key={line.itemId}
                className="border-line bg-surface-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-row border py-2.5 pr-2.5 pl-4"
              >
                <span className="min-w-48 flex-1">
                  <span className="text-text block font-semibold">{item.name}</span>
                  <span className="text-text-faint block text-dense">
                    +{formatQuantityWithUnit(line.quantity, item.unit)} ·{' '}
                    {typeof cents === 'number' ? `te costó ${formatCents(cents)} c/u` : 'sin costo'}{' '}
                    · queda en {formatQuantity(milliToQuantity(stock + milli))}
                  </span>
                </span>
                {cost === null ? null : (
                  <span className="text-text font-mono font-bold tabular-nums">
                    {formatCents(cost)}
                  </span>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(line)}>
                  <Pencil className={ICON} strokeWidth={1.5} aria-hidden />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(line.itemId)}
                  aria-label={`Quitar ${item.name}`}
                >
                  <X className={ICON} strokeWidth={1.5} aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={onMore}
        data-autofocus={lines.length === 0 || undefined}
      >
        <Plus className={ICON} strokeWidth={1.5} aria-hidden />
        Agregar otro artículo
      </Button>

      <TextField
        id="entry-reference"
        label="Referencia (opcional)"
        placeholder="Factura, proveedor"
        value={reference}
        onChange={(event) => onReference(event.target.value)}
      />

      {lines.length === 0 ? null : (
        <div className="border-line-soft bg-surface-2 flex items-start gap-3 rounded-control border px-4 py-3">
          <ArrowDownToLine
            className={cn(ICON, 'text-text-faint mt-0.5 shrink-0')}
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-text-dim text-body">
            <b className="text-text">
              {lines.length} {lines.length === 1 ? 'artículo entra' : 'artículos entran'}
            </b>{' '}
            al inventario.
            {withCost > 0 ? (
              <>
                {' '}
                Total con costo:{' '}
                <b className="text-text font-mono">{formatCents(entryTotalCents(lines))}</b>.
              </>
            ) : null}
          </p>
        </div>
      )}
    </>
  );
}
