"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

export type AdminColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type Props<T> = {
  columns: AdminColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  pageSize?: number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Reset ke halaman 1 saat filter berubah */
  resetKey?: string;
  className?: string;
  /** Server-side: `data` = satu halaman, `totalCount` = total baris di DB */
  paginationMode?: "client" | "server";
  totalCount?: number;
  page?: number;
  onPageChange?: (page: number) => void;
};

export function AdminDataTable<T>({
  columns,
  data,
  getRowKey,
  pageSize = 10,
  loading = false,
  emptyTitle = "Tidak ada data",
  emptyDescription,
  resetKey = "",
  className,
  paginationMode = "client",
  totalCount,
  page: controlledPage,
  onPageChange,
}: Props<T>) {
  const [internalPage, setInternalPage] = useState(1);
  const isServer = paginationMode === "server";
  const page = isServer ? (controlledPage ?? 1) : internalPage;

  const setPage = (next: number | ((p: number) => number)) => {
    const resolved = typeof next === "function" ? next(page) : next;
    if (isServer) onPageChange?.(resolved);
    else setInternalPage(resolved);
  };

  useEffect(() => {
    if (isServer) onPageChange?.(1);
    else setInternalPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey = filter change
  }, [resetKey, isServer]);

  const rowCount = isServer ? (totalCount ?? 0) : data.length;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    if (isServer) return data;
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, isServer, safePage, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
        ))}
      </div>
    );
  }

  if (rowCount === 0) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const from = rowCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, rowCount);
  const showPagination = isServer ? rowCount > 0 : totalPages > 1;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn("px-3 py-2.5 font-medium whitespace-nowrap", col.headerClassName)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={getRowKey(row)} className="border-t border-border/50 align-middle hover:bg-muted/20">
                {columns.map((col) => (
                  <td key={col.id} className={cn("px-3 py-2.5", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Menampilkan {from}–{to} dari {rowCount} baris
        </span>
        {showPagination ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={safePage <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4.5rem] text-center tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={safePage >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
