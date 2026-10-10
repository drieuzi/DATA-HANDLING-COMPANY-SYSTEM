import { useEffect, useMemo, useState } from "react";

export const TABLE_PAGE_SIZE = 30;

export default function useTablePagination(items, resetDependencies = []) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / TABLE_PAGE_SIZE));

  useEffect(() => setCurrentPage(1), resetDependencies);
  useEffect(() => setCurrentPage((page) => Math.min(page, totalPages)), [totalPages]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return items.slice(start, start + TABLE_PAGE_SIZE);
  }, [items, currentPage]);

  return { currentPage, setCurrentPage, totalPages, pageItems };
}
