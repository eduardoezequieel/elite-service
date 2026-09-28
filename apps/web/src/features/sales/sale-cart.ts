/**
 * La aritmética de la venta suelta (065 RN-18 a RN-21), sin React.
 *
 * El borrador vive solo en pantalla hasta cobrar: la venta nace cobrada y no se
 * guarda nada antes (RN-18). Esto es lo que se puede probar sin montar la
 * pantalla: cuánto suma, cuánto se puede agregar, cuándo pide firma y qué
 * cuerpo se manda al API.
 *
 * Dos unidades enteras, nunca un `number` decimal:
 * - dinero en **centavos** (`"3.00"` → `300`), igual que la cuenta de la 059;
 * - cantidades en **milésimas** (`"2.500"` → `2500`), porque el inventario
 *   lleva tres decimales (RN-16) y un litro y medio no es `1.4999…`.
 *
 * El pago (método, pago partido, efectivo y vuelto) no se repite acá: sale de
 * `features/carwash/charge-math.ts`, que es la misma regla que aplica el API.
 */

import type {
  AuthorizationInput,
  ChargeProductInput,
  CreateChargeInput,
  InventoryItemOption,
  PaymentMethod,
  PriceAuthorizationInput,
} from '@elite/shared';

import { centsToAmount, parseCents } from '@/lib/money';
import { formatQuantity, milliToQuantity } from '@/lib/quantity';

import { chargeBlocker, type PaymentLine } from '../carwash/charge-math';
import { paymentDetailsInput, type PaymentDetailsDraft } from '../carwash/payment-details';

/** Una unidad entera, en milésimas. Lo que suma o resta el `− +`. */
export const ONE_UNIT = 1000;

/** Tope de la columna `Decimal(12, 3)`: `99999.999` (shared `MAX_QUANTITY`). */
export const MAX_QUANTITY_MILLI = 99_999_999;

/** Una línea del borrador: el producto como estaba al agregarlo y lo que se lleva. */
export interface CartLine {
  itemId: string;
  name: string;
  unit: string;
  /** Precio del artículo, cadena decimal. Techo del precio unitario (RN-21). */
  catalogPrice: string;
  /** Precio que se cobra, cadena decimal. Igual al catálogo salvo firma (060). */
  unitPrice: string;
  /** Cantidad en milésimas, > 0. */
  quantity: number;
  /** Existencia conocida en milésimas: lo que dice «Hay N». */
  stock: number;
}

// ---------------------------------------------------------------------------
// Cantidades
// ---------------------------------------------------------------------------

/**
 * Milésimas de una cantidad en cadena (`"2.5"` → `2500`). Lo ilegible es cero:
 * un campo en blanco no agrega nada.
 */
export function toMilli(value: string): number {
  const match = /^\s*(\d*)(?:[.,](\d{0,3})\d*)?\s*$/.exec(value);

  if (match === null) return 0;

  const [, whole = '', fraction = ''] = match;

  if (whole === '' && fraction === '') return 0;

  return Number(whole || '0') * ONE_UNIT + Number(fraction.padEnd(3, '0'));
}

/**
 * Lo que se deja teclear en el campo de cantidad: dígitos y un separador, con
 * tres decimales como mucho. La coma de la tablet se guarda como punto.
 */
export function maskQuantityInput(raw: string): string {
  const clean = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = clean.split('.');
  const head = whole.slice(0, 5);

  if (rest.length === 0) return head;

  return `${head}.${rest.join('').slice(0, 3)}`;
}

// ---------------------------------------------------------------------------
// Líneas y total
// ---------------------------------------------------------------------------

/**
 * El total de una línea en centavos: `unitPrice × quantity`, redondeado al
 * centavo con la mitad hacia arriba, como `Decimal` en el API.
 */
export function lineTotalCents(line: Pick<CartLine, 'unitPrice' | 'quantity'>): number {
  return Math.round((parseCents(line.unitPrice) * line.quantity) / ONE_UNIT);
}

/** El total del borrador: la suma de sus líneas. */
export function cartTotalCents(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

/** `2 × $3.00 = $6.00`: la línea como se lee en todas partes (065). */
export function formulaLabel(line: Pick<CartLine, 'unitPrice' | 'quantity'>): string {
  return `${formatQuantity(milliToQuantity(line.quantity))} × $${centsToAmount(parseCents(line.unitPrice))} = $${centsToAmount(
    lineTotalCents(line),
  )}`;
}

/** Cuántas milésimas quedan por agregar antes de agotar lo que hay. */
export function roomLeft(line: Pick<CartLine, 'quantity' | 'stock'>): number {
  return Math.max(0, line.stock - line.quantity);
}

/** `true` si el `+` suma una unidad entera sin pasarse de lo que hay. */
export function canAddOne(line: Pick<CartLine, 'quantity' | 'stock'>): boolean {
  return line.quantity + ONE_UNIT <= line.stock;
}

/** La línea pide más de lo que hay: tras un `409 INSUFFICIENT_STOCK` o una baja ajena. */
export function isOverStock(line: Pick<CartLine, 'quantity' | 'stock'>): boolean {
  return line.quantity > line.stock;
}

/** Lo que el `+` le suma a un producto que todavía no está: una unidad, o lo que haya. */
function firstQuantity(stock: number): number {
  return Math.min(ONE_UNIT, stock);
}

/** Una línea nueva a partir de la opción del buscador, al precio del catálogo. */
export function lineFromOption(option: InventoryItemOption): CartLine {
  const stock = toMilli(option.stockOnHand);

  return {
    itemId: option.id,
    name: option.name,
    unit: option.unit,
    catalogPrice: option.price,
    unitPrice: option.price,
    quantity: firstQuantity(stock),
    stock,
  };
}

/**
 * El `− +` de un producto. Sumar nunca pasa de lo que hay —«sin existencia no
 * se agrega» (065)—, restar hasta cero quita la línea. Un producto sin
 * existencia no entra.
 */
export function stepCart(
  lines: readonly CartLine[],
  option: InventoryItemOption,
  delta: 1 | -1,
): CartLine[] {
  const current = lines.find((line) => line.itemId === option.id);

  if (current === undefined) {
    if (delta < 0) return [...lines];

    const fresh = lineFromOption(option);

    return fresh.quantity <= 0 ? [...lines] : [...lines, fresh];
  }

  return setQuantity(lines, option.id, current.quantity + delta * ONE_UNIT);
}

/**
 * Fija la cantidad de una línea, en milésimas. Se recorta a lo que hay y al
 * tope de la columna; cero o menos quita la línea.
 */
export function setQuantity(lines: readonly CartLine[], itemId: string, milli: number): CartLine[] {
  const next: CartLine[] = [];

  for (const line of lines) {
    if (line.itemId !== itemId) {
      next.push({ ...line });
      continue;
    }

    const clamped = Math.min(Math.trunc(milli), line.stock, MAX_QUANTITY_MILLI);

    if (clamped > 0) next.push({ ...line, quantity: clamped });
  }

  return next;
}

/** Quita la línea entera. */
export function removeLine(lines: readonly CartLine[], itemId: string): CartLine[] {
  return lines.filter((line) => line.itemId !== itemId).map((line) => ({ ...line }));
}

/**
 * Pone al día la existencia de las líneas con lo último que trajo el buscador:
 * mientras se arma la venta, la pantalla muestra «Hay N» al día (RN-18). No
 * toca la cantidad: si ahora hay menos, la línea queda pasada y lo dice.
 */
export function syncStock(
  lines: readonly CartLine[],
  options: readonly InventoryItemOption[],
): CartLine[] {
  let changed = false;
  const next = lines.map((line) => {
    const option = options.find((candidate) => candidate.id === line.itemId);

    if (option === undefined) return line;

    const stock = toMilli(option.stockOnHand);

    if (stock === line.stock) return line;

    changed = true;

    return { ...line, stock };
  });

  return changed ? next : [...lines];
}

/** Cambia el precio de una línea. Nunca arriba del catálogo ni bajo cero (RN-21). */
export function setUnitPrice(
  lines: readonly CartLine[],
  itemId: string,
  price: string,
): CartLine[] {
  return lines.map((line) => {
    if (line.itemId !== itemId) return { ...line };

    const cents = Math.min(Math.max(parseCents(price), 0), parseCents(line.catalogPrice));

    return { ...line, unitPrice: centsToAmount(cents) };
  });
}

/** La línea se cobra por debajo del precio del artículo. */
export function isDiscounted(line: Pick<CartLine, 'unitPrice' | 'catalogPrice'>): boolean {
  return parseCents(line.unitPrice) < parseCents(line.catalogPrice);
}

/** Alguna línea baja del catálogo: la venta lleva la firma de la 060 (RN-21). */
export function needsPriceAuthorization(lines: readonly CartLine[]): boolean {
  return lines.some(isDiscounted);
}

// ---------------------------------------------------------------------------
// Validación y cuerpo del POST
// ---------------------------------------------------------------------------

/** La firma está completa: motivo de al menos 3 letras y credenciales tecleadas. */
export function isPriceAuthorizationFilled(value: PriceAuthorizationInput | null): boolean {
  if (value === null) return false;

  return value.reason.trim().length >= 3 && isCredentialFilled(value.authorization);
}

/** Correo y contraseña con algo adentro. Si además sirven, lo decide el API. */
export function isCredentialFilled(value: AuthorizationInput): boolean {
  return value.email.trim() !== '' && value.password !== '';
}

/** Motivo y credenciales del «Anular venta» (045, RN-22). */
export function isVoidReady(reason: string, authorization: AuthorizationInput): boolean {
  return reason.trim().length >= 3 && isCredentialFilled(authorization);
}

/**
 * Lo que los productos sueltos todavía no dejan cobrar, en cualquier pantalla
 * que los lleve (065, 066): una línea que pide más de lo que hay o un precio
 * rebajado sin firma. `null` cuando por los productos se puede.
 */
export function productsBlocker(
  lines: readonly CartLine[],
  priceAuthorization: PriceAuthorizationInput | null,
): string | null {
  const over = lines.find(isOverStock);

  if (over !== undefined)
    return `Hay ${formatQuantity(milliToQuantity(over.stock))} de ${over.name}`;

  if (needsPriceAuthorization(lines) && !isPriceAuthorizationFilled(priceAuthorization)) {
    return 'Falta autorizar el precio';
  }

  return null;
}

/**
 * Por qué no se puede cobrar todavía, con el texto que va en el botón. `null`
 * cuando se puede. El orden es el de la pantalla: turno, productos,
 * existencia, firma y después el pago de la 059. `ticketsCents` son los
 * lavados listos sumados a la venta (066): cuentan para el total.
 */
export function saleBlocker(input: {
  cashClosed: boolean;
  lines: readonly CartLine[];
  priceAuthorization: PriceAuthorizationInput | null;
  split: boolean;
  payments: readonly PaymentLine[];
  tendered: string;
  cashDue: number;
  ticketsCents?: number;
  /** El método y los datos del pago único, y las cuentas activas (069). */
  method?: PaymentMethod;
  details?: PaymentDetailsDraft;
  bankAccountIds?: readonly string[];
}): string | null {
  if (input.cashClosed) return 'Sin turno abierto';
  if (input.lines.length === 0) return 'Agregá un producto';

  const products = productsBlocker(input.lines, input.priceAuthorization);

  if (products !== null) return products;

  return chargeBlocker({
    totalCents: (input.ticketsCents ?? 0) + cartTotalCents(input.lines),
    split: input.split,
    lines: input.payments,
    tendered: input.tendered,
    cashDue: input.cashDue,
    method: input.method,
    details: input.details,
    bankAccountIds: input.bankAccountIds,
  });
}

/**
 * Los productos sueltos como los espera el API (066). `unitPrice` viaja solo
 * si baja del catálogo: ausente es «el precio del artículo», y así el API no
 * ve una rebaja donde no la hubo.
 */
export function chargeProductsOf(lines: readonly CartLine[]): ChargeProductInput[] {
  return lines.map((line) => ({
    inventoryItemId: line.itemId,
    quantity: milliToQuantity(line.quantity),
    ...(isDiscounted(line) ? { unitPrice: centsToAmount(parseCents(line.unitPrice)) } : {}),
  }));
}

/**
 * El cuerpo de `POST /carwash/charges` (059, 066): los lavados, los productos
 * sueltos y el pago, sea desde el cobro del lavado o desde «Nueva venta». La
 * firma del precio va solo si algún producto bajó; el nombre libre, solo si
 * hay productos a los que ponérselo.
 */
export function buildChargeInput(input: {
  workOrderIds: readonly string[];
  lines: readonly CartLine[];
  customerName: string;
  split: boolean;
  method: PaymentMethod;
  /** Los datos del pago único según su método (069). */
  details?: PaymentDetailsDraft;
  payments: readonly PaymentLine[];
  tendered: string;
  cashDue: number;
  /** El total de la cuenta: lavados más productos. */
  totalCents: number;
  priceAuthorization: PriceAuthorizationInput | null;
}): CreateChargeInput {
  const customerName = input.customerName.trim();
  const received = parseCents(input.tendered);
  const authorization = input.priceAuthorization;
  const hasProducts = input.lines.length > 0;

  return {
    workOrderIds: [...input.workOrderIds],
    ...(hasProducts ? { products: chargeProductsOf(input.lines) } : {}),
    ...(hasProducts && customerName !== '' ? { customerName } : {}),
    payments: input.split
      ? input.payments.map((line) => ({
          method: line.method,
          amount: centsToAmount(parseCents(line.amount)),
          ...paymentDetailsInput(line.method, line),
        }))
      : [
          {
            method: input.method,
            amount: centsToAmount(input.totalCents),
            ...paymentDetailsInput(input.method, input.details ?? {}),
          },
        ],
    ...(input.cashDue > 0 && input.tendered.trim() !== '' && received > 0
      ? { cashTendered: centsToAmount(received) }
      : {}),
    ...(needsPriceAuthorization(input.lines) && authorization !== null
      ? {
          priceAuthorization: {
            reason: authorization.reason.trim(),
            authorization: {
              email: authorization.authorization.email.trim(),
              password: authorization.authorization.password,
            },
          },
        }
      : {}),
  };
}

/**
 * Lee el `409 INSUFFICIENT_STOCK` del API: `details: { itemId, available }`
 * con `available` en cadena de tres decimales. `null` si no es ese error o
 * viene con otra forma.
 */
export function insufficientStockOf(
  code: string,
  details: unknown,
): { itemId: string; available: number } | null {
  if (code !== 'INSUFFICIENT_STOCK') return null;
  if (typeof details !== 'object' || details === null) return null;

  const { itemId, available } = details as Record<string, unknown>;

  if (typeof itemId !== 'string') return null;
  if (typeof available !== 'string' && typeof available !== 'number') return null;

  return {
    itemId,
    available:
      typeof available === 'number' ? Math.round(available * ONE_UNIT) : toMilli(available),
  };
}

/** Anota en la línea lo que el API dijo que hay, para que muestre «Hay N». */
export function applyStockConflict(
  lines: readonly CartLine[],
  conflict: { itemId: string; available: number },
): CartLine[] {
  return lines.map((line) =>
    line.itemId === conflict.itemId ? { ...line, stock: conflict.available } : { ...line },
  );
}
