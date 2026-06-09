"use client";

import { useState } from "react";
import { Calculator, Flag, Search, Settings, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminFilterBar,
  AdminPanelAlert,
  AdminPanelCard,
  AdminPanelSkeleton,
  adminSelectClass,
  type AdminPanelAccent,
} from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { useToast } from "@/components/shared/toast";
import type { SystemConfigRow } from "./types";

type Props = {
  data: unknown;
  loading: boolean;
  onSave: (key: string, val: string) => Promise<void>;
};

const CAT_META: Record<string, { accent: AdminPanelAccent; icon: LucideIcon }> = {
  FEATURE_FLAG: { accent: "violet", icon: Flag },
  FORMULA: { accent: "sky", icon: Calculator },
  SECURITY: { accent: "amber", icon: Shield },
};

function metaFor(cat: string) {
  return CAT_META[cat] ?? { accent: "muted" as const, icon: Settings };
}

export function SystemConfigPanel({ data, loading, onSave }: Props) {
  const toast = useToast();
  const grouped: Record<string, SystemConfigRow[]> =
    (data as { grouped?: Record<string, SystemConfigRow[]> })?.grouped || {};

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftVal, setDraftVal] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <AdminPanelSkeleton cards={3} />;
  if (!data) return <p className="text-sm text-muted-foreground">System config tidak tersedia.</p>;

  const categories = Object.keys(grouped);

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
      toast.success("Config tersimpan.");
      setEditingKey(null);
      setDraftVal("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan config.");
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredCats = category === "ALL" ? categories : categories.filter((c) => c === category);

  const visibleCats = filteredCats
    .map((cat) => {
      const rows = grouped[cat] || [];
      const filtered = q
        ? rows.filter((r) => {
            const s = `${r.key} ${r.val ?? ""} ${r.type ?? ""} ${r.desc ?? ""}`.toLowerCase();
            return s.includes(q);
          })
        : rows;
      return { cat, filtered };
    })
    .filter(({ filtered }) => !q || filtered.length > 0);

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari key atau value…"
            className="pl-9"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={adminSelectClass}>
          <option value="ALL">Semua kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </AdminFilterBar>

      {error ? <AdminPanelAlert variant="error">{error}</AdminPanelAlert> : null}

      {categories.length === 0 ? (
        <AdminPanelCard title="System config" description="Belum ada entri di database">
          <p className="text-sm text-muted-foreground">Tambahkan baris di tabel system_config.</p>
        </AdminPanelCard>
      ) : visibleCats.length === 0 ? (
        <AdminPanelCard title="Tidak ada hasil" description="Sesuaikan pencarian atau filter kategori">
          <p className="text-sm text-muted-foreground">Tidak ada config yang cocok.</p>
        </AdminPanelCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {visibleCats.map(({ cat, filtered }) => {
            const { accent, icon } = metaFor(cat);
            return (
              <AdminPanelCard
                key={cat}
                title={cat}
                description="Parameter teknis aplikasi"
                icon={icon}
                accent={accent}
                badge={`${filtered.length} config`}
              >
                <AdminDataTable
                  columns={[
                    {
                      id: "key",
                      header: "Key",
                      cell: (r) => <span className="font-mono text-xs">{r.key}</span>,
                    },
                    {
                      id: "val",
                      header: "Value",
                      cell: (r) =>
                        editingKey === r.key ? (
                          <Input value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
                        ) : (
                          <div>
                            <p className="break-all text-sm">{r.val}</p>
                            {r.desc ? <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p> : null}
                          </div>
                        ),
                    },
                    {
                      id: "type",
                      header: "Tipe",
                      cell: (r) => <span className="text-xs text-muted-foreground">{r.type}</span>,
                    },
                    {
                      id: "actions",
                      header: "",
                      headerClassName: "text-right",
                      className: "text-right",
                      cell: (r) =>
                        editingKey === r.key ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingKey(null)}>
                              Batal
                            </Button>
                            <Button size="sm" disabled={busy} onClick={save}>
                              Simpan
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                            Edit
                          </Button>
                        ),
                    },
                  ]}
                  data={filtered}
                  getRowKey={(r) => r.key}
                  pageSize={6}
                  resetKey={`${q}-${category}`}
                />
              </AdminPanelCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
