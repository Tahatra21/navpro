"use client";

import { useState } from "react";
import { Clock, Plus } from "lucide-react";
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
} from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminStatusBadge, activeBadge } from "@/components/admin/AdminStatusBadge";
import { navproApi } from "@/services/api";
import type { DurationPreset } from "./types";

type Props = { data: unknown; loading: boolean; onRefresh: () => void };

export function PresetsPanel({ data, loading, onRefresh }: Props) {
  const presets = ((data as { presets?: DurationPreset[] })?.presets || []) as DurationPreset[];
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [draft, setDraft] = useState<{
    id: string;
    preset_name: string;
    duration_months: number | string;
    category: string;
    bcr_mandatory: number | string;
    bcr_minimum: number | string;
    is_active: boolean;
  }>({
    id: "",
    preset_name: "",
    duration_months: 12,
    category: "SHORT_TERM",
    bcr_mandatory: 1.23,
    bcr_minimum: 1.08,
    is_active: true,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <AdminPanelSkeleton cards={1} />;

  const openCreate = () => {
    setErr("");
    setMode("create");
    setDraft({
      id: "",
      preset_name: "",
      duration_months: 12,
      category: "SHORT_TERM",
      bcr_mandatory: 1.23,
      bcr_minimum: 1.08,
      is_active: true,
    });
    setOpen(true);
  };

  const openEdit = (p: DurationPreset) => {
    setErr("");
    setMode("edit");
    setDraft({
      id: p.id,
      preset_name: p.preset_name,
      duration_months: p.duration_months,
      category: p.category,
      bcr_mandatory: Number(p.bcr_mandatory),
      bcr_minimum: Number(p.bcr_minimum),
      is_active: !!p.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        preset_name: String(draft.preset_name || "").trim(),
        duration_months: Number(draft.duration_months),
        category: String(draft.category || "SHORT_TERM"),
        bcr_mandatory: Number(draft.bcr_mandatory),
        bcr_minimum: Number(draft.bcr_minimum),
        is_active: !!draft.is_active,
      };
      if (!payload.preset_name) throw new Error("Nama preset wajib diisi.");
      if (!Number.isFinite(payload.duration_months) || payload.duration_months < 1 || payload.duration_months > 120)
        throw new Error("Durasi harus 1–120 bulan.");
      if (!Number.isFinite(payload.bcr_mandatory) || !Number.isFinite(payload.bcr_minimum))
        throw new Error("BCR mandatory/minimum harus angka.");

      if (mode === "create") {
        await navproApi.adminCreatePreset({ ...payload, id: draft.id || undefined });
      } else {
        await navproApi.adminUpdatePreset(String(draft.id), payload);
      }
      setOpen(false);
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal menyimpan preset.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Nonaktifkan preset ini?")) return;
    setBusy(true);
    setErr("");
    try {
      await navproApi.adminDeactivatePreset(id);
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal menonaktifkan preset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <p className="text-xs text-muted-foreground">{presets.length} preset durasi</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Preset
          </Button>
        </div>
      </AdminFilterBar>

      {err ? <AdminPanelAlert variant="error">{err}</AdminPanelAlert> : null}

      <AdminPanelCard
        title="Duration presets"
        description="Opsi durasi & threshold BCR di wizard proyek"
        icon={Clock}
        accent="sky"
        badge={`${presets.length} preset`}
      >
        <AdminDataTable
        columns={[
          {
            id: "name",
            header: "Preset",
            cell: (p) => (
              <div>
                <p className="font-medium">{p.preset_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
              </div>
            ),
          },
          {
            id: "duration",
            header: "Durasi",
            cell: (p) => `${p.duration_months} bln`,
          },
          {
            id: "category",
            header: "Kategori",
            cell: (p) => <AdminStatusBadge label={p.category} variant="info" />,
          },
          {
            id: "bcr",
            header: "BCR min / mand",
            cell: (p) => (
              <span className="text-xs tabular-nums">
                {Number(p.bcr_minimum).toFixed(2)} / {Number(p.bcr_mandatory).toFixed(2)}
              </span>
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: (p) => activeBadge(!!p.is_active),
          },
          {
            id: "actions",
            header: "Aksi",
            headerClassName: "text-right",
            className: "text-right",
            cell: (p) => (
              <div className="flex justify-end gap-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)} disabled={busy}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deactivate(p.id)}
                  disabled={busy || !p.is_active}
                >
                  Off
                </Button>
              </div>
            ),
          },
        ]}
        data={presets}
        getRowKey={(p) => p.id}
        pageSize={8}
        emptyTitle="Belum ada preset"
        emptyDescription="Tambah preset untuk opsi durasi di wizard proyek."
        />
      </AdminPanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah Preset" : "Edit Preset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mode === "create" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ID (opsional)</Label>
                <Input value={draft.id} onChange={(e) => setDraft((s) => ({ ...s, id: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Nama Preset</Label>
              <Input
                value={draft.preset_name}
                  onChange={(e) => setDraft((s) => ({ ...s, preset_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Durasi (bulan)</Label>
                <Input
                  inputMode="numeric"
                  value={String(draft.duration_months)}
                  onChange={(e) => setDraft((s) => ({ ...s, duration_months: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Kategori</Label>
                <Input value={draft.category} onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>BCR Mandatory</Label>
                <Input
                  inputMode="decimal"
                  value={String(draft.bcr_mandatory)}
                  onChange={(e) => setDraft((s) => ({ ...s, bcr_mandatory: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>BCR Minimum</Label>
                <Input
                  inputMode="decimal"
                  value={String(draft.bcr_minimum)}
                  onChange={(e) => setDraft((s) => ({ ...s, bcr_minimum: e.target.value }))}
                />
              </div>
            </div>
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
