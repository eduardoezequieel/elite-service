import { API_ERROR_CODES, type Customer, type VehicleWithOwner } from '@elite/shared';

import { ApiError } from '@/lib/api';
import { EMPTY_CUSTOMER } from './customer-draft';
import type { ProductPick } from './product-lines';
import { EMPTY_SELECTION, type SelectedLine } from './service-groups';
import {
  EMPTY_TICKET_FORM,
  isAnsweredApiError,
  isTicketComplete,
  isVehicleMatchDetails,
  knownVehiclePatch,
  newCustomerOf,
  newVehiclePatch,
  plateConflictVehicle,
  saveStepOf,
  searchAgainPatch,
  stepAfterCustomerVehicles,
  summaryLines,
  ticketFormSchema,
  ticketTotals,
  ticketValuesOf,
  unansweredMessage,
  updatedVehiclePatch,
} from './ticket-draft';

const BODY_TYPE_ID = '8c7c5c1e-3a1b-4f6e-9d2a-1b2c3d4e5f60';
const SERVICE_ID = '2f1e0d9c-8b7a-4c6d-9e5f-0a1b2c3d4e5f';

const owner: Customer = { id: 'c-owner', fullName: 'Juan Pérez', phone: '77778888' };

function vehicle(overrides: Partial<VehicleWithOwner> = {}): VehicleWithOwner {
  return {
    id: 'v1',
    plate: 'P123-456',
    bodyType: { id: BODY_TYPE_ID, key: 'SEDAN', name: 'Sedán', sortOrder: 1 },
    make: 'Toyota',
    color: null,
    isActive: true,
    currentOwner: null,
    lastWash: null,
    ...overrides,
  };
}

function line(overrides: Partial<SelectedLine> = {}): SelectedLine {
  return {
    id: SERVICE_ID,
    name: 'Lavado completo',
    categoryName: 'Lavado',
    catalog: '10.00',
    price: '10.00',
    ...overrides,
  };
}

const wax: ProductPick = {
  inventoryItemId: 'i1',
  name: 'Cera',
  catalogPrice: '3.00',
  unitPrice: '3.00',
  quantity: 2000,
};

describe('el formulario del alta (082)', () => {
  const valid = { ...EMPTY_TICKET_FORM, plate: 'P123-456', bodyTypeId: BODY_TYPE_ID };

  it('valida con las reglas del alta de shared', () => {
    expect(ticketFormSchema.safeParse(valid).success).toBe(true);
    expect(ticketFormSchema.safeParse({ ...valid, plate: 'P' }).success).toBe(false);
    expect(ticketFormSchema.safeParse({ ...valid, notes: 'x'.repeat(501) }).success).toBe(false);
    expect(ticketFormSchema.safeParse({ ...valid, make: 'x'.repeat(41) }).success).toBe(false);
  });

  it('marca, color y nota vacíos son válidos, y el asignado puede faltar', () => {
    const parsed = ticketFormSchema.parse({ ...valid, make: ' ', color: '', employeeId: null });

    expect(parsed.make).toBe('');
    expect(parsed.employeeId).toBeNull();
  });
});

describe('el carro del alta (026, 040)', () => {
  it('un carro conocido trae su ficha y su responsable, y suelta los servicios', () => {
    expect(knownVehiclePatch(vehicle({ currentOwner: owner }))).toEqual({
      plate: 'P123-456',
      bodyTypeId: BODY_TYPE_ID,
      make: 'Toyota',
      color: '',
      selection: EMPTY_SELECTION,
      customer: {
        customerId: 'c-owner',
        fullName: 'Juan Pérez',
        phone: '7777-8888',
        original: { fullName: 'Juan Pérez', phone: '7777-8888' },
      },
    });
  });

  it('sin dueño no toca el cliente que ya se había elegido', () => {
    expect(knownVehiclePatch(vehicle())).not.toHaveProperty('customer');
    expect(updatedVehiclePatch(vehicle())).not.toHaveProperty('customer');
  });

  it('carro nuevo y volver a buscar limpian el carro pero no la nota ni los productos', () => {
    expect(newVehiclePatch('P9')).toEqual({
      plate: 'P9',
      bodyTypeId: '',
      make: '',
      color: '',
      selection: EMPTY_SELECTION,
    });

    const again = searchAgainPatch();

    expect(again.customer).toEqual(EMPTY_CUSTOMER);
    expect(again).not.toHaveProperty('notes');
    expect(again).not.toHaveProperty('products');
    expect(again).not.toHaveProperty('employeeId');
  });

  it('con un carro se preselecciona, sin ninguno es nuevo y con varios se pregunta', () => {
    const one = vehicle();

    expect(stepAfterCustomerVehicles(owner, [one])).toEqual({ kind: 'known', vehicle: one });
    expect(stepAfterCustomerVehicles(owner, [])).toEqual({ kind: 'new' });
    expect(stepAfterCustomerVehicles(owner, [one, vehicle({ id: 'v2' })])).toEqual({
      kind: 'choosing',
      customer: owner,
    });
  });

  it('placa + tipo + servicio alcanzan para abrir', () => {
    const selection = { selected: [SERVICE_ID], prices: {} };

    expect(
      isTicketComplete({ vehicle: null, plate: 'P1', bodyTypeId: BODY_TYPE_ID, selection }),
    ).toBe(true);
    expect(
      isTicketComplete({ vehicle: null, plate: ' ', bodyTypeId: BODY_TYPE_ID, selection }),
    ).toBe(false);
    expect(
      isTicketComplete({ vehicle: vehicle(), plate: '', bodyTypeId: BODY_TYPE_ID, selection }),
    ).toBe(true);
    expect(
      isTicketComplete({
        vehicle: null,
        plate: 'P1',
        bodyTypeId: BODY_TYPE_ID,
        selection: EMPTY_SELECTION,
      }),
    ).toBe(false);
    expect(isTicketComplete({ vehicle: null, plate: 'P1', bodyTypeId: '', selection })).toBe(false);
  });

  it('un combo solo ya hace completo el lavado (104 criterio 6)', () => {
    const base = {
      vehicle: null,
      plate: 'P1',
      bodyTypeId: BODY_TYPE_ID,
      selection: EMPTY_SELECTION,
    };

    expect(isTicketComplete({ ...base, combos: ['combo-1'] })).toBe(true);
    expect(isTicketComplete({ ...base, combos: [] })).toBe(false);
    expect(isTicketComplete({ ...base, bodyTypeId: '', combos: ['combo-1'] })).toBe(false);
  });
});

describe('las líneas del alta (030, 065)', () => {
  it('suma servicios y productos, y cuenta lo descontado', () => {
    expect(ticketTotals([line({ price: '8.50' })], [wax])).toEqual({
      discount: 150,
      total: 850 + 600,
    });
    expect(ticketTotals([], [])).toEqual({ discount: 0, total: 0 });
  });

  it('cada combo suma su precio; sin tipo de carro todavía no suma (104)', () => {
    const combos = [
      { id: 'k1', name: 'Combo verano', price: '12.00' },
      { id: 'k2', name: 'Combo full', price: null },
    ];

    expect(ticketTotals([line({ price: '8.50' })], [wax], combos)).toEqual({
      discount: 150,
      total: 850 + 600 + 1200,
    });
    expect(summaryLines([], [], combos)).toEqual([
      { id: 'combo:k1', name: 'Combo verano', price: '12.00' },
      { id: 'combo:k2', name: 'Combo full', price: null },
    ]);
  });

  it('el resumen lista cada servicio a su precio y cada producto con su cantidad', () => {
    expect(summaryLines([line()], [wax])).toEqual([
      { id: SERVICE_ID, name: 'Lavado completo', price: '10.00' },
      { id: 'i1', name: 'Cera', price: '6.00', detail: '2 × $3.00' },
    ]);
  });
});

describe('guardar el alta (004, 028)', () => {
  const chosen = {
    customerId: 'c1',
    fullName: 'Ana',
    phone: '7000-0000',
    original: { fullName: 'Ana', phone: '7000-0000' },
  };

  it('un carro con dueño va derecho, salvo que se eligió a otro y se pueden administrar', () => {
    const withOwner = vehicle({ currentOwner: owner });

    expect(saveStepOf({ vehicle: withOwner, customer: chosen, canManageVehicles: true }).kind).toBe(
      'confirm-owner',
    );
    expect(saveStepOf({ vehicle: withOwner, customer: chosen, canManageVehicles: false })).toEqual({
      kind: 'submit',
      who: {},
    });
  });

  it('un cliente elegido sin cambios viaja por id; corregido, se actualiza primero', () => {
    expect(saveStepOf({ vehicle: null, customer: chosen, canManageVehicles: false })).toEqual({
      kind: 'submit',
      who: { customerId: 'c1' },
    });
    expect(
      saveStepOf({
        vehicle: null,
        customer: { ...chosen, phone: '7000-0001' },
        canManageVehicles: false,
      }),
    ).toEqual({
      kind: 'update',
      customerId: 'c1',
      changes: { fullName: undefined, phone: '7000-0001' },
    });
  });

  it('alguien nuevo se pregunta; sin nombre no hay cliente', () => {
    expect(
      saveStepOf({
        vehicle: null,
        customer: { fullName: ' Luis ', phone: '' },
        canManageVehicles: false,
      }),
    ).toEqual({ kind: 'match', draft: { fullName: 'Luis', phone: undefined } });
    expect(
      saveStepOf({ vehicle: null, customer: EMPTY_CUSTOMER, canManageVehicles: false }),
    ).toEqual({ kind: 'submit', who: {} });
    expect(newCustomerOf({ fullName: '  ', phone: '7000-0000' })).toBeNull();
  });

  const fields = {
    plate: ' P123-456 ',
    bodyTypeId: BODY_TYPE_ID,
    make: ' ',
    color: 'Gris ',
    notes: '',
    employeeId: 'e1',
    products: [wax],
  };

  it('un carro nuevo viaja con su ficha; el precio solo si se descontó', () => {
    expect(
      ticketValuesOf({
        fields,
        vehicle: null,
        lines: [line(), line({ id: 's2', price: '4.00', catalog: '5.00' })],
        who: {},
        withEmployee: true,
      }),
    ).toEqual({
      vehicleId: null,
      vehicle: { plate: 'P123-456', bodyTypeId: BODY_TYPE_ID, make: undefined, color: 'Gris' },
      items: [
        { serviceId: SERVICE_ID, unitPrice: undefined },
        { serviceId: 's2', unitPrice: '4.00' },
        { inventoryItemId: 'i1', quantity: '2.000' },
      ],
      combos: [],
      notes: undefined,
      employeeId: 'e1',
    });
  });

  it('un carro conocido viaja por id; la pista y «sin asignar» no mandan asignado', () => {
    const known = ticketValuesOf({
      fields,
      vehicle: vehicle(),
      lines: [line()],
      who: { customerId: 'c1' },
      withEmployee: false,
    });

    expect(known.vehicleId).toBe('v1');
    expect(known.vehicle).toBeUndefined();
    expect(known.customerId).toBe('c1');
    expect(known).not.toHaveProperty('employeeId');
    expect(known.combos).toEqual([]);

    expect(
      ticketValuesOf({
        fields,
        vehicle: vehicle(),
        lines: [],
        who: {},
        withEmployee: false,
        combos: ['k1', 'k2'],
      }).combos,
    ).toEqual([{ comboId: 'k1' }, { comboId: 'k2' }]);

    expect(
      ticketValuesOf({
        fields: { ...fields, employeeId: null },
        vehicle: null,
        lines: [],
        who: {},
        withEmployee: true,
      }),
    ).not.toHaveProperty('employeeId');
  });
});

describe('los errores del alta (012, 082)', () => {
  it('adopta el carro del 409 solo si viene con la forma esperada', () => {
    const existing = vehicle({ currentOwner: owner });
    const conflict = new ApiError(
      {
        code: API_ERROR_CODES.VEHICLE_PLATE_EXISTS,
        message: 'Ya existe',
        details: { vehicle: existing },
      },
      409,
    );

    expect(plateConflictVehicle(conflict)).toBe(existing);
    expect(plateConflictVehicle(null)).toBeNull();
    expect(
      plateConflictVehicle({
        code: API_ERROR_CODES.VEHICLE_PLATE_EXISTS,
        details: { vehicle: 'v1' },
      }),
    ).toBeNull();
    expect(
      plateConflictVehicle({
        code: API_ERROR_CODES.INSUFFICIENT_STOCK,
        details: { vehicle: existing },
      }),
    ).toBeNull();
  });

  it('el guard revisa id, placa, tipo y dueño', () => {
    expect(isVehicleMatchDetails({ vehicle: vehicle() })).toBe(true);
    expect(isVehicleMatchDetails(undefined)).toBe(false);
    expect(isVehicleMatchDetails({ vehicle: { ...vehicle(), bodyType: null } })).toBe(false);
    expect(isVehicleMatchDetails({ vehicle: { ...vehicle(), currentOwner: { id: 1 } } })).toBe(
      false,
    );
  });

  it('distingue lo que respondió el API de la red caída', () => {
    const answered = new ApiError({ code: API_ERROR_CODES.VALIDATION_ERROR, message: 'No' }, 400);
    const offline = new ApiError(
      { code: API_ERROR_CODES.NETWORK_ERROR, message: 'No se pudo conectar con el servidor.' },
      0,
    );

    expect(isAnsweredApiError(answered)).toBe(true);
    expect(isAnsweredApiError(offline)).toBe(false);
    expect(isAnsweredApiError(new TypeError('Failed to fetch'))).toBe(false);
    expect(unansweredMessage(offline)).toBe('No se pudo conectar con el servidor.');
    expect(unansweredMessage(new TypeError('Failed to fetch'))).toBe(
      'No se pudo conectar con el servidor.',
    );
  });
});
