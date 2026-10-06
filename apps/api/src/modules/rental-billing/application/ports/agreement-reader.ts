import type { PaymentMethod, RentalFineAgreement } from '@elite/shared';

import type { AgreementStatus, OccupancySpan } from '../../domain/billing-rules';

/** Un pago tal como está guardado. Montos como cadena de dos decimales. */
export interface BillingPaymentRecord {
  id: string;
  agreementId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
  note: string | null;
  receivedByUserId: string;
  voidedAt: Date | null;
  voidReason: string | null;
  voidedByUserId: string | null;
  /** Turno de renta (109). `null` en cobros viejos y en el del checkout. */
  cashSessionId: string | null;
  createdAt: Date;
}

/** Una multa con lo que hace falta para nombrarla: el carro y la renta ligada. */
export interface BillingFineRecord {
  id: string;
  vehicleId: string;
  vehicle: { plate: string | null; make: string; model: string };
  agreementId: string | null;
  agreement: RentalFineAgreement | null;
  occurredAt: Date;
  amount: string;
  description: string;
  chargedToCustomer: boolean;
  createdByUserId: string;
  createdAt: Date;
}

/** Lo que nombra una renta y dice cuándo tuvo el carro el cliente (RN-4). */
export interface AgreementSpan extends OccupancySpan {
  id: string;
  contractNumber: number | null;
  status: AgreementStatus;
  vehicleId: string;
  customerName: string;
}

/** Una renta con todo lo que entra a su cuenta (`agreementTotals`). */
export interface BillingAgreementRecord extends AgreementSpan {
  /** Placa del carro. `null` si no tiene. */
  plate: string | null;
  dailyRate: string;
  cdwPerDay: string;
  billableDays: number;
  extraCharges: string;
  extraKmCharge: string;
  discount: string;
  deposit: string;
  depositReturnedAmount: string | null;
  depositTransferredToId: string | null;
  payments: BillingPaymentRecord[];
  fines: BillingFineRecord[];
}

/**
 * Lectura de `rental_agreements` para el dinero (098). No pasa por el módulo
 * de rentas (096): lee la tabla directo, con sus pagos y multas.
 */
export interface AgreementReader {
  findById(id: string): Promise<BillingAgreementRecord | null>;
  /** Las rentas `IN_PROGRESS` y `FINISHED` de un carro: las que pudieron tenerlo (RN-4). */
  listHoldingVehicle(vehicleId: string): Promise<AgreementSpan[]>;
  /**
   * Las rentas que pueden deber o guardar depósito: `IN_PROGRESS`, `FINISHED`
   * o con depósito sin devolver ni transferir (RN-2, RN-3).
   */
  listOpenAccounts(): Promise<BillingAgreementRecord[]>;
}

export const AGREEMENT_READER = Symbol('rental-billing.AgreementReader');
