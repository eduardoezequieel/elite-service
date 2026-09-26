'use client';

import { API_ERROR_CODES } from '@elite/shared';
import type { InventoryItemOption, PriceAuthorizationInput } from '@elite/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { ApiError } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  applyStockConflict,
  cartTotalCents,
  insufficientStockOf,
  lineFromOption,
  needsPriceAuthorization,
  productsBlocker,
  setQuantity,
  stepCart,
  syncStock,
  type CartLine,
} from '../sale-cart';
import { useSellableItems } from './use-sales';

/** Códigos del API que dicen «la firma del precio no sirve»: se vuelve a pedir. */
const SIGNATURE_ERRORS: readonly string[] = [
  API_ERROR_CODES.AUTHORIZATION_FAILED,
  API_ERROR_CODES.PRICE_ABOVE_CATALOG,
];

/** Los productos sueltos de una cuenta mientras se arman en pantalla (065, 066). */
export interface AccountProducts {
  term: string;
  setTerm: (value: string) => void;
  options: UseQueryResult<InventoryItemOption[], ApiError>;
  lines: CartLine[];
  totalCents: number;
  /** Lo que los productos no dejan cobrar todavía, o `null`. */
  blocker: string | null;
  priceAuthorization: PriceAuthorizationInput | null;
  setPriceAuthorization: (value: PriceAuthorizationInput | null) => void;
  edit: (next: (previous: CartLine[]) => CartLine[]) => void;
  step: (option: InventoryItemOption, delta: 1 | -1) => void;
  setOptionQuantity: (option: InventoryItemOption, milli: number) => void;
  /** Lee el rechazo del API: «Hay N» en la línea que no alcanzó y la contraseña fuera. */
  absorbError: (error: ApiError) => void;
  reset: () => void;
}

/**
 * El borrador de productos sueltos, igual en «Nueva venta» y en el cobro del
 * lavado (066): buscador con «Hay N» al día, `− +`, candado de precio con una
 * sola firma para todas las líneas rebajadas, y lo que el API rechazó anotado
 * en la línea. Nada se guarda hasta cobrar (065 RN-18).
 *
 * `enabled` apaga el buscador mientras el bloque no está a la vista, y
 * `onEdit` avisa cada cambio, para que la pantalla deje atrás un error viejo.
 */
export function useAccountProducts({
  enabled = true,
  onEdit,
}: { enabled?: boolean; onEdit?: () => void } = {}): AccountProducts {
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const options = useSellableItems(search, enabled);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [priceAuthorization, setPriceAuthorization] = useState<PriceAuthorizationInput | null>(
    null,
  );
  const fresh = options.data;

  // «Hay N» al día mientras se arma la cuenta: lo que trae el buscador pone al
  // día las líneas que ya están.
  useEffect(() => {
    if (fresh === undefined) return;

    setLines((previous) => {
      const next = syncStock(previous, fresh);
      const changed = next.some((line, index) => line !== previous[index]);

      return changed ? next : previous;
    });
  }, [fresh]);

  // Una firma sin líneas rebajadas no tiene qué firmar: se descarta.
  const discounted = needsPriceAuthorization(lines);

  useEffect(() => {
    if (!discounted) setPriceAuthorization(null);
  }, [discounted]);

  const edit = useCallback(
    (next: (previous: CartLine[]) => CartLine[]) => {
      setLines(next);
      onEdit?.();
    },
    [onEdit],
  );

  return {
    term,
    setTerm,
    options,
    lines,
    totalCents: cartTotalCents(lines),
    blocker: productsBlocker(lines, priceAuthorization),
    priceAuthorization,
    setPriceAuthorization,
    edit,
    step: (option, delta) => edit((previous) => stepCart(previous, option, delta)),
    setOptionQuantity: (option, milli) =>
      edit((previous) => {
        const present = previous.some((line) => line.itemId === option.id);
        const base = present || milli <= 0 ? previous : [...previous, lineFromOption(option)];

        return setQuantity(base, option.id, milli);
      }),
    absorbError: (error) => {
      const conflict = insufficientStockOf(error.code, error.details);

      if (conflict !== null) setLines((previous) => applyStockConflict(previous, conflict));

      // La contraseña del que autoriza no se queda escrita tras un rechazo
      // (045 RN-5): el botón vuelve a decir «Falta autorizar el precio».
      if (SIGNATURE_ERRORS.includes(error.code)) {
        setPriceAuthorization((previous) =>
          previous === null
            ? null
            : { ...previous, authorization: { ...previous.authorization, password: '' } },
        );
      }
    },
    reset: () => {
      setTerm('');
      setLines([]);
      setPriceAuthorization(null);
    },
  };
}
