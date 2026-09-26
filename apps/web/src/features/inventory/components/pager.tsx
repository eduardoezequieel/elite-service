'use client';

import type { Page } from '@elite/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { pageCount, pageSummary } from '../format';

/**
 * El pie de una lista paginada (kardex, artículos, reporte): cuántas filas hay
 * y a qué página se va. Sin una sola página de más, no dibuja botones.
 */
export function Pager<T>({
  page,
  noun,
  onPageChange,
}: {
  page: Page<T> | undefined;
  noun: { one: string; many: string };
  onPageChange: (page: number) => void;
}) {
  if (page === undefined) return null;

  const pages = pageCount(page);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-text-dim text-dense tabular-nums" role="status">
        {pageSummary(page, noun)}
      </p>

      {pages <= 1 ? null : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page.page <= 1}
            onClick={() => onPageChange(page.page - 1)}
          >
            <ChevronLeft strokeWidth={1.5} aria-hidden />
            Anterior
          </Button>
          <span className="text-text-faint text-dense tabular-nums">
            {page.page} de {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page.page >= pages}
            onClick={() => onPageChange(page.page + 1)}
          >
            Siguiente
            <ChevronRight strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
