import {
  API_ERROR_CODES,
  createOfficeTicketSchema,
  createVehicleSchema,
  type Customer,
  type TicketComboInput,
  type TicketItemInput,
  type VehicleWithOwner,
} from '@elite/shared';
import { z } from 'zod';

import { ApiError } from '@/lib/api';
import { centsToAmount, parseCents } from '@/lib/money';
import { EMPTY_CUSTOMER, draftFromCustomer, type CustomerDraft } from './customer-draft';
import { discountCents } from './pricing';
import {
  lineQuantityLabel,
  lineTotalCents,
  productItemsPayload,
  productsTotalCents,
  type ProductPick,
} from './product-lines';
import { EMPTY_SELECTION, type SelectedLine, type ServiceSelection } from './service-groups';

/**
 * El borrador del alta de un lavado (003, 082), sin React: qué campos tiene el
 * formulario, cómo cambian al elegir un carro, cuánto suma y qué cuerpo viaja
 * al API. La ficha (`components/ticket-form.tsx`) solo lo conecta.
 */

// ---------------------------------------------------------------------------
// El formulario
// ---------------------------------------------------------------------------

const ticketShape = createOfficeTicketSchema.shape;
const vehicleShape = ticketShape.vehicle.unwrap().shape;

/**
 * Los campos de la ficha, validados con las mismas reglas con que el API valida
 * el alta (`createOfficeTicketSchema` y `createVehicleSchema` de `@elite/shared`).
 *
 * Cliente, servicios y productos viajan tal cual: no son texto que se tipee
 * sino lo que se eligió tocando, y lo que los hace completos lo dice
 * {@link isTicketComplete}. Marca, color y nota vacíos son válidos: el cuerpo
 * los omite.
 */
export const ticketFormSchema = z.object({
  plate: vehicleShape.plate,
  bodyTypeId: createVehicleSchema.shape.bodyTypeId,
  make: vehicleShape.make.unwrap(),
  color: vehicleShape.color.unwrap(),
  notes: ticketShape.notes.unwrap(),
  /** Oficina: un empleado o nadie. La pista no lo manda (035). */
  employeeId: ticketShape.employeeId.unwrap().nullable(),
  customer: z.custom<CustomerDraft>(),
  /** Un servicio por rubro y los descuentos de cada línea (039, 050). */
  selection: z.custom<ServiceSelection>(),
  /**
   * Los productos no dependen del carro: cambiar de vehículo o de tipo no los
   * suelta, al revés que los servicios, cuyo precio sí depende del tipo (065).
   */
  products: z.custom<ProductPick[]>(),
  /** Los combos elegidos, por id (104). Tampoco dependen del carro. */
  combos: z.custom<string[]>(),
});

export type TicketFormInput = z.input<typeof ticketFormSchema>;
export type TicketFormOutput = z.output<typeof ticketFormSchema>;

export const EMPTY_TICKET_FORM: TicketFormInput = {
  plate: '',
  bodyTypeId: '',
  make: '',
  color: '',
  notes: '',
  employeeId: null,
  customer: EMPTY_CUSTOMER,
  selection: EMPTY_SELECTION,
  products: [],
  combos: [],
};

/**
 * Lo que el formulario devuelve. Las dos vistas lo mandan a su propia ruta.
 *
 * El cliente viaja de una de dos formas y nunca de las dos: `customerId` si se
 * eligió uno que ya existe —y entonces no se crea nadie ni se le pisa un dato
 * (004 RN-6)—, o `customer` si es alguien nuevo.
 *
 * Si el vehículo ya existe en el catálogo, se envía `vehicleId` y no se mandan
 * tipo, marca ni color (012).
 */
export interface TicketFormValues {
  customerId?: string;
  customer?: { fullName: string; phone?: string };
  vehicleId?: string | null;
  vehicle?: { plate: string; bodyTypeId?: string; make?: string; color?: string };
  /** Servicios y productos (065): `{ serviceId }` o `{ inventoryItemId, quantity }`. */
  items: TicketItemInput[];
  /** Combos del lavado (104): el API los expande en líneas. */
  combos: TicketComboInput[];
  notes?: string;
  /** Oficina: un empleado, o nada (sin asignar). La pista no lo manda (035). */
  employeeId?: string;
}

// ---------------------------------------------------------------------------
// El carro
// ---------------------------------------------------------------------------

/**
 * En qué punto está «El carro»: la caja única de búsqueda (040), los carros de
 * un cliente recién elegido (026), un carro que ya existe o uno nuevo.
 */
export type VehicleStep =
  | { kind: 'search' }
  | { kind: 'choosing'; customer: Customer }
  | { kind: 'known'; vehicle: VehicleWithOwner }
  | { kind: 'new' };

type FormPatch = Partial<TicketFormInput>;

/** Elegir un carro conocido: trae su ficha y su responsable, y suelta los servicios. */
export function knownVehiclePatch(vehicle: VehicleWithOwner): FormPatch {
  return {
    plate: vehicle.plate,
    bodyTypeId: vehicle.bodyType.id,
    make: vehicle.make ?? '',
    color: vehicle.color ?? '',
    selection: EMPTY_SELECTION,
    ...(vehicle.currentOwner ? { customer: draftFromCustomer(vehicle.currentOwner) } : {}),
  };
}

/** Anotar un carro que el sistema no conoce, con la placa ya formateada. */
export function newVehiclePatch(plate: string): FormPatch {
  return { plate, bodyTypeId: '', make: '', color: '', selection: EMPTY_SELECTION };
}

/** Volver a la caja única: se deshace la elección del carro, no la nota ni los productos. */
export function searchAgainPatch(): FormPatch {
  return {
    customer: EMPTY_CUSTOMER,
    plate: '',
    bodyTypeId: '',
    make: '',
    color: '',
    selection: EMPTY_SELECTION,
  };
}

/** El carro corregido en «Cambios del carro»: su ficha y su dueño nuevos. */
export function updatedVehiclePatch(vehicle: VehicleWithOwner): FormPatch {
  return {
    bodyTypeId: vehicle.bodyType.id,
    make: vehicle.make ?? '',
    color: vehicle.color ?? '',
    ...(vehicle.currentOwner ? { customer: draftFromCustomer(vehicle.currentOwner) } : {}),
  };
}

/**
 * Elegido un cliente, su carro se resuelve solo cuando no hay dudas (026): con
 * uno registrado se preselecciona, sin ninguno se pasa a carro nuevo, y con
 * varios se le pregunta cuál trajo.
 */
export function stepAfterCustomerVehicles(
  customer: Customer,
  vehicles: readonly VehicleWithOwner[],
): VehicleStep {
  if (vehicles.length === 1) return { kind: 'known', vehicle: vehicles[0] };
  if (vehicles.length === 0) return { kind: 'new' };

  return { kind: 'choosing', customer };
}

/**
 * Placa + tipo + servicio alcanzan para abrir (040). Un combo cuenta como
 * servicio: trae al menos uno (104 criterio 6).
 */
export function isTicketComplete(input: {
  vehicle: VehicleWithOwner | null;
  plate: string;
  bodyTypeId: string;
  selection: ServiceSelection;
  /** Los combos que de verdad viajan (`pickedCombos`). */
  combos?: readonly string[];
}): boolean {
  const hasVehicle = input.vehicle !== null || input.plate.trim() !== '';
  const hasService = input.selection.selected.length > 0 || (input.combos?.length ?? 0) > 0;

  return hasVehicle && input.bodyTypeId !== '' && hasService;
}

// ---------------------------------------------------------------------------
// Líneas y total
// ---------------------------------------------------------------------------

/** Un combo elegido en el alta, con su precio para el tipo de carro (o `null` sin tipo). */
export interface ComboLine {
  id: string;
  name: string;
  price: string | null;
}

/**
 * Lo descontado y el total, en centavos: servicios, productos y combos (030,
 * 065, 104). Lo que ahorra un combo no es un descuento de línea: no suma acá.
 */
export function ticketTotals(
  lines: readonly SelectedLine[],
  products: readonly ProductPick[],
  combos: readonly ComboLine[] = [],
): { discount: number; total: number } {
  return {
    discount: lines.reduce((sum, line) => sum + discountCents(line.catalog, line.price), 0),
    total:
      lines.reduce((sum, line) => sum + parseCents(line.price), 0) +
      productsTotalCents(products) +
      combos.reduce((sum, combo) => sum + (combo.price === null ? 0 : parseCents(combo.price)), 0),
  };
}

/**
 * Las líneas del resumen: cada combo en una sola fila con su precio, cada
 * servicio a su precio y cada producto con su cantidad.
 */
export function summaryLines(
  lines: readonly SelectedLine[],
  products: readonly ProductPick[],
  combos: readonly ComboLine[] = [],
): { id: string; name: string; price: string | null; detail?: string }[] {
  return [
    ...combos.map((combo) => ({ id: `combo:${combo.id}`, name: combo.name, price: combo.price })),
    ...lines.map((line) => ({ id: line.id, name: line.name, price: line.price })),
    ...products.map((pick) => ({
      id: pick.inventoryItemId,
      name: pick.name,
      price: centsToAmount(lineTotalCents(pick.unitPrice, pick.quantity)),
      detail: lineQuantityLabel(pick.unitPrice, pick.quantity),
    })),
  ];
}

// ---------------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------------

/** Quién es el cliente en el cuerpo: uno que existe, uno nuevo o nadie. */
export type CustomerChoice = Pick<TicketFormValues, 'customerId' | 'customer'>;

/**
 * Qué hace «Abrir lavado» con el cliente. Con un cliente elegido va derecho;
 * con uno nuevo se pregunta primero si ya existe (RN-2).
 *
 * - `confirm-owner`: el carro tiene otro dueño y se pueden administrar
 *   vehículos: primero se pregunta si cambió de manos.
 * - `update`: el cliente elegido se corrigió; se actualiza su perfil (028).
 * - `match`: alguien nuevo; se pregunta si ya existe.
 */
export type SaveStep =
  | { kind: 'confirm-owner' }
  | { kind: 'submit'; who: CustomerChoice }
  | {
      kind: 'update';
      customerId: string;
      changes: { fullName?: string; phone?: string };
    }
  | { kind: 'match'; draft: { fullName: string; phone?: string } };

export function saveStepOf(input: {
  vehicle: VehicleWithOwner | null;
  customer: CustomerDraft;
  canManageVehicles: boolean;
}): SaveStep {
  const { vehicle, customer } = input;
  const owner = vehicle?.currentOwner ?? null;

  if (
    owner !== null &&
    customer.customerId !== undefined &&
    customer.customerId !== '' &&
    customer.customerId !== owner.id &&
    input.canManageVehicles
  ) {
    return { kind: 'confirm-owner' };
  }

  if (owner !== null) return { kind: 'submit', who: {} };

  if (customer.customerId) {
    const original = customer.original;
    const isNameChanged =
      original !== undefined && customer.fullName.trim() !== original.fullName.trim();
    const isPhoneChanged =
      original !== undefined && customer.phone.trim() !== original.phone.trim();

    if (isNameChanged || isPhoneChanged) {
      return {
        kind: 'update',
        customerId: customer.customerId,
        changes: {
          fullName: isNameChanged ? customer.fullName.trim() : undefined,
          phone: customer.phone.trim() || undefined,
        },
      };
    }

    return { kind: 'submit', who: { customerId: customer.customerId } };
  }

  const draft = newCustomerOf(customer);

  return draft === null ? { kind: 'submit', who: {} } : { kind: 'match', draft };
}

/** El cliente nuevo tal como viaja, o `null` si no se escribió un nombre. */
export function newCustomerOf(
  customer: CustomerDraft,
): { fullName: string; phone?: string } | null {
  const fullName = customer.fullName.trim();

  if (fullName === '') return null;

  return { fullName, phone: customer.phone.trim() || undefined };
}

/**
 * El cuerpo del alta. Un servicio lleva `unitPrice` solo si de verdad se
 * descontó: si no, manda el catálogo del API. El asignado viaja solo desde
 * oficina y si se eligió a alguien (035).
 */
export function ticketValuesOf(input: {
  fields: Pick<
    TicketFormInput,
    'plate' | 'bodyTypeId' | 'make' | 'color' | 'notes' | 'employeeId' | 'products'
  >;
  vehicle: VehicleWithOwner | null;
  lines: readonly SelectedLine[];
  who: CustomerChoice;
  withEmployee: boolean;
  /** Los combos que viajan (104): el API los expande en líneas. */
  combos?: readonly string[];
}): TicketFormValues {
  const { fields, vehicle, who } = input;

  return {
    ...who,
    vehicleId: vehicle?.id ?? null,
    vehicle: vehicle
      ? undefined
      : {
          plate: fields.plate.trim(),
          bodyTypeId: fields.bodyTypeId,
          make: fields.make.trim() || undefined,
          color: fields.color.trim() || undefined,
        },
    items: [
      ...input.lines.map((line) => ({
        serviceId: line.id,
        unitPrice: line.price === line.catalog ? undefined : line.price,
      })),
      ...productItemsPayload(fields.products),
    ],
    combos: (input.combos ?? []).map((comboId) => ({ comboId })),
    notes: fields.notes.trim() || undefined,
    ...(!input.withEmployee || fields.employeeId === null ? {} : { employeeId: fields.employeeId }),
  };
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * `details` del `409 VEHICLE_PLATE_EXISTS`: el carro que ya tenía esa placa.
 * Se revisa la forma antes de adoptarlo, igual que el faltante de existencia.
 */
export function isVehicleMatchDetails(details: unknown): details is { vehicle: VehicleWithOwner } {
  if (!isRecord(details) || !isRecord(details.vehicle)) return false;

  const { id, plate, bodyType, currentOwner } = details.vehicle;

  return (
    typeof id === 'string' &&
    typeof plate === 'string' &&
    isRecord(bodyType) &&
    typeof bodyType.id === 'string' &&
    typeof bodyType.name === 'string' &&
    (currentOwner === null ||
      (isRecord(currentOwner) &&
        typeof currentOwner.id === 'string' &&
        typeof currentOwner.fullName === 'string'))
  );
}

/** El carro que ya existía con la placa tecleada, si el API lo devolvió. */
export function plateConflictVehicle(
  error: { code: string; details?: unknown } | null | undefined,
): VehicleWithOwner | null {
  if (error?.code !== API_ERROR_CODES.VEHICLE_PLATE_EXISTS) return null;

  return isVehicleMatchDetails(error.details) ? error.details.vehicle : null;
}

/**
 * `true` si el API respondió: el pedido llegó y dijo que no. Un fallo de red
 * (`NETWORK_ERROR`) o algo que ni siquiera es un `ApiError` no cuenta.
 */
export function isAnsweredApiError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code !== API_ERROR_CODES.NETWORK_ERROR;
}

const UNREACHABLE_MESSAGE = 'No se pudo conectar con el servidor.';

/** Lo que se dice al pie del formulario cuando el API no respondió. */
export function unansweredMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNREACHABLE_MESSAGE;
}
