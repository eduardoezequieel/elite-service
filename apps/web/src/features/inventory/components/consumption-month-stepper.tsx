'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  consumptionMonthTitle,
  isAfterCurrentMonth,
  shiftConsumptionMonth,
  type ConsumptionMonth,
} from '../consumption';

/**
 * Anterior · mes · siguiente (070). Los botones son `size="icon"`, que en la
 * bahía llegan a `--control-h` (48px), y la cifra del mes reserva
 * `--touch-min` de alto: todo se toca con el dedo. No se pasa del mes en curso.
 */
export function ConsumptionMonthStepper({
  month,
  onChange,
}: {
  month: ConsumptionMonth;
  onChange: (month: ConsumptionMonth) => void;
}) {
  const next = shiftConsumptionMonth(month, 1);

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Mes">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes anterior"
        onClick={() => onChange(shiftConsumptionMonth(month, -1))}
      >
        <ChevronLeft strokeWidth={1.5} aria-hidden />
      </Button>
      <p
        className="text-text text-body flex min-h-(--touch-min) min-w-40 items-center justify-center px-2 font-semibold tabular-nums"
        aria-live="polite"
      >
        {consumptionMonthTitle(month)}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes siguiente"
        disabled={isAfterCurrentMonth(next)}
        onClick={() => onChange(next)}
      >
        <ChevronRight strokeWidth={1.5} aria-hidden />
      </Button>
    </div>
  );
}
