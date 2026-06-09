"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminFilterBar,
  AdminPanelAlert,
  AdminPanelCard,
  AdminPanelSkeleton,
  adminSelectClass,
} from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import type { AuditLogRow } from "./types";

const PAGE_SIZE_OPTIONS = [3, 5, 10, 15, 25, 50] as const;

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function parseTotal(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function AuditPanel() {
  const backendOnline = useAuthStore((s) => s.backendOnline);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const debouncedQ = useDebouncedValue(q);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, action, pageSize]);

  const auditQuery = useQuery({
    queryKey: ["admin-audit", page, pageSize, debouncedQ, action],
    queryFn: () =>
      navproApi.adminGetAuditLogs({
        page,
        pageSize,
        search: debouncedQ,
        action,
      }),
    enabled: backendOnline === true,
    placeholderData: keepPreviousData,
  });

  const logs = (auditQuery.data?.logs ?? []) as AuditLogRow[];
  const total = parseTotal(auditQuery.data?.total, logs.length);
  const actions = auditQuery.data?.actions ?? [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isInitialLoad = auditQuery.isLoading && !auditQuery.data;

  if (isInitialLoad) return <AdminPanelSkeleton cards={1} />;

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari user, aksi, proyek…"
            className="w-[220px]"
          />
          <select value={action} onChange={(e) => setAction(e.target.value)} className={adminSelectClass}>
            <option value="">Semua aksi</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className={adminSelectClass}
            aria-label="Baris per halaman"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => auditQuery.refetch()} disabled={auditQuery.isFetching}>
            {auditQuery.isFetching ? "Memuat…" : "Reload"}
          </Button>
        </div>
        {total > 0 ? (
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {total} log · halaman {Math.min(page, totalPages)} / {totalPages}
          </p>
        ) : null}
      </AdminFilterBar>

      {auditQuery.isError ? (
        <AdminPanelAlert variant="error">
          {auditQuery.error instanceof Error ? auditQuery.error.message : "Gagal memuat audit log."}
        </AdminPanelAlert>
      ) : null}

      <AdminPanelCard
        title="Audit log"
        description="Jejak aktivitas pengguna dan sistem"
        icon={ClipboardList}
        accent="muted"
        badge={total > 0 ? `${total} log` : undefined}
      >
        <AdminDataTable
        columns={[
          {
            id: "time",
            header: "Waktu",
            cell: (l) => <span className="text-xs text-muted-foreground whitespace-nowrap">{l.timestamp}</span>,
          },
          { id: "user", header: "User", cell: (l) => l.user || "—" },
          {
            id: "action",
            header: "Aksi",
            cell: (l) => <AdminStatusBadge label={l.action} variant="muted" />,
          },
          {
            id: "project",
            header: "Proyek",
            cell: (l) =>
              l.project_id ? (
                <span className="font-mono text-xs text-muted-foreground">{l.project_id.slice(0, 8)}…</span>
              ) : (
                "—"
              ),
          },
        ]}
        data={logs}
        getRowKey={(l) => l.id}
        pageSize={pageSize}
        loading={isInitialLoad}
        paginationMode="server"
        totalCount={total}
        page={page}
        onPageChange={setPage}
        resetKey={`${debouncedQ}-${action}-${pageSize}`}
        emptyTitle="Tidak ada log"
        emptyDescription="Coba ubah filter atau reload data."
        />
      </AdminPanelCard>
    </div>
  );
}
