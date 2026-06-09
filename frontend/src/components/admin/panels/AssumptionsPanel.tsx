"use client";

import { useEffect, useState } from "react";
import {
  Coins,
  FileText,
  Gauge,
  History,
  Landmark,
  Percent,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminFilterBar,
  AdminPanelAlert,
  AdminPanelCard,
  AdminPanelSkeleton,
  type AdminPanelAccent,
} from "@/components/admin/AdminPanelCard";
import { AdminStickyActionBar } from "@/components/admin/AdminStickyActionBar";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import type { AssumptionsHistoryRow } from "./types";

type Props = {
  data: unknown;
  history: unknown;
  loading: boolean;
  onSave: (next: Record<string, unknown>) => Promise<void>;
};

type GroupName = "Finansial" | "Threshold" | "Pajak" | "Kurs & Mata Uang" | "Lainnya";

const GROUP_ORDER: GroupName[] = ["Finansial", "Threshold", "Pajak", "Kurs & Mata Uang", "Lainnya"];

const GROUP_META: Record<GroupName, { icon: typeof Percent; accent: AdminPanelAccent }> = {
  Finansial: { icon: Percent, accent: "primary" },
  Threshold: { icon: Gauge, accent: "amber" },
  Pajak: { icon: Landmark, accent: "violet" },
  "Kurs & Mata Uang": { icon: Coins, accent: "sky" },
  Lainnya: { icon: FileText, accent: "muted" },
};

export function AssumptionsPanel({ data, history, loading, onSave }: Props) {
  const assumptionsRaw =
    (data as { assumptions?: Record<string, unknown> })?.assumptions || (data as Record<string, unknown> | undefined);
  const a = assumptionsRaw && typeof assumptionsRaw === "object" ? assumptionsRaw : {};
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(a)) d[k] = v == null ? "" : String(v);
    return d;
  });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !data) return;
    const raw =
      (data as { assumptions?: Record<string, unknown> })?.assumptions ||
      (data as Record<string, unknown> | undefined);
    if (!raw || typeof raw !== "object") return;
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) d[k] = v == null ? "" : String(v);
    setDraft(d);
  }, [data, loading]);

  const historyRows = (history as { history?: AssumptionsHistoryRow[] })?.history || [];

  if (loading) return <AdminPanelSkeleton cards={3} />;

  if (!assumptionsRaw || typeof assumptionsRaw !== "object") {
    return <p className="text-sm text-muted-foreground">Data asumsi tidak tersedia.</p>;
  }

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(draft)) {
        const num = Number(v);
        next[k] = v.trim() !== "" && Number.isFinite(num) ? num : v;
      }
      await onSave(next);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const META: Record<
    string,
    { label: string; help?: string; suffix?: string; group: GroupName }
  > = {
    wacc_annual: { label: "WACC (Tahunan)", help: "Persen (%).", suffix: "%", group: "Finansial" },
    inflation_annual: { label: "Inflasi (Tahunan)", help: "Persen (%).", suffix: "%", group: "Finansial" },
    inflation_monthly: { label: "Inflasi (Bulanan)", help: "Persen (%), hasil turunan.", suffix: "%", group: "Finansial" },
    bcr_mandatory: { label: "BCR Mandatory", help: "Threshold kelayakan utama.", group: "Threshold" },
    bcr_minimum: { label: "BCR Minimum", help: "Threshold minimum untuk warning/risk.", group: "Threshold" },
    ppn_rate: { label: "PPN Rate", help: "Persen (%).", suffix: "%", group: "Pajak" },
    kurs_usd: { label: "Kurs USD", help: "Kelola di tab Kurs & FX.", suffix: "IDR", group: "Kurs & Mata Uang" },
    currency: { label: "Mata Uang Default", help: "IDR / USD.", group: "Kurs & Mata Uang" },
    effective_date: { label: "Effective Date", help: "Tanggal mulai berlaku (YYYY-MM-DD).", group: "Lainnya" },
    notes: { label: "Catatan", help: "Referensi memo/keputusan.", group: "Lainnya" },
  };

  const HIDDEN_ASSUMPTION_KEYS = new Set([
    "kurs_usd",
    "kurs_eur",
    "kurs_sgd",
    "kurs_usd_source",
    "kurs_usd_updated_at",
    "kurs_auto_sync_enabled",
    "kurs_usd_pending",
    "kurs_pending_delta_percent",
    "kurs_pending_at",
    "kurs_pending_source",
    "kurs_eur_source",
    "kurs_eur_updated_at",
    "kurs_sgd_source",
    "kurs_sgd_updated_at",
  ]);

  const entries = Object.keys(a)
    .filter((k) => !HIDDEN_ASSUMPTION_KEYS.has(k))
    .filter((k) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const meta = META[k];
      return k.toLowerCase().includes(q) || meta?.label.toLowerCase().includes(q);
    });

  const grouped = entries.reduce<Record<string, string[]>>((acc, key) => {
    const g = META[key]?.group || "Lainnya";
    if (!acc[g]) acc[g] = [];
    acc[g].push(key);
    return acc;
  }, {});

  const visibleGroups = GROUP_ORDER.filter((g) => (grouped[g]?.length ?? 0) > 0);

  return (
    <div className="space-y-5">
      <AdminFilterBar>
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari parameter…"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">{entries.length} parameter</p>
      </AdminFilterBar>

      {error ? <AdminPanelAlert variant="error">{error}</AdminPanelAlert> : null}

      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada parameter yang cocok dengan pencarian.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((groupName) => {
            const keys = grouped[groupName] || [];
            const meta = GROUP_META[groupName];
            const Icon = meta.icon;
            return (
              <AdminPanelCard
                key={groupName}
                title={groupName}
                description={`${keys.length} parameter`}
                icon={Icon}
                accent={meta.accent}
              >
                <div className="space-y-4">
                  {keys.map((key) => {
                    const fieldMeta = META[key];
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-sm font-medium">{fieldMeta?.label || key}</Label>
                        <Input
                          value={draft[key] ?? ""}
                          onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.value }))}
                          placeholder={fieldMeta?.suffix ? `contoh: 123 ${fieldMeta.suffix}` : undefined}
                          className="bg-background"
                        />
                        {fieldMeta?.help ? (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">{fieldMeta.help}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </AdminPanelCard>
            );
          })}
        </div>
      )}

      <AdminPanelCard
        title="Riwayat perubahan"
        description="Audit trail perubahan asumsi master"
        icon={History}
        accent="muted"
        badge={historyRows.length > 0 ? `${Math.min(historyRows.length, 50)} entri` : undefined}
      >
        <AdminDataTable
          columns={[
            {
              id: "time",
              header: "Waktu",
              cell: (h) => <span className="text-xs text-muted-foreground whitespace-nowrap">{h.updated_at}</span>,
            },
            { id: "by", header: "Oleh", cell: (h) => h.updated_by },
            {
              id: "summary",
              header: "Field diubah",
              cell: (h) => {
                const keys = Object.keys(h.data || {}).filter((k) => !k.startsWith("kurs_"));
                return (
                  <span className="text-xs text-muted-foreground">
                    {keys.slice(0, 5).join(", ")}
                    {keys.length > 5 ? ` +${keys.length - 5}` : ""}
                  </span>
                );
              },
            },
          ]}
          data={historyRows.slice(0, 50)}
          getRowKey={(h) => `${h.updated_at}-${h.updated_by}`}
          pageSize={8}
          emptyTitle="Belum ada riwayat"
          emptyDescription="Perubahan asumsi master akan tercatat di sini."
        />
      </AdminPanelCard>

      <AdminStickyActionBar>
        <Button onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Asumsi Master"}
        </Button>
      </AdminStickyActionBar>
    </div>
  );
}
