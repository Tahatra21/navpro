"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminFilterBar,
  AdminPanelAlert,
  AdminPanelCard,
  AdminPanelSkeleton,
  adminSelectClass,
} from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminStatusBadge, activeBadge } from "@/components/admin/AdminStatusBadge";
import { navproApi } from "@/services/api";
import { useToast } from "@/components/shared/toast";
import { ORG_SEGMENTS } from "./constants";
import type { OrgUnitRow } from "./types";

type Props = { data: unknown; loading: boolean; onRefresh: () => void };

export function OrgPanel({ data, loading, onRefresh }: Props) {
  const units = ((data as { org_units?: OrgUnitRow[] })?.org_units || []) as OrgUnitRow[];
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [draft, setDraft] = useState({
    id: "",
    code: "",
    name: "",
    type: "SBU",
    segment: "ENT2",
    is_active: true,
  });

  const filtered = typeFilter ? units.filter((u) => u.type === typeFilter) : units;

  const runBackfill = async () => {
    const ok = window.confirm(
      "Backfill org_unit/segment pada proyek yang belum punya, berdasarkan org unit pembuat proyek. Lanjutkan?"
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await navproApi.adminBackfillProjectsOrg();
      toast.success(`Backfill selesai: ${res.updated} proyek diperbarui.`);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal backfill proyek.");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => {
    setErr("");
    setMode("create");
    setDraft({ id: "", code: "", name: "", type: "SBU", segment: "ENT2", is_active: true });
    setOpen(true);
  };

  const openEdit = (u: OrgUnitRow) => {
    setErr("");
    setMode("edit");
    setDraft({
      id: u.id,
      code: u.code,
      name: u.name,
      type: u.type,
      segment: u.segment,
      is_active: u.is_active !== false,
    });
    setOpen(true);
  };

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        type: draft.type,
        segment: draft.segment,
        is_active: draft.is_active,
      };
      if (!payload.code || !payload.name) throw new Error("Kode dan nama wajib diisi.");
      if (mode === "create") {
        await navproApi.adminCreateOrgUnit(payload);
        toast.success("Unit organisasi dibuat.");
      } else {
        await navproApi.adminUpdateOrgUnit(draft.id, payload);
        toast.success("Unit organisasi diperbarui.");
      }
      setOpen(false);
      onRefresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan unit.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan unit.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: OrgUnitRow) => {
    if (!confirm(`Hapus/nonaktifkan unit ${u.code}?`)) return;
    setBusy(true);
    try {
      const res = await navproApi.adminDeleteOrgUnit(u.id);
      toast.success(res.message || (res.soft_deleted ? "Unit dinonaktifkan." : "Unit dihapus."));
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus unit.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <AdminPanelSkeleton cards={1} />;

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={adminSelectClass}>
          <option value="">Semua tipe</option>
          <option value="PUSAT">PUSAT</option>
          <option value="SBU">SBU</option>
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} unit</span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} disabled={busy}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Unit
          </Button>
          <Button variant="outline" size="sm" onClick={runBackfill} disabled={busy}>
            Backfill Proyek
          </Button>
        </div>
      </AdminFilterBar>

      {err ? <AdminPanelAlert variant="error">{err}</AdminPanelAlert> : null}

      <AdminPanelCard
        title="Unit organisasi"
        description="Pusat & SBU untuk segmentasi proyek"
        icon={Building2}
        accent="violet"
        badge={`${filtered.length} unit`}
      >
        <AdminDataTable
        columns={[
          {
            id: "code",
            header: "Kode",
            cell: (u) => <span className="font-mono text-sm font-medium">{u.code}</span>,
          },
          { id: "name", header: "Nama unit", cell: (u) => u.name },
          {
            id: "type",
            header: "Tipe",
            cell: (u) => <AdminStatusBadge label={u.type} variant="info" />,
          },
          { id: "segment", header: "Segment", cell: (u) => u.segment },
          {
            id: "status",
            header: "Status",
            cell: (u) => activeBadge(u.is_active !== false),
          },
          {
            id: "actions",
            header: "Aksi",
            headerClassName: "text-right",
            className: "text-right",
            cell: (u) => (
              <div className="flex justify-end gap-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(u)} disabled={busy}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => remove(u)} disabled={busy}>
                  Hapus
                </Button>
              </div>
            ),
          },
        ]}
        data={filtered}
        getRowKey={(u) => u.id}
        pageSize={10}
        resetKey={typeFilter}
        emptyTitle="Belum ada unit organisasi"
        emptyDescription="Tambah unit Pusat atau SBU untuk segmentasi proyek."
        />
      </AdminPanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah Unit Organisasi" : "Edit Unit Organisasi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Kode</Label>
              <Input
                value={draft.code}
                onChange={(e) => setDraft((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
                placeholder="REG-SBU"
              />
            </div>
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input value={draft.name} onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipe</Label>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft((s) => ({ ...s, type: e.target.value }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="PUSAT">PUSAT</option>
                  <option value="SBU">SBU</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Segment</Label>
                <select
                  value={draft.segment}
                  onChange={(e) => setDraft((s) => ({ ...s, segment: e.target.value }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  {ORG_SEGMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {mode === "edit" && (
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  value={draft.is_active ? "true" : "false"}
                  onChange={(e) => setDraft((s) => ({ ...s, is_active: e.target.value === "true" }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
