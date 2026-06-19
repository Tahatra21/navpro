"use client";

import { Button } from "@/components/ui/button";

type Props = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

/** Footer pagination — pola sama dengan Daftar Proyek. */
export function TablePagination({ total, page, pageSize, onPageChange, disabled }: Props) {
  const allMode = pageSize === -1;
  if (allMode || total === 0) return null;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize;

  return (
    <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border bg-card">
      <p className="text-xs text-muted-foreground">
        Menampilkan {start + 1}–{Math.min(start + pageSize, total)} dari {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Prev
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {safePage}/{pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || safePage >= pages}
          onClick={() => onPageChange(Math.min(pages, safePage + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function PageSizeSelect({
  pageSize,
  onChange,
}: {
  pageSize: number;
  onChange: (size: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Tampilkan</span>
      <select
        value={String(pageSize)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 px-3 rounded-md border border-input bg-background text-xs"
      >
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="-1">ALL</option>
      </select>
    </div>
  );
}
