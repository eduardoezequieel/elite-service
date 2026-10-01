'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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

import { FLEET_QUERY_KEY } from '@/features/fleet/hooks/use-fleet';
import type { ApiError } from '@/lib/api';
import {
  createFleetExpense,
  createPlanTask,
  deleteFleetExpense,
  getMaintenanceStatus,
  getWorkshopText,
  listFleetExpenses,
  listMaintenanceLogs,
  listPlanTasks,
  recordMaintenanceService,
  updateFleetExpense,
  updatePlanTask,
} from '../api';

/** Toda la rama del mantenimiento: plan, estado, servicios, texto y gastos. */
export const FLEET_MAINTENANCE_QUERY_KEY = ['fleet-maintenance'] as const;

const keys = {
  plan: [...FLEET_MAINTENANCE_QUERY_KEY, 'plan'] as const,
  status: (params: MaintenanceStatusQuery) =>
    [...FLEET_MAINTENANCE_QUERY_KEY, 'status', params] as const,
  logs: (params: MaintenanceLogsQuery) => [...FLEET_MAINTENANCE_QUERY_KEY, 'logs', params] as const,
  workshopText: [...FLEET_MAINTENANCE_QUERY_KEY, 'workshop-text'] as const,
  expenses: (params: FleetExpensesQuery) =>
    [...FLEET_MAINTENANCE_QUERY_KEY, 'expenses', params] as const,
};

export function usePlanTasks(enabled = true): UseQueryResult<MaintenancePlanTask[], ApiError> {
  return useQuery<MaintenancePlanTask[], ApiError>({
    queryKey: keys.plan,
    queryFn: listPlanTasks,
    enabled,
  });
}

export function useMaintenanceStatus(
  params: MaintenanceStatusQuery = {},
  enabled = true,
): UseQueryResult<VehicleMaintenanceStatus[], ApiError> {
  return useQuery<VehicleMaintenanceStatus[], ApiError>({
    queryKey: keys.status(params),
    queryFn: () => getMaintenanceStatus(params),
    enabled,
  });
}

export function useMaintenanceLogs(
  params: MaintenanceLogsQuery = {},
  enabled = true,
): UseQueryResult<MaintenanceLog[], ApiError> {
  return useQuery<MaintenanceLog[], ApiError>({
    queryKey: keys.logs(params),
    queryFn: () => listMaintenanceLogs(params),
    enabled,
  });
}

/** El texto para el taller se pide solo cuando se abre su diálogo. */
export function useWorkshopText(enabled: boolean): UseQueryResult<{ text: string }, ApiError> {
  return useQuery<{ text: string }, ApiError>({
    queryKey: keys.workshopText,
    queryFn: getWorkshopText,
    enabled,
  });
}

export function useFleetExpenses(
  params: FleetExpensesQuery = {},
  enabled = true,
): UseQueryResult<FleetExpenseList, ApiError> {
  return useQuery<FleetExpenseList, ApiError>({
    queryKey: keys.expenses(params),
    queryFn: () => listFleetExpenses(params),
    enabled,
  });
}

/**
 * Cualquier cambio invalida toda la rama: un servicio mueve el estado, el
 * historial y los gastos; y la flota, porque puede subir el odómetro del carro.
 */
function useMaintenanceInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: FLEET_MAINTENANCE_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: FLEET_QUERY_KEY });
  };
}

export function useCreatePlanTask() {
  const invalidate = useMaintenanceInvalidation();

  return useMutation<MaintenancePlanTask, ApiError, CreatePlanTaskInput>({
    mutationFn: createPlanTask,
    onSuccess: invalidate,
  });
}

export function useUpdatePlanTask() {
  const invalidate = useMaintenanceInvalidation();

  return useMutation<MaintenancePlanTask, ApiError, { id: string; input: UpdatePlanTaskInput }>({
    mutationFn: ({ id, input }) => updatePlanTask(id, input),
    onSuccess: invalidate,
  });
}

export function useRecordMaintenanceService() {
  const invalidate = useMaintenanceInvalidation();

  return useMutation<MaintenanceLog[], ApiError, CreateMaintenanceLogInput>({
    mutationFn: recordMaintenanceService,
    onSuccess: invalidate,
  });
}

export function useCreateFleetExpense() {
  const invalidate = useMaintenanceInvalidation();

  return useMutation<FleetExpenseRow, ApiError, CreateFleetExpenseInput>({
    mutationFn: createFleetExpense,
    onSuccess: invalidate,
  });
}

export function useUpdateFleetExpense() {
  const invalidate = useMaintenanceInvalidation();

  return useMutation<FleetExpenseRow, ApiError, { id: string; input: UpdateFleetExpenseInput }>({
    mutationFn: ({ id, input }) => updateFleetExpense(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteFleetExpense() {
  const invalidate = useMaintenanceInvalidation();

  return useMutation<void, ApiError, string>({
    mutationFn: deleteFleetExpense,
    onSuccess: invalidate,
  });
}
