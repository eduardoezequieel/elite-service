import type {
  CreateFleetExpenseInput,
  CreateMaintenanceLogInput,
  CreatePlanTaskInput,
  FleetExpenseList,
  FleetExpenseRow,
  FleetExpensesQuery,
  MaintenanceLog,
  MaintenanceLogsQuery,
  MaintenancePlanTask,
  MaintenanceStatusQuery,
  UpdateFleetExpenseInput,
  UpdatePlanTaskInput,
  VehicleMaintenanceStatus,
} from '@elite/shared';

import { API_BASE_URL, apiFetch } from '@/lib/api';

/** API de mantenimiento y gastos de la flota (099). */

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();

  return text === '' ? '' : `?${text}`;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export function listPlanTasks(): Promise<MaintenancePlanTask[]> {
  return apiFetch<MaintenancePlanTask[]>('/fleet/maintenance/plan');
}

export function createPlanTask(input: CreatePlanTaskInput): Promise<MaintenancePlanTask> {
  return apiFetch<MaintenancePlanTask>('/fleet/maintenance/plan', json('POST', input));
}

export function updatePlanTask(
  id: string,
  input: UpdatePlanTaskInput,
): Promise<MaintenancePlanTask> {
  return apiFetch<MaintenancePlanTask>(`/fleet/maintenance/plan/${id}`, json('PATCH', input));
}

export function getMaintenanceStatus(
  params: MaintenanceStatusQuery = {},
): Promise<VehicleMaintenanceStatus[]> {
  return apiFetch<VehicleMaintenanceStatus[]>(`/fleet/maintenance/status${query(params)}`);
}

export function listMaintenanceLogs(params: MaintenanceLogsQuery = {}): Promise<MaintenanceLog[]> {
  return apiFetch<MaintenanceLog[]>(`/fleet/maintenance/logs${query(params)}`);
}

export function recordMaintenanceService(
  input: CreateMaintenanceLogInput,
): Promise<MaintenanceLog[]> {
  return apiFetch<MaintenanceLog[]>('/fleet/maintenance/logs', json('POST', input));
}

export function getWorkshopText(): Promise<{ text: string }> {
  return apiFetch<{ text: string }>('/fleet/maintenance/whatsapp-text');
}

/** El `.ics` se descarga con un enlace al mismo origen: la cookie viaja sola. */
export const REMINDERS_ICS_URL = `${API_BASE_URL.replace(/\/+$/, '')}/fleet/maintenance/reminders.ics`;

export function listFleetExpenses(params: FleetExpensesQuery = {}): Promise<FleetExpenseList> {
  return apiFetch<FleetExpenseList>(`/fleet/expenses${query(params)}`);
}

export function createFleetExpense(input: CreateFleetExpenseInput): Promise<FleetExpenseRow> {
  return apiFetch<FleetExpenseRow>('/fleet/expenses', json('POST', input));
}

export function updateFleetExpense(
  id: string,
  input: UpdateFleetExpenseInput,
): Promise<FleetExpenseRow> {
  return apiFetch<FleetExpenseRow>(`/fleet/expenses/${id}`, json('PATCH', input));
}

export function deleteFleetExpense(id: string): Promise<void> {
  return apiFetch<void>(`/fleet/expenses/${id}`, { method: 'DELETE' });
}
