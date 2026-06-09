"use client";

import { useEffect, useState } from "react";
import { Timer, Plus } from "lucide-react";
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
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { navproApi } from "@/services/api";
import { useToast } from "@/components/shared/toast";
import type { SlaRow } from "./types";

type SlaDraftRow = {
  role_key: string;
  role_name: string;
  sla_working_days: string;
  reminder_hours: string;
  escalation_hours: string;
  escalate_to_role: string;
  preview_due_at?: string;
};

function mapItems(rows: SlaRow[]): SlaDraftRow[] {
  return rows.map((r) => ({
    role_key: r.role_key,
    role_name: r.role_name,
    sla_working_days: String(r.sla_working_days ?? 2),
    reminder_hours: String(r.reminder_hours ?? 24),
    escalation_hours: String(r.escalation_hours ?? 48),
    escalate_to_role: r.escalate_to_role ?? "",
  }));
}

const EMPTY_DRAFT: SlaDraftRow = {
  role_key: "",
  role_name: "",
  sla_working_days: "2",
  reminder_hours: "24",
  escalation_hours: "48",
  escalate_to_role: "",
};

type Props = {
  data: unknown;
  loading: boolean;
  onRefresh: () => void;
};

export function SlaPanel({ data, loading, onRefresh }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<SlaDraftRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<SlaDraftRow>(EMPTY_DRAFT);

  useEffect(() => {
    if (loading) return;
    const sla = ((data as { sla?: SlaRow[] })?.sla ?? []) as SlaRow[];
    setRows(mapItems(sla));
  }, [loading, data]);

  if (loading) return <AdminPanelSkeleton cards={1} />;

  const openNew = () => {
    setEditIdx(null);
    setDraft({ ...EMPTY_DRAFT });
    setErr("");
    setOpen(true);
  };

  const openEdit = (idx: number) => {
    setEditIdx(idx);
    setDraft({ ...rows[idx] });
    setErr("");
    setOpen(true);
  };

  const saveDialog = async () => {
    setErr("");
    setBusy(true);
    try {
      if (!draft.role_key.trim()) throw new Error("Role key wajib diisi.");
      await navproApi.adminSaveSla(draft.role_key.trim(), {
        role_name: draft.role_name,
        sla_working_days: Number(draft.sla_working_days),
        reminder_hours: Number(draft.reminder_hours),
        escalation_hours: Number(draft.escalation_hours),
        escalate_to_role: draft.escalate_to_role || null,
      });
      toast.success(`SLA ${draft.role_key} tersimpan.`);
      setOpen(false);
      onRefresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan SLA.");
    } finally {
      setBusy(false);
    }
  };

  const previewDue = async (roleKey: string) => {
    if (!roleKey.trim()) return;
    setBusy(true);
    try {
      const res = await navproApi.adminPreviewSlaDue(roleKey.trim());
      toast.info(`Preview due: ${new Date(res.due_at).toLocaleString("id-ID")}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal preview SLA.");
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (roleKey: string) => {
    if (!roleKey || !confirm(`Hapus konfigurasi SLA untuk ${roleKey}?`)) return;
    setBusy(true);
    try {
      await navproApi.adminDeleteSla(roleKey);
      toast.success("SLA dihapus.");
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus SLA.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <p className="text-xs text-muted-foreground">{rows.length} konfigurasi SLA</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
            Refresh
          </Button>
          <Button size="sm" onClick={openNew} disabled={busy}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Role
          </Button>
        </div>
      </AdminFilterBar>

      {err && !open ? <AdminPanelAlert variant="error">{err}</AdminPanelAlert> : null}

      <AdminPanelCard
        title="SLA Approval"
        description="Batas waktu kerja per role approver"
        icon={Timer}
        accent="amber"
        badge={`${rows.length} role`}
      >
        <AdminDataTable
        columns={[
          {
            id: "role",
            header: "Role",
            cell: (r) => (
              <div>
                <p className="font-medium">{r.role_name || r.role_key}</p>
                <p className="font-mono text-xs text-muted-foreground">{r.role_key}</p>
              </div>
            ),
          },
          {
            id: "sla",
            header: "SLA (hari kerja)",
            cell: (r) => `${r.sla_working_days} hari`,
          },
          {
            id: "reminder",
            header: "Reminder",
            cell: (r) => `${r.reminder_hours} jam`,
          },
          {
            id: "escalation",
            header: "Eskalasi",
            cell: (r) => `${r.escalation_hours} jam`,
          },
          {
            id: "to",
            header: "Eskalasi ke",
            cell: (r) =>
              r.escalate_to_role ? (
                <AdminStatusBadge label={r.escalate_to_role} variant="info" />
              ) : (
                "—"
              ),
          },
          {
            id: "actions",
            header: "Aksi",
            headerClassName: "text-right",
            className: "text-right",
            cell: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="outline" size="sm" onClick={() => previewDue(r.role_key)} disabled={busy}>
                  Preview
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(r._idx)} disabled={busy}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteRow(r.role_key)}
                  disabled={busy || !r.role_key}
                >
                  Hapus
                </Button>
              </div>
            ),
          },
        ]}
        data={rows.map((r, idx) => ({ ...r, _idx: idx }))}
        getRowKey={(r) => r.role_key || `new-${r._idx}`}
        pageSize={8}
        emptyTitle="Belum ada SLA"
        emptyDescription="Tambah role untuk mengatur batas waktu approval."
        />
      </AdminPanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editIdx == null ? "Tambah SLA Role" : "Edit SLA Role"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Role key</Label>
              <Input
                value={draft.role_key}
                onChange={(e) => setDraft((s) => ({ ...s, role_key: e.target.value.toUpperCase() }))}
                disabled={editIdx != null}
                placeholder="MANAGER"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nama role</Label>
              <Input
                value={draft.role_name}
                onChange={(e) => setDraft((s) => ({ ...s, role_name: e.target.value }))}
                placeholder="Manager"
              />
            </div>
            <div className="space-y-1">
              <Label>SLA (hari kerja)</Label>
              <Input
                inputMode="numeric"
                value={draft.sla_working_days}
                onChange={(e) => setDraft((s) => ({ ...s, sla_working_days: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Reminder (jam)</Label>
              <Input
                inputMode="numeric"
                value={draft.reminder_hours}
                onChange={(e) => setDraft((s) => ({ ...s, reminder_hours: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Eskalasi (jam)</Label>
              <Input
                inputMode="numeric"
                value={draft.escalation_hours}
                onChange={(e) => setDraft((s) => ({ ...s, escalation_hours: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Eskalasi ke role</Label>
              <Input
                value={draft.escalate_to_role}
                onChange={(e) => setDraft((s) => ({ ...s, escalate_to_role: e.target.value.toUpperCase() }))}
                placeholder="GM_SRM"
              />
            </div>
          </div>
          {err && open && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={saveDialog} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
