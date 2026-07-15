import { useMemo, useState } from 'react';

export interface IPagination<T> {
  page: number;
  totalPages: number;
  pageItems: T[];
  onPrev: () => void;
  onNext: () => void;
  /** Jump back to page 1 — call when the underlying filter changes. */
  reset: () => void;
}

/**
 * Client-side pagination over an already-loaded list. The exposed page is
 * clamped to the list's real bounds, so a filter change that shrinks the list
 * can never strand the view on an empty page.
 */
export function usePagination<T>(
  items: T[],
  itemsPerPage: number,
): IPagination<T> {
  const [requestedPage, setRequestedPage] = useState(1);
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, totalPages));
  const pageItems = useMemo(
    () => items.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [items, page, itemsPerPage],
  );
  return {
    page,
    totalPages,
    pageItems,
    onPrev: () => setRequestedPage(Math.max(1, page - 1)),
    onNext: () => setRequestedPage(Math.min(totalPages, page + 1)),
    reset: () => setRequestedPage(1),
  };
}
