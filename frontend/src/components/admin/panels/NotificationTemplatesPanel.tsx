"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminPanelAlert, AdminPanelCard, AdminPanelSkeleton } from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { useToast } from "@/components/shared/toast";
import type { SystemConfigRow } from "./types";

type Props = {
  data: unknown;
  loading: boolean;
  onSave: (key: string, val: string) => Promise<void>;
};

export function NotificationTemplatesPanel({ data, loading, onSave }: Props) {
  const toast = useToast();
  const grouped: Record<string, SystemConfigRow[]> =
    (data as { grouped?: Record<string, SystemConfigRow[]> })?.grouped || {};
  const rows = grouped["NOTIFICATION_TEMPLATE"] || [];

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftVal, setDraftVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <AdminPanelSkeleton cards={1} />;
  if (!data) return <p className="text-sm text-muted-foreground">Template notifikasi tidak tersedia.</p>;

  const startEdit = (row: SystemConfigRow) => {
    setError("");
    setEditingKey(row.key);
    setDraftVal(row.val ?? "");
  };

  const save = async () => {
    if (!editingKey) return;
    setBusy(true);
    setError("");
    try {
      await onSave(editingKey, draftVal);
      toast.success("Template tersimpan.");
      setEditingKey(null);
      setDraftVal("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan template.");
    } finally {
      setBusy(false);
    }
  };

  const editingRow = rows.find((r) => r.key === editingKey);

  return (
    <div className="space-y-4">
      {error && !editingKey ? <AdminPanelAlert variant="error">{error}</AdminPanelAlert> : null}

      <AdminPanelCard
        title="Template notifikasi"
        description="Pesan email/in-app untuk event approval & SLA"
        icon={Bell}
        accent="violet"
        badge={`${rows.length} template`}
      >
        <AdminDataTable
          columns={[
            {
              id: "key",
              header: "Key",
              cell: (r) => <span className="font-mono text-xs">{r.key}</span>,
            },
            {
              id: "preview",
              header: "Preview",
              cell: (r) => (
                <p className="line-clamp-2 max-w-md text-xs text-muted-foreground whitespace-pre-wrap">
                  {r.val || "—"}
                </p>
              ),
            },
            {
              id: "desc",
              header: "Deskripsi",
              cell: (r) => <span className="text-xs text-muted-foreground">{r.desc || "—"}</span>,
            },
            {
              id: "actions",
              header: "",
              headerClassName: "text-right",
              className: "text-right",
              cell: (r) => (
                <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                  Edit
                </Button>
              ),
            },
          ]}
          data={rows}
          getRowKey={(r) => r.key}
          pageSize={8}
          emptyTitle="Belum ada template"
          emptyDescription="Tambahkan baris NOTIFICATION_TEMPLATE di system_config."
        />
      </AdminPanelCard>

      <Dialog open={!!editingKey} onOpenChange={(v) => !v && setEditingKey(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit template — {editingKey}</DialogTitle>
          </DialogHeader>
          <textarea
            value={draftVal}
            onChange={(e) => setDraftVal(e.target.value)}
            className="min-h-[200px] w-full rounded-md border border-input bg-background p-3 text-sm"
          />
          {editingRow?.desc ? <p className="text-xs text-muted-foreground">{editingRow.desc}</p> : null}
          {error && editingKey ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditingKey(null)} disabled={busy}>
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
