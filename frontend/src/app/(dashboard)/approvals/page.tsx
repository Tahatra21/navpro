"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ApprovalQueueTable } from "@/components/dashboard/ApprovalQueueTable";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApprovalsPage() {
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const [search, setSearch] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const { data, isLoading } = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => navproApi.getDashboardApprovalQueue(),
    enabled: backendOnline === true,
  });

  const filtered = useMemo(() => {
    let items = data?.items || [];
    const q = search.toLowerCase().trim();
    if (q) {
      items = items.filter(
        (it) =>
          it.project_code.toLowerCase().includes(q) ||
          it.project_name.toLowerCase().includes(q)
      );
    }
    if (overdueFilter === "OVERDUE") items = items.filter((it) => it.sla_overdue);
    if (overdueFilter === "ON_TIME") items = items.filter((it) => !it.sla_overdue);
    if (statusFilter) items = items.filter((it) => it.status === statusFilter);
    return items;
  }, [data?.items, search, overdueFilter, statusFilter]);

  const total = filtered.length;
  const allMode = pageSize === -1;
  const pages = allMode ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = allMode ? 0 : (safePage - 1) * pageSize;
  const pageItems = allMode ? filtered : filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Approval Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Daftar proyek yang menunggu persetujuan sesuai role Anda, diurutkan berdasarkan SLA Due
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode / nama proyek…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={overdueFilter}
          onChange={(e) => setOverdueFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua SLA</option>
          <option value="OVERDUE">Overdue</option>
          <option value="ON_TIME">On Time</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua Status</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED_L1">Approved L1</option>
        </select>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Memuat antrian approval…" : total === 0 ? "Tidak ada item approval untuk filter ini." : `Total ${total} item`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tampilkan</span>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPageSize(v);
              setPage(1);
            }}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="-1">ALL</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-sm text-muted-foreground text-center">Memuat antrian approval…</p>
        ) : (
          <>
            <ApprovalQueueTable items={pageItems} />
            {!allMode && total > 0 && (
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border bg-card">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {start + 1}–{Math.min(start + pageSize, total)} dari {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {safePage}/{pages}
                  </span>
                  <Button size="sm" variant="outline" disabled={safePage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
