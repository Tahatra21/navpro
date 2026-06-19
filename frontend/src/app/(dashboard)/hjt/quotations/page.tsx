"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSizeSelect, TablePagination } from "@/components/shared/TablePagination";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { canEditHjtQuotation } from "@/lib/rbac";

function hjtStatusLabel(status: string, rejectedNote?: string | null) {
  if (status === "rejected" && rejectedNote?.toLowerCase().includes("tidak layak")) {
    return "TIDAK_LAYAK";
  }
  return status.toUpperCase();
}

export default function HjtQuotationsPage() {
  const user = useAuthStore((s) => s.user);
  const backendOnline = useAuthStore((s) => s.backendOnline);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["hjt-quotations", search, statusFilter],
    queryFn: () =>
      navproApi.hjtListQuotations({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        limit: -1,
      }),
    enabled: backendOnline === true,
  });

  const quotations = data?.quotations ?? [];
  const total = quotations.length;
  const allMode = pageSize === -1;
  const pages = allMode ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = allMode ? 0 : (safePage - 1) * pageSize;
  const pageItems = allMode ? quotations : quotations.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calc HJT</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Penawaran resmi connectivity — terpisah dari KKF proyek
          </p>
        </div>
        {canEditHjtQuotation(user?.role) ? (
          <Button asChild className="shrink-0">
            <Link href="/hjt/quotations/new">
              <Plus className="w-4 h-4 mr-2" />
              Penawaran baru
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari pelanggan, no. kontrak, atau region…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua Status</option>
          <option value="draft">Draf</option>
          <option value="submitted">Diajukan</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Tidak layak / Ditolak</option>
        </select>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Memuat…" : `Total ${total} penawaran`}
        </p>
        <PageSizeSelect
          pageSize={pageSize}
          onChange={(v) => {
            setPageSize(v);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-sm text-muted-foreground text-center">Memuat daftar penawaran…</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Pelanggan</th>
                  <th className="px-4 py-3 font-medium">No. kontrak</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Grand Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Diperbarui</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {search || statusFilter ? "Tidak ada penawaran cocok." : "Belum ada penawaran."}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((q) => (
                    <tr key={q.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/hjt/quotations/${q.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {q.customer_name || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{q.contract_no || "—"}</td>
                      <td className="px-4 py-3">{q.region_code || "—"}</td>
                      <td className="px-4 py-3 capitalize">{q.calc_mode?.replace("_", " ")}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {q.grand_total_all != null ? formatCurrency(Number(q.grand_total_all)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <HjtStatusBadge status={hjtStatusLabel(q.status, q.rejected_note)} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(q.updated_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              disabled={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

function HjtStatusBadge({ status }: { status: string }) {
  if (status === "TIDAK_LAYAK") {
    return (
      <span className="inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-orange-500/10 text-orange-800 border-orange-500/30">
        Tidak layak
      </span>
    );
  }
  return <StatusBadge status={status} />;
}
