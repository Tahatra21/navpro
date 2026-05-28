"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { canCreateProject } from "@/lib/rbac";
import { offlineGetProjects, offlineSaveProjects } from "@/lib/offline-cache";
import type { User } from "@/types/navpro";

export default function ProjectsPage() {
  const router = useRouter();
  const user = useAuthStore((s: { user: User | null }) => s.user);
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [durationFilter, setDurationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", search, statusFilter, durationFilter, categoryFilter],
    queryFn: () =>
      navproApi.getProjects({
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(durationFilter ? { duration_months: durationFilter } : {}),
        ...(categoryFilter ? { duration_category: categoryFilter } : {}),
      }),
    enabled: backendOnline === true,
  });

  const onlineProjects = data?.projects || [];
  if (backendOnline === true && onlineProjects.length) {
    offlineSaveProjects(onlineProjects);
  }
  const projects = backendOnline === true ? onlineProjects : offlineGetProjects();
  const total = projects.length;
  const allMode = pageSize === -1;
  const pages = allMode ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = allMode ? 0 : (safePage - 1) * pageSize;
  const pageItems = allMode ? projects : projects.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daftar Proyek</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola usulan kajian kelayakan finansial (KKF) di NAVPRO
          </p>
        </div>
        {canCreateProject(user?.role) && (
          <Button className="btn-navpro shrink-0" onClick={() => router.push("/projects/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Proyek Baru
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama proyek…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua Status</option>
          <option value="DRAFT">Draf</option>
          <option value="COMPUTED">Terhitung</option>
          <option value="SUBMITTED">Diajukan</option>
          <option value="UNDER_REVIEW">Review</option>
          <option value="APPROVED_L1">L1 Disetujui</option>
          <option value="APPROVED_FINAL">Disetujui Final</option>
          <option value="REJECTED">Ditolak</option>
        </select>
        <select
          value={durationFilter}
          onChange={(e) => setDurationFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua Durasi</option>
          {[12, 24, 36, 60, 120].map((m) => (
            <option key={m} value={String(m)}>
              {m} bulan
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Semua Kategori</option>
          <option value="SHORT_TERM">Short Term</option>
          <option value="MID_TERM">Mid Term</option>
          <option value="LONG_TERM">Long Term</option>
          <option value="EXTENDED">Extended</option>
        </select>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Memuat…" : `Total ${total} proyek`}
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
          <p className="p-8 text-sm text-muted-foreground text-center">Memuat daftar proyek…</p>
        ) : (
          <>
            <ProjectTable projects={pageItems} />
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
