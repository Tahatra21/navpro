"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ApprovalQueueTable } from "@/components/dashboard/ApprovalQueueTable";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { mapV2QueueToItems } from "@/lib/approval-queue";
import { usesV2ApprovalsQueue } from "@/lib/rbac";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApprovalsPage() {
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const user = useAuthStore((s: { user: import("@/types/navpro").User | null }) => s.user);
  const useV2 = usesV2ApprovalsQueue(user?.role);

  const [search, setSearch] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const { data: v2Data, isLoading: v2Loading } = useQuery({
    queryKey: ["approvals-queue-v2"],
    queryFn: () => navproApi.getApprovalsQueue(),
    enabled: backendOnline === true && useV2,
  });

  const { data: legacyData, isLoading: legacyLoading } = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => navproApi.getDashboardApprovalQueue(),
    enabled: backendOnline === true && !useV2,
  });

  const items = useMemo(() => {
    if (useV2) return mapV2QueueToItems(v2Data?.items || []);
    return legacyData?.items || [];
  }, [useV2, v2Data?.items, legacyData?.items]);

  const isLoading = useV2 ? v2Loading : legacyLoading;

  const filtered = useMemo(() => {
    let list = items;
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (it) =>
          it.project_code.toLowerCase().includes(q) ||
          it.project_name.toLowerCase().includes(q)
      );
    }
    if (overdueFilter === "OVERDUE") list = list.filter((it) => it.sla_overdue);
    if (overdueFilter === "ON_TIME") list = list.filter((it) => !it.sla_overdue);
    if (statusFilter) list = list.filter((it) => it.status === statusFilter);
    if (levelFilter) list = list.filter((it) => it.approver_level === levelFilter);
    return list;
  }, [items, search, overdueFilter, statusFilter, levelFilter]);

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
          {useV2
            ? "KKF yang menunggu tindakan Anda (Asman / Manager) — BRD v2.0"
            : "Daftar proyek yang menunggu persetujuan sesuai role Anda, diurutkan berdasarkan SLA Due"}
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
        {useV2 && (
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Semua Level</option>
            <option value="ASMAN">Asman</option>
            <option value="MANAGER">Manager</option>
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua Status</option>
          {useV2 ? (
            <>
              <option value="IN_REVIEW_ASMAN">Review Asman</option>
              <option value="IN_REVIEW_MANAGER">Review Manager</option>
            </>
          ) : (
            <>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED_L1">Approved L1</option>
            </>
          )}
        </select>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Memuat antrian approval…"
            : total === 0
              ? "Tidak ada item approval untuk filter ini."
              : `Total ${total} item`}
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {safePage}/{pages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
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
