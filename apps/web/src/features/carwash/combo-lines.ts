import type {
  ComboOption,
  ComboPriceRow,
  ProductTicketItemInput,
  TicketItem,
  UpdateTicketInput,
} from '@elite/shared';

import { centsToAmount, parseCents } from '@/lib/money';
import { componentsLabel, outOfStockLabel } from '@/features/combos/combo-format';
import { isProductLine, itemLabel } from './product-lines';

/**
 * Los combos dentro del lavado (104), sin React: el precio de un combo para el
 * tipo de carro, las tarjetas del alta y de la edición, cómo se agrupan sus
 * líneas al leer un lavado y el cuerpo de la edición.
 *
 * El API expande cada combo en una línea por servicio y producto, con
 * `comboId` y `comboName`. Esas líneas **no** viajan en `items`: van en
 * `combos` y el API las vuelve a armar.
 */

// ---------------------------------------------------------------------------
// Precio y tarjetas
// ---------------------------------------------------------------------------

/**
 * El precio del combo para el tipo de carro elegido. Sin tipo, el precio solo
 * si es el mismo para todos; si no, `null` (se dibuja un guion).
 */
export function comboPriceFor(prices: readonly ComboPriceRow[], bodyTypeId: string): string | null {
  if (bodyTypeId !== '') {
    return prices.find((row) => row.bodyTypeId === bodyTypeId)?.price ?? null;
  }

  const first = prices[0];
  if (first === undefined) return null;

  return prices.every((row) => parseCents(row.price) === parseCents(first.price))
    ? first.price
    : null;
}

/** Una tarjeta de combo en el alta o en la edición. */
export interface ComboChoice {
  id: string;
  name: string;
  /** Lo que trae, en una línea. */
  detail: string;
  /** El precio para el tipo de carro, o `null` si todavía no se sabe. */
  price: string | null;
  /** «Sin cera»: deshabilitada. `null` si alcanza todo. */
  missing: string | null;
}

/** Las tarjetas del alta: los combos de hoy con el precio del tipo de carro. */
export function intakeComboChoices(
  options: readonly ComboOption[],
  bodyTypeId: string,
): ComboChoice[] {
  return options.map((option) => ({
    id: option.id,
    name: option.name,
    detail: componentsLabel(option.items),
    price: comboPriceFor(option.prices, bodyTypeId),
    missing: outOfStockLabel(option.outOfStock),
  }));
}

/**
 * Los combos elegidos que de verdad viajan: los que siguen entre los de hoy y
 * no se quedaron sin existencia. Si uno se pausó mientras se llenaba el alta,
 * se suelta solo en vez de terminar en `422 COMBO_NOT_AVAILABLE`.
 */
export function pickedCombos(
  options: readonly ComboOption[],
  picked: readonly string[],
): ComboOption[] {
  return options.filter((option) => picked.includes(option.id) && option.outOfStock.length === 0);
}

/** Elegir o soltar un combo: va una sola vez (RN-6). */
export function toggleCombo(picked: readonly string[], comboId: string): string[] {
  return picked.includes(comboId) ? picked.filter((id) => id !== comboId) : [...picked, comboId];
}

// ---------------------------------------------------------------------------
// Leer un lavado
// ---------------------------------------------------------------------------

/** Un combo del lavado con sus líneas y lo que suman. */
export interface TicketComboGroup {
  comboId: string;
  name: string;
  /** Lo que suman sus líneas, como monto (`"14.00"`). */
  total: string;
  items: TicketItem[];
}

/**
 * Las líneas de un lavado como se leen: los combos (cada uno con sus líneas,
 * en el orden en que aparecen), los servicios sueltos y los productos sueltos.
 */
export function groupTicketLines(items: readonly TicketItem[]): {
  combos: TicketComboGroup[];
  services: TicketItem[];
  products: TicketItem[];
} {
  const groups = new Map<string, { name: string; cents: number; items: TicketItem[] }>();
  const services: TicketItem[] = [];
  const products: TicketItem[] = [];

  for (const item of items) {
    if (item.comboId === null) {
      (isProductLine(item) ? products : services).push(item);
      continue;
    }

    const group = groups.get(item.comboId);
    if (group === undefined) {
      groups.set(item.comboId, {
        name: item.comboName ?? 'Combo',
        cents: parseCents(item.total),
        items: [item],
      });
    } else {
      group.cents += parseCents(item.total);
      group.items.push(item);
    }
  }

  return {
    combos: [...groups.entries()].map(([comboId, group]) => ({
      comboId,
      name: group.name,
      total: centsToAmount(group.cents),
      items: group.items,
    })),
    services,
    products,
  };
}

/**
 * Lo que lleva un lavado en una fila (lista, tablero, pista, cobro): cada combo
 * nombrado una vez, en su lugar, y cada línea suelta con su `×2`.
 */
export function ticketItemLabels(
  items: readonly Pick<TicketItem, 'kind' | 'name' | 'quantity' | 'comboId' | 'comboName'>[],
): string[] {
  const labels: string[] = [];
  const named = new Set<string>();

  for (const item of items) {
    if (item.comboId === null) {
      labels.push(itemLabel(item));
    } else if (!named.has(item.comboId)) {
      named.add(item.comboId);
      labels.push(item.comboName ?? 'Combo');
    }
  }

  return labels;
}

/** Los combos que ya tiene el lavado, sin repetir y en orden. */
export function ticketComboIds(items: readonly Pick<TicketItem, 'comboId'>[]): string[] {
  return [...new Set(items.flatMap((item) => (item.comboId === null ? [] : [item.comboId])))];
}

/** Las líneas sueltas: las únicas que viajan en `items` al editar. */
export function standaloneItems<Item extends Pick<TicketItem, 'comboId'>>(
  items: readonly Item[],
): Item[] {
  return items.filter((item) => item.comboId === null);
}

// ---------------------------------------------------------------------------
// La edición
// ---------------------------------------------------------------------------

/**
 * Las tarjetas de la edición: primero los combos que ya tiene el lavado
 * —con el precio guardado mientras no cambie el tipo de carro (criterio 8)—
 * y después los de hoy que se pueden sumar. Un combo que ya estaba no se
 * deshabilita por existencia: lo suyo ya salió del inventario.
 */
export function editComboChoices(input: {
  items: readonly TicketItem[];
  options: readonly ComboOption[];
  bodyTypeId: string;
  /** El tipo de carro que tiene el lavado guardado. */
  savedBodyTypeId: string;
}): ComboChoice[] {
  const { combos } = groupTicketLines(input.items);
  const optionOf = new Map(input.options.map((option) => [option.id, option]));
  const sameBody = input.bodyTypeId === input.savedBodyTypeId;

  const saved = combos.map((group): ComboChoice => {
    const option = optionOf.get(group.comboId);

    return {
      id: group.comboId,
      name: group.name,
      detail: componentsLabel(
        group.items.map((item) => ({
          name: item.name,
          quantity: isProductLine(item) ? Number.parseFloat(item.quantity) : 1,
        })),
      ),
      price: sameBody
        ? group.total
        : option === undefined
          ? null
          : comboPriceFor(option.prices, input.bodyTypeId),
      missing: null,
    };
  });
  const savedIds = new Set(saved.map((choice) => choice.id));
  const fresh = intakeComboChoices(
    input.options.filter((option) => !savedIds.has(option.id)),
    input.bodyTypeId,
  );

  return [...saved, ...fresh];
}

/** Lo que manda siempre el diálogo de edición. */
export type EditTicketPayload = Required<
  Pick<UpdateTicketInput, 'bodyTypeId' | 'items' | 'combos' | 'notes'>
>;

/**
 * El cuerpo de `PATCH /carwash/tickets/:id` desde el diálogo de edición:
 * `items` lleva solo lo suelto y `combos` la lista entera de combos que debe
 * quedar —los que no vengan se quitan—. Cambiar el tipo de carro manda el tipo
 * nuevo y el API vuelve a expandir los combos.
 */
export function editTicketPayload(input: {
  bodyTypeId: string;
  services: readonly { id: string; price: string }[];
  products: readonly ProductTicketItemInput[];
  combos: readonly string[];
  notes: string;
}): EditTicketPayload {
  return {
    bodyTypeId: input.bodyTypeId,
    items: [
      ...input.services.map((line) => ({ serviceId: line.id, unitPrice: line.price })),
      ...input.products,
    ],
    combos: [...new Set(input.combos)].map((comboId) => ({ comboId })),
    notes: input.notes,
  };
}
