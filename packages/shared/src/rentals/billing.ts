import { z } from 'zod';

import type {
  CashSession,
  CashSessionDetail,
  CashSessionPayment,
  Page,
  PaymentMethod,
} from '../contracts';
import { civilDateSchema, moneySchema, pageQueryShape, paymentMethodSchema } from '../schemas';
import type { AgreementTotals } from './money';
import { moneyToCents } from './money';

/**
 * spec 098 — El dinero de la rentadora: pagos sobre una renta, anulación,
 * devolución del depósito, multas ligadas a quien tenía el carro, cuentas por
 * cobrar y la «Caja» como turno con fondo y arqueo (109).
 *
 * No comparte nada con la caja del lavado (`cash_sessions`, `payments`): es
 * otro negocio. Montos como cadena de dos decimales; instantes en ISO 8601.
 */

/** Cómo se llama cada forma de pago en pantalla (RN-6). Las mismas cuatro del lavado. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

/** El orden en que la caja enseña las formas de pago. */
export const RENTAL_PAYMENT_METHOD_ORDER: readonly PaymentMethod[] = [
  'CASH',
  'CARD',
  'TRANSFER',
  'OTHER',
];

/** Tope de la referencia libre de un pago: número de transferencia, voucher. */
export const RENTAL_PAYMENT_REFERENCE_MAX_LENGTH = 60;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} no puede pasar de ${max} caracteres.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const requiredText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(min, { message })
    .max(max, { message: `No puede pasar de ${max} caracteres.` });

/** Un monto mayor que cero (RN-1). */
const positiveMoney = moneySchema.refine((value) => moneyToCents(value) > 0, {
  message: 'El monto tiene que ser mayor que cero.',
});

/** Un instante con zona: `2026-10-01T14:30:00-06:00` o `…Z`. */
const instantSchema = z.iso.datetime({
  offset: true,
  message: 'La fecha y hora no es válida.',
});

/** `POST /rentals/agreements/:id/payments`. Sin `paidAt`, ahora. */
export const createPaymentSchema = z.object({
  amount: positiveMoney,
  method: paymentMethodSchema,
  reference: optionalText(RENTAL_PAYMENT_REFERENCE_MAX_LENGTH, 'La referencia'),
  paidAt: instantSchema.optional(),
  note: optionalText(500, 'La nota'),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** `POST /rentals/payments/:paymentId/void`: el pago no se borra, se anula con motivo (RN-1). */
export const voidPaymentSchema = z.object({
  reason: requiredText(3, 300, 'Escribí por qué se anula (al menos 3 letras).'),
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

/**
 * `POST /rentals/agreements/:id/deposit-return` (RN-2). Se devuelve una sola
 * vez, de 0 hasta el depósito; si se retiene una parte, la nota dice por qué.
 */
export const depositReturnSchema = z.object({
  amount: moneySchema,
  method: paymentMethodSchema.optional(),
  note: optionalText(500, 'La nota'),
});
export type DepositReturnInput = z.infer<typeof depositReturnSchema>;

/**
 * `POST /rentals/fines` (RN-4). El API busca quién tenía el carro en
 * `occurredAt`; `chargeToCustomer` solo vale si lo encuentra.
 */
export const createFineSchema = z.object({
  vehicleId: z.uuid({ message: 'Elegí el carro.' }),
  occurredAt: instantSchema,
  amount: positiveMoney,
  description: requiredText(1, 300, 'Escribí de qué es la multa.'),
  chargeToCustomer: z.boolean(),
});
export type CreateFineInput = z.infer<typeof createFineSchema>;

/**
 * `GET /rentals/fines` → `Page<RentalFine>` (101). Todo opcional; el rango es por
 * `occurredAt`, en días civiles.
 */
export const finesQuerySchema = z.object({
  ...pageQueryShape,
  vehicleId: z.uuid({ message: 'Ese carro no es válido.' }).optional(),
  agreementId: z.uuid({ message: 'Esa renta no es válida.' }).optional(),
  from: civilDateSchema.optional(),
  to: civilDateSchema.optional(),
});
export type FinesQuery = z.infer<typeof finesQuerySchema>;

/** `GET /rentals/fines/resolve`: a quién se le cargaría una multa antes de guardarla. */
export const fineResolveQuerySchema = z.object({
  vehicleId: z.uuid({ message: 'Elegí el carro.' }),
  occurredAt: instantSchema,
});
export type FineResolveQuery = z.infer<typeof fineResolveQuerySchema>;

/** Un pago sobre una renta. Los anulados siguen acá, con `voidedAt`. */
export interface RentalPayment {
  id: string;
  agreementId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  note: string | null;
  /** El usuario de la sesión que lo registró. */
  receivedByUserId: string;
  receivedByName: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByUserId: string | null;
  voidedByName: string | null;
  /**
   * Turno en el que entró (109). `null` en cobros anteriores a esa spec y en
   * el del checkout (096): no suman en ningún turno.
   */
  cashSessionId: string | null;
  createdAt: string;
}

/** La renta a la que quedó ligada una multa (RN-4). */
export interface RentalFineAgreement {
  id: string;
  contractNumber: number | null;
  customerName: string;
}

/** Una multa de tránsito de un carro de la flota. */
export interface RentalFine {
  id: string;
  vehicleId: string;
  vehicle: { plate: string | null; make: string; model: string };
  agreementId: string | null;
  agreement: RentalFineAgreement | null;
  occurredAt: string;
  amount: string;
  description: string;
  /** `true`: entra al total de la renta. `false`: gasto del carro (099). */
  chargedToCustomer: boolean;
  createdByUserId: string;
  createdAt: string;
}

/** `GET /rentals/fines/resolve`. `null`: nadie tenía el carro en esa fecha. */
export interface FineResolution {
  agreement: RentalFineAgreement | null;
}

/** Los estados guardados de una renta (096). Se repiten acá para no depender de su contrato. */
export type BillingAgreementStatus = 'RESERVED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

/**
 * Lo mínimo de una renta que necesita la cuenta (`AgreementBillingPanel`). El
 * DTO de detalle de la 096 lo cumple tal cual: tiene estos campos y más.
 */
export interface BillingAgreementView {
  id: string;
  contractNumber: number | null;
  status: BillingAgreementStatus;
  /** Para precargar el carro al agregar una multa desde la renta. */
  vehicleId?: string;
  deposit: string;
  depositReturnedAmount: string | null;
  depositTransferredToId: string | null;
  totals: AgreementTotals;
  payments: RentalPayment[];
  fines: RentalFine[];
}

/**
 * De qué renta es un cobro del turno (109). `agreementId` abre la fila; no
 * está en el texto de la spec y hace falta para el enlace.
 */
export interface RentalCashPaymentDetail {
  agreementId: string;
  contractNumber: number | null;
  plate: string | null;
  customerName: string;
}

/**
 * Un cobro del turno de renta. Los mismos campos que `CashSessionPayment` más
 * `detail`. Los de lavado (`workOrderId`, venta, cuenta) van en `null`.
 */
export interface RentalCashPayment extends CashSessionPayment {
  detail: RentalCashPaymentDetail;
}

/** Un turno de la caja de renta. Misma forma que `CashSession` (109). */
export type RentalCashSession = CashSession;

/** El turno con una página de sus cobros. Los totales son del turno entero. */
export interface RentalCashSessionDetail extends Omit<
  CashSessionDetail,
  'payments' | 'otherPayments'
> {
  payments: Page<RentalCashPayment>;
  otherPayments: RentalCashPayment[];
}

/** Un depósito en custodia (RN-2). */
export interface DepositHeldRow {
  agreementId: string;
  contractNumber: number | null;
  /** Placa del carro. `null` si el carro no tiene. */
  plate: string | null;
  customer: string;
  amount: string;
}

/** Una cuenta por cobrar (RN-3): renta en curso o finalizada con saldo. */
export interface ReceivableRow {
  agreementId: string;
  contractNumber: number | null;
  /** Placa del carro. `null` si el carro no tiene. */
  plate: string | null;
  customer: string;
  total: string;
  paid: string;
  balance: string;
  status: 'IN_PROGRESS' | 'FINISHED';
}

/**
 * `GET /rentals/deposits-held?page&pageSize` (101): una página, por número de
 * contrato, y `totalAmount`, lo que hay en custodia en todas las filas.
 */
export interface DepositsHeldList extends Page<DepositHeldRow> {
  totalAmount: string;
}

/**
 * `GET /rentals/receivables?page&pageSize` (101): una página, de la que más debe a
 * la que menos, y `totalBalance`, lo que se debe en todas las filas.
 */
export interface ReceivablesList extends Page<ReceivableRow> {
  totalBalance: string;
}
