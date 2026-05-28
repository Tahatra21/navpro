"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Bell,
  BookOpenCheck,
  ClipboardList,
  Settings,
  Shield,
  Tags,
  Timer,
  Users,
} from "lucide-react";
import { useToast } from "@/components/shared/toast";

const TABS = [
  {
    id: "assumptions",
    label: "Asumsi Master",
    desc: "WACC, inflasi, kurs USD, dan parameter global perhitungan.",
    icon: BookOpenCheck,
  },
  {
    id: "presets",
    label: "Duration Presets",
    desc: "Preset durasi + threshold BCR untuk wizard proyek.",
    icon: Timer,
  },
  {
    id: "sla",
    label: "SLA Config",
    desc: "SLA approval per role (reminder + escalation).",
    icon: Shield,
  },
  {
    id: "categories",
    label: "Kategori",
    desc: "Master kategori CAPEX dan OPEX untuk konsistensi input.",
    icon: Tags,
  },
  {
    id: "templates",
    label: "Notif Templates",
    desc: "Template notifikasi (in-app/email) berbasis system config.",
    icon: Bell,
  },
  {
    id: "system",
    label: "System Config",
    desc: "Konfigurasi terkelompok: flags, formula, security, dsb.",
    icon: Settings,
  },
  {
    id: "users",
    label: "Pengguna",
    desc: "Manajemen user: role dan aktivasi akun.",
    icon: Users,
  },
  {
    id: "audit",
    label: "Audit Log",
    desc: "Jejak perubahan dan aktivitas sistem (read-only).",
    icon: ClipboardList,
  },
  {
    id: "health",
    label: "System Health",
    desc: "Status layanan + maintenance mode.",
    icon: Activity,
  },
] as const;

type AssumptionsHistoryRow = { data: Record<string, unknown>; updated_at: string; updated_by: string };
type DurationPreset = {
  id: string;
  preset_name: string;
  duration_months: number;
  category: string;
  bcr_mandatory: number;
  bcr_minimum: number;
  is_active: boolean;
};
type SlaRow = {
  role_key: string;
  role_name: string;
  sla_working_days: number;
  reminder_hours: number;
  escalation_hours: number;
  escalate_to_role: string | null;
};
type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
};
type AuditLogRow = {
  id: string;
  timestamp: string;
  user: string | null;
  action: string;
  old_val: string | null;
  new_val: string | null;
  project_id: string | null;
};
type SystemHealth = {
  services: Array<{ name: string; status: string; port?: number }>;
  stats: { active_projects: number; calculations_today: number };
  maintenance_mode: boolean;
};

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("assumptions");
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const qc = useQueryClient();
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const toast = useToast();

  const assumptions = useQuery({
    queryKey: ["admin-assumptions"],
    queryFn: () => navproApi.adminGetAssumptions(),
    enabled: backendOnline === true && tab === "assumptions",
  });

  const assumptionsHistory = useQuery({
    queryKey: ["admin-assumptions-history"],
    queryFn: () => navproApi.adminGetAssumptionsHistory(),
    enabled: backendOnline === true && tab === "assumptions",
  });

  const presets = useQuery({
    queryKey: ["admin-presets"],
    queryFn: () => navproApi.adminGetPresets(),
    enabled: backendOnline === true && tab === "presets",
  });

  const sla = useQuery({
    queryKey: ["admin-sla"],
    queryFn: () => navproApi.adminGetSla(),
    enabled: backendOnline === true && tab === "sla",
  });

  const capexCats = useQuery({
    queryKey: ["admin-capex-cats"],
    queryFn: () => navproApi.adminGetCapexCategories(),
    enabled: backendOnline === true && tab === "categories",
  });

  const opexCats = useQuery({
    queryKey: ["admin-opex-cats"],
    queryFn: () => navproApi.adminGetOpexCategories(),
    enabled: backendOnline === true && tab === "categories",
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => navproApi.adminGetUsers(),
    enabled: backendOnline === true && tab === "users",
  });

  const systemConfig = useQuery({
    queryKey: ["admin-system-config"],
    queryFn: () => navproApi.adminGetSystemConfig(),
    enabled: backendOnline === true && tab === "system",
  });

  const notifTemplates = useQuery({
    queryKey: ["admin-notif-templates"],
    queryFn: () => navproApi.adminGetSystemConfig(),
    enabled: backendOnline === true && tab === "templates",
  });

  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => navproApi.adminGetAuditLogs(),
    enabled: backendOnline === true && tab === "audit",
  });

  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => navproApi.adminGetSystemHealth(),
    enabled: backendOnline === true && tab === "health",
  });

  const setMaintenance = useMutation({
    mutationFn: (enabled: boolean) => navproApi.adminSetMaintenance(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-health"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Admin</p>
        <h1 className="text-3xl font-bold text-foreground">Panel Admin NAVPRO</h1>
        <p className="text-muted-foreground text-sm">
          Kelola konfigurasi sistem, parameter finansial, dan operasional aplikasi.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar navigation */}
        <Card className="p-3 lg:sticky lg:top-4 h-fit">
          <div className="space-y-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 transition-colors border",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "bg-primary/10 border-primary/20"
                      : "bg-transparent border-transparent hover:bg-muted/60 hover:border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                        active
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-muted/40 border-border text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold truncate", active ? "text-foreground" : "text-foreground")}>
                        {t.label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{t.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {backendOnline === false && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
              Backend sedang offline. Panel Admin membutuhkan koneksi backend.
            </div>
          )}
        </Card>

        {/* Main content */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {activeTab.label}
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{activeTab.desc}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-h-[360px]">
        {tab === "assumptions" && (
          <AssumptionsPanel
            data={assumptions.data}
            history={assumptionsHistory.data}
            loading={assumptions.isLoading}
            saving={false}
            onSave={async (next) => {
              try {
                await navproApi.adminSaveAssumptions(next);
                qc.invalidateQueries({ queryKey: ["admin-assumptions"] });
                qc.invalidateQueries({ queryKey: ["admin-assumptions-history"] });
                toast.success("Asumsi master berhasil disimpan.");
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Gagal menyimpan asumsi.");
                throw e;
              }
            }}
          />
        )}
        {tab === "presets" && (
          <PresetsPanel data={presets.data} loading={presets.isLoading} onRefresh={() => presets.refetch()} />
        )}
        {tab === "sla" && <SlaPanel data={sla.data} loading={sla.isLoading} onRefresh={() => sla.refetch()} />}
        {tab === "categories" && (
          <CategoriesPanel
            capex={capexCats.data}
            opex={opexCats.data}
            loading={capexCats.isLoading || opexCats.isLoading}
            onRefresh={() => {
              capexCats.refetch();
              opexCats.refetch();
            }}
          />
        )}
        {tab === "system" && (
          <SystemConfigPanel
            data={systemConfig.data}
            loading={systemConfig.isLoading}
            onSave={async (key, val) => {
              try {
                await navproApi.adminSetSystemConfig(key, val);
                qc.invalidateQueries({ queryKey: ["admin-system-config"] });
                qc.invalidateQueries({ queryKey: ["admin-health"] });
                toast.success("System config tersimpan.");
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Gagal menyimpan system config.");
                throw e;
              }
            }}
          />
        )}
        {tab === "templates" && (
          <NotificationTemplatesPanel
            data={notifTemplates.data}
            loading={notifTemplates.isLoading}
            onSave={async (key, val) => {
              try {
                await navproApi.adminSetSystemConfig(key, val);
                qc.invalidateQueries({ queryKey: ["admin-notif-templates"] });
                toast.success("Template notifikasi tersimpan.");
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Gagal menyimpan template.");
                throw e;
              }
            }}
          />
        )}
        {tab === "users" && <UsersPanel data={users.data} loading={users.isLoading} onRefresh={() => users.refetch()} />}
        {tab === "audit" && <AuditPanel data={audit.data} loading={audit.isLoading} />}
        {tab === "health" && (
          <HealthPanel
            data={health.data}
            loading={health.isLoading}
            toggling={setMaintenance.isPending}
            onToggle={(enabled) => setMaintenance.mutate(enabled)}
          />
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssumptionsPanel({
  data,
  history,
  loading,
  saving,
  onSave,
}: {
  data: unknown;
  history: unknown;
  loading: boolean;
  saving: boolean;
  onSave: (next: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
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

  const historyRows =
    (history as { history?: AssumptionsHistoryRow[] })?.history || [];

  if (loading) return <p className="text-sm text-muted-foreground">Memuat asumsi…</p>;
  if (!assumptionsRaw || typeof assumptionsRaw !== "object") {
    return <p className="text-sm text-muted-foreground">Data asumsi tidak tersedia.</p>;
  }

  const save = async () => {
    setError("");
    try {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(draft)) {
        const num = Number(v);
        next[k] = v.trim() !== "" && Number.isFinite(num) ? num : v;
      }
      await onSave(next);
      toast.success("Asumsi tersimpan.");
    } catch (e: unknown) {
      setError((e as Error)?.message || "Gagal menyimpan.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan asumsi.");
    }
  };

  const META: Record<
    string,
    { label: string; help?: string; suffix?: string; group: "Finansial" | "Threshold" | "Pajak" | "Kurs & Mata Uang" | "Lainnya" }
  > = {
    wacc_annual: { label: "WACC (Tahunan)", help: "Persen (%).", suffix: "%", group: "Finansial" },
    inflation_annual: { label: "Inflasi (Tahunan)", help: "Persen (%).", suffix: "%", group: "Finansial" },
    inflation_monthly: { label: "Inflasi (Bulanan)", help: "Persen (%), hasil turunan.", suffix: "%", group: "Finansial" },
    bcr_mandatory: { label: "BCR Mandatory", help: "Threshold kelayakan utama.", group: "Threshold" },
    bcr_minimum: { label: "BCR Minimum", help: "Threshold minimum untuk warning/risk.", group: "Threshold" },
    ppn_rate: { label: "PPN Rate", help: "Persen (%).", suffix: "%", group: "Pajak" },
    kurs_usd: { label: "Kurs USD", help: "Nilai IDR per 1 USD.", suffix: "IDR", group: "Kurs & Mata Uang" },
    currency: { label: "Mata Uang Default", help: "IDR / USD.", group: "Kurs & Mata Uang" },
    effective_date: { label: "Effective Date", help: "Tanggal mulai berlaku (YYYY-MM-DD).", group: "Lainnya" },
    notes: { label: "Catatan", help: "Referensi memo/keputusan.", group: "Lainnya" },
  };

  const entries = Object.keys(a)
    .map((k) => k)
    .filter((k) => (search.trim() ? k.toLowerCase().includes(search.toLowerCase().trim()) : true));
  const grouped = entries.reduce<Record<string, string[]>>((acc, key) => {
    const g = META[key]?.group || "Lainnya";
    if (!acc[g]) acc[g] = [];
    acc[g].push(key);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-4">
        Parameter global WACC, inflasi, dan threshold BCR (Memo DirKeu).
      </p>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari key (mis. wacc, inflation, bcr, kurs)…"
          className="sm:max-w-md"
        />
        <Button onClick={save} disabled={saving}>
          Simpan Asumsi
        </Button>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

      <div className="space-y-4">
        {Object.entries(grouped).map(([groupName, keys]) => (
          <Card key={groupName} className="p-4">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{groupName}</p>
              <p className="text-sm font-semibold">{keys.length} item</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {keys.map((key) => {
                const meta = META[key];
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold text-foreground">{meta?.label || key}</Label>
                      <span className="font-mono text-[10px] text-muted-foreground">{key}</span>
                    </div>
                    <Input
                      value={draft[key] ?? ""}
                      onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder={meta?.suffix ? `contoh: 123 ${meta.suffix}` : undefined}
                    />
                    {(meta?.help || meta?.suffix) && (
                      <p className="text-[11px] text-muted-foreground">
                        {meta?.help} {meta?.suffix ? `(${meta.suffix})` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50">
        <h3 className="font-semibold mb-2">History (terakhir)</h3>
        {historyRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada history.</p>
        ) : (
          <div className="space-y-2">
            {historyRows.slice(0, 10).map((h, idx) => (
              <div key={idx} className="text-xs border border-border rounded-lg p-3 bg-muted/20">
                <div className="flex flex-wrap gap-2 justify-between mb-2">
                  <span className="text-muted-foreground">{h.updated_at}</span>
                  <span className="font-medium">{h.updated_by}</span>
                </div>
                <pre className="overflow-auto max-h-[160px]">{JSON.stringify(h.data, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type SystemConfigRow = { key: string; val: string; type: string; desc: string | null };

function SystemConfigPanel({
  data,
  loading,
  onSave,
}: {
  data: unknown;
  loading: boolean;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const toast = useToast();
  const grouped: Record<string, SystemConfigRow[]> =
    (data as { grouped?: Record<string, SystemConfigRow[]> })?.grouped || {};

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftVal, setDraftVal] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <p className="text-sm text-muted-foreground">Memuat system config…</p>;
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
  const filteredCats =
    category === "ALL" ? categories : categories.filter((c) => c === category);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">System Config</h3>
        <p className="text-xs text-muted-foreground">
          Editor konfigurasi global (feature flag, formula, security, dsb) dari tabel <span className="font-mono">system_config</span>.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari key/value/desc…"
            className="sm:w-[320px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="ALL">Semua kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Tips: cari <span className="font-mono">maintenance</span>, <span className="font-mono">security</span>,{" "}
          <span className="font-mono">flag</span>.
        </p>
      </div>

      {error && <div className="text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">{error}</div>}

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada config.</p>
      ) : (
        <div className="space-y-5">
          {filteredCats.map((cat) => {
            const rows = grouped[cat] || [];
            const filtered = q
              ? rows.filter((r) => {
                  const s = `${r.key} ${r.val ?? ""} ${r.type ?? ""} ${r.desc ?? ""}`.toLowerCase();
                  return s.includes(q);
                })
              : rows;
            if (q && filtered.length === 0) return null;
            return (
            <Card key={cat} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                  <p className="text-sm font-semibold">
                    {filtered.length} item{q ? ` (dari ${rows.length})` : ""}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-2 pr-3 text-xs uppercase text-muted-foreground">Key</th>
                      <th className="text-left py-2 pr-3 text-xs uppercase text-muted-foreground">Value</th>
                      <th className="text-left py-2 pr-3 text-xs uppercase text-muted-foreground">Type</th>
                      <th className="text-right py-2 text-xs uppercase text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.key} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-mono text-xs">{r.key}</td>
                        <td className="py-2 pr-3">
                          {editingKey === r.key ? (
                            <Input value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
                          ) : (
                            <div className="space-y-1">
                              <p className="font-medium break-all">{r.val}</p>
                              {r.desc && <p className="text-[11px] text-muted-foreground">{r.desc}</p>}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{r.type}</td>
                        <td className="py-2 text-right">
                          {editingKey === r.key ? (
                            <div className="flex items-center justify-end gap-2">
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
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationTemplatesPanel({
  data,
  loading,
  onSave,
}: {
  data: unknown;
  loading: boolean;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const toast = useToast();
  const grouped: Record<string, SystemConfigRow[]> =
    (data as { grouped?: Record<string, SystemConfigRow[]> })?.grouped || {};
  const rows = grouped["NOTIFICATION_TEMPLATE"] || [];

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftVal, setDraftVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <p className="text-sm text-muted-foreground">Memuat template notifikasi…</p>;
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Notification Templates</h3>
        <p className="text-xs text-muted-foreground">
          Template pesan untuk notifikasi (in-app / email). Disimpan di <span className="font-mono">system_config</span> kategori{" "}
          <span className="font-mono">NOTIFICATION_TEMPLATE</span>.
        </p>
      </div>

      {error && (
        <div
          className={cn(
            "text-sm p-3 rounded-lg border",
            "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada template. Tambahkan baris di DB <span className="font-mono">system_config</span> dengan category{" "}
          <span className="font-mono">NOTIFICATION_TEMPLATE</span>.
        </p>
      ) : (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 text-xs uppercase text-muted-foreground">Key</th>
                  <th className="text-left py-2 pr-3 text-xs uppercase text-muted-foreground">Template</th>
                  <th className="text-right py-2 text-xs uppercase text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 align-top">
                    <td className="py-3 pr-3 font-mono text-xs whitespace-nowrap">{r.key}</td>
                    <td className="py-3 pr-3">
                      {editingKey === r.key ? (
                        <div className="space-y-2">
                          <textarea
                            value={draftVal}
                            onChange={(e) => setDraftVal(e.target.value)}
                            className="w-full min-h-[120px] rounded-md border border-input bg-background p-2 text-sm"
                          />
                          {r.desc && <p className="text-[11px] text-muted-foreground">{r.desc}</p>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <pre className="whitespace-pre-wrap text-xs bg-muted/40 border border-border rounded-lg p-3">
                            {r.val}
                          </pre>
                          {r.desc && <p className="text-[11px] text-muted-foreground">{r.desc}</p>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {editingKey === r.key ? (
                        <div className="flex items-center justify-end gap-2">
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PresetsPanel({ data, loading, onRefresh }: { data: unknown; loading: boolean; onRefresh: () => void }) {
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

  if (loading) return <p className="text-sm text-muted-foreground">Memuat presets…</p>;

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Duration Presets</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            Tambah Preset
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{err}</p>}

      <div className="grid gap-2">
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada preset.</p>
        ) : (
          presets.map((p) => (
            <Card key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.preset_name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {p.id} • {p.duration_months} bulan • {p.category} • BCR {Number(p.bcr_mandatory).toFixed(2)} /{" "}
                  {Number(p.bcr_minimum).toFixed(2)} • {p.is_active ? "ACTIVE" : "INACTIVE"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)} disabled={busy}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => deactivate(p.id)} disabled={busy || !p.is_active}>
                  Nonaktifkan
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

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

function SlaPanel({ data, loading, onRefresh }: { data: unknown; loading: boolean; onRefresh: () => void }) {
  const items = ((data as { sla?: SlaRow[] })?.sla || []) as SlaRow[];
  type SlaDraftRow = {
    role_key: string;
    role_name: string;
    sla_working_days: string;
    reminder_hours: string;
    escalation_hours: string;
    escalate_to_role: string;
  };
  const [draft, setDraft] = useState<SlaDraftRow[]>(() =>
    items.map((r) => ({
      role_key: r.role_key,
      role_name: r.role_name,
      sla_working_days: String(r.sla_working_days ?? 2),
      reminder_hours: String(r.reminder_hours ?? 24),
      escalation_hours: String(r.escalation_hours ?? 48),
      escalate_to_role: r.escalate_to_role ?? "",
    }))
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat SLA…</p>;

  const saveRow = async (row: SlaDraftRow) => {
    setErr("");
    setBusy(true);
    try {
      await navproApi.adminSaveSla(row.role_key, {
        role_name: row.role_name,
        sla_working_days: Number(row.sla_working_days),
        reminder_hours: Number(row.reminder_hours),
        escalation_hours: Number(row.escalation_hours),
        escalate_to_role: row.escalate_to_role || null,
      });
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal menyimpan SLA.");
    } finally {
      setBusy(false);
    }
  };

  const addRole = () => {
    setDraft((s) => [
      ...s,
      {
        role_key: "",
        role_name: "",
        sla_working_days: "2",
        reminder_hours: "24",
        escalation_hours: "48",
        escalate_to_role: "",
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">SLA Configuration</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
            Refresh
          </Button>
          <Button size="sm" onClick={addRole} disabled={busy}>
            Tambah Role
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{err}</p>}

      <div className="grid gap-2">
        {draft.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada SLA config.</p>
        ) : (
          draft.map((row, idx) => (
            <Card key={`${row.role_key}-${idx}`} className="p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Role Key</Label>
                  <Input
                    value={row.role_key}
                    onChange={(e) =>
                      setDraft((s) =>
                        s.map((r, i) => (i === idx ? { ...r, role_key: e.target.value } : r))
                      )
                    }
                    placeholder="MANAGER"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Role Name</Label>
                  <Input
                    value={row.role_name}
                    onChange={(e) =>
                      setDraft((s) =>
                        s.map((r, i) => (i === idx ? { ...r, role_name: e.target.value } : r))
                      )
                    }
                    placeholder="Manager"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">SLA (working days)</Label>
                  <Input
                    inputMode="numeric"
                    value={String(row.sla_working_days)}
                    onChange={(e) =>
                      setDraft((s) =>
                        s.map((r, i) => (i === idx ? { ...r, sla_working_days: e.target.value } : r))
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reminder (hours)</Label>
                  <Input
                    inputMode="numeric"
                    value={String(row.reminder_hours)}
                    onChange={(e) =>
                      setDraft((s) =>
                        s.map((r, i) => (i === idx ? { ...r, reminder_hours: e.target.value } : r))
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Escalation (hours)</Label>
                  <Input
                    inputMode="numeric"
                    value={String(row.escalation_hours)}
                    onChange={(e) =>
                      setDraft((s) =>
                        s.map((r, i) => (i === idx ? { ...r, escalation_hours: e.target.value } : r))
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Escalate To Role</Label>
                  <Input
                    value={row.escalate_to_role}
                    onChange={(e) =>
                      setDraft((s) =>
                        s.map((r, i) => (i === idx ? { ...r, escalate_to_role: e.target.value } : r))
                      )
                    }
                    placeholder="GM_SRM"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => saveRow(row)} disabled={busy}>
                  Simpan Row
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function CategoriesPanel({
  capex,
  opex,
  loading,
  onRefresh,
}: {
  capex: unknown;
  opex: unknown;
  loading: boolean;
  onRefresh: () => void;
}) {
  const capexList = (capex as { categories?: string[] })?.categories || [];
  const opexList = (opex as { categories?: string[] })?.categories || [];
  const [capexCode, setCapexCode] = useState("");
  const [opexCode, setOpexCode] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat kategori…</p>;

  const add = async (type: "capex" | "opex") => {
    setErr("");
    setOk("");
    setBusy(true);
    try {
      const code = (type === "capex" ? capexCode : opexCode).trim();
      if (!code) throw new Error("Kode kategori wajib diisi.");
      if (type === "capex") await navproApi.adminAddCapexCategory(code);
      else await navproApi.adminAddOpexCategory(code);
      if (type === "capex") setCapexCode("");
      else setOpexCode("");
      setOk("Kategori ditambahkan.");
      onRefresh();
      setTimeout(() => setOk(""), 2000);
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal menambah kategori.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Kategori CAPEX/OPEX</h3>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
          Refresh
        </Button>
      </div>

      {err && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{err}</p>}
      {ok && <p className="text-sm text-emerald-600 bg-emerald-500/10 p-2 rounded">{ok}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4 space-y-3">
          <h4 className="font-semibold">CAPEX</h4>
          <div className="flex gap-2">
            <Input value={capexCode} onChange={(e) => setCapexCode(e.target.value)} placeholder="mis. SITAC" />
            <Button onClick={() => add("capex")} disabled={busy}>
              Tambah
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {capexList.length === 0 ? (
              <span className="text-sm text-muted-foreground">Kosong</span>
            ) : (
              capexList.map((c) => (
                <span key={c} className="text-xs px-2 py-1 rounded bg-muted/40 border border-border">
                  {c}
                </span>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h4 className="font-semibold">OPEX</h4>
          <div className="flex gap-2">
            <Input value={opexCode} onChange={(e) => setOpexCode(e.target.value)} placeholder="mis. O&M" />
            <Button onClick={() => add("opex")} disabled={busy}>
              Tambah
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {opexList.length === 0 ? (
              <span className="text-sm text-muted-foreground">Kosong</span>
            ) : (
              opexList.map((c) => (
                <span key={c} className="text-xs px-2 py-1 rounded bg-muted/40 border border-border">
                  {c}
                </span>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function UsersPanel({ data, loading, onRefresh }: { data: unknown; loading: boolean; onRefresh: () => void }) {
  const users = ((data as { users?: AdminUserRow[] })?.users || []) as AdminUserRow[];
  const myRole = useAuthStore((s: { user: { role: string } | null }) => s.user?.role || null);
  const canEditEmail = myRole === "SUPER_ADMIN";
  const ROLE_OPTIONS = ["SUPER_ADMIN", "FINANCE_ADMIN", "SA", "MANAGER", "GM_SRM", "VIEWER"] as const;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [draft, setDraft] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    password: string;
  }>({
    id: "",
    email: "",
    full_name: "",
    role: "VIEWER",
    is_active: true,
    password: "Navpro@2026",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat pengguna…</p>;

  const openCreate = () => {
    setErr("");
    setMode("create");
    setDraft({
      id: "",
      email: "",
      full_name: "",
      role: "VIEWER",
      is_active: true,
      password: "Navpro@2026",
    });
    setOpen(true);
  };

  const openEdit = (u: AdminUserRow) => {
    setErr("");
    setMode("edit");
    setDraft({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      is_active: !!u.is_active,
      password: "",
    });
    setOpen(true);
  };

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        email: String(draft.email || "").trim().toLowerCase(),
        full_name: String(draft.full_name || "").trim(),
        role: String(draft.role || "VIEWER"),
        is_active: !!draft.is_active,
      };
      if (mode === "create" && !payload.email) throw new Error("Email wajib diisi.");
      if (!payload.full_name) throw new Error("Nama wajib diisi.");
      if (!ROLE_OPTIONS.includes(payload.role as (typeof ROLE_OPTIONS)[number])) {
        throw new Error("Role tidak valid.");
      }

      if (mode === "create") {
        await navproApi.adminCreateUser({ ...payload, password: String(draft.password || "").trim() || undefined });
      } else {
        if (draft.is_active === false) {
          const ok = window.confirm(`Nonaktifkan user "${draft.full_name}"? Mereka tidak bisa login sampai diaktifkan kembali.`);
          if (!ok) {
            setBusy(false);
            return;
          }
        }
        if (canEditEmail) await navproApi.adminUpdateUser(String(draft.id), payload);
        else await navproApi.adminUpdateUser(String(draft.id), (({ full_name, role, is_active }) => ({ full_name, role, is_active }))(payload));
      }
      setOpen(false);
      onRefresh();
      toast.success(mode === "create" ? "User berhasil dibuat." : "User berhasil diperbarui.");
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal menyimpan user.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan user.");
    } finally {
      setBusy(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (activeFilter === "ACTIVE" && !u.is_active) return false;
    if (activeFilter === "INACTIVE" && u.is_active) return false;
    if (!search.trim()) return true;
    const s = `${u.full_name} ${u.email} ${u.role}`.toLowerCase();
    return s.includes(search.toLowerCase().trim());
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Daftar Pengguna</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} disabled={busy}>
            Tambah User
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{err}</p>}

      <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama/email/role…"
            className="sm:w-[280px]"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Semua role</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Menampilkan {filteredUsers.length} dari {users.length} user
        </p>
      </div>

      <div className="grid gap-2">
        {filteredUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada user.</p>
        ) : (
          filteredUsers.map((u) => (
            <Card key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{u.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {u.email} • {u.role} • {u.is_active ? "ACTIVE" : "INACTIVE"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(u)} disabled={busy}>
                  Edit
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah User" : "Edit User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={draft.email}
                onChange={(e) => setDraft((s) => ({ ...s, email: e.target.value }))}
                disabled={mode === "edit" && !canEditEmail}
              />
              {mode === "edit" && !canEditEmail && (
                <p className="text-xs text-muted-foreground">
                  Email hanya dapat diubah oleh <span className="font-semibold">SUPER_ADMIN</span>.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input
                value={draft.full_name}
                  onChange={(e) => setDraft((s) => ({ ...s, full_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  value={draft.role}
                  onChange={(e) => setDraft((s) => ({ ...s, role: e.target.value }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Active</Label>
                <select
                  value={draft.is_active ? "true" : "false"}
                  onChange={(e) => setDraft((s) => ({ ...s, is_active: e.target.value === "true" }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
              </div>
            </div>
            {mode === "edit" && canEditEmail && (
              <Card className="p-3 border border-destructive/20 bg-destructive/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Reset Password</p>
                    <p className="text-xs text-muted-foreground">
                      Set password user menjadi default <span className="font-mono">Navpro@2026</span>.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      const ok = window.confirm(`Reset password untuk "${draft.full_name}" ke default?`);
                      if (!ok) return;
                      setBusy(true);
                      setErr("");
                      try {
                        await navproApi.adminResetUserPassword(String(draft.id), "Navpro@2026");
                        toast.success("Password berhasil di-reset.");
                      } catch (e: unknown) {
                        setErr(e instanceof Error ? e.message : "Gagal reset password.");
                        toast.error(e instanceof Error ? e.message : "Gagal reset password.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Reset Password
                  </Button>
                </div>
              </Card>
            )}
            {mode === "create" && (
              <div className="space-y-1">
                <Label>Password (optional)</Label>
                <Input
                  type="password"
                  value={draft.password}
                    onChange={(e) => setDraft((s) => ({ ...s, password: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Jika kosong, default backend: <span className="font-mono">Navpro@2026</span>
                </p>
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

function AuditPanel({ data, loading }: { data: unknown; loading: boolean }) {
  const toast = useToast();
  const logs = ((data as { logs?: AuditLogRow[] })?.logs || []) as AuditLogRow[];
  const [limit, setLimit] = useState(200);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<string>("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<AuditLogRow[]>(logs);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat audit log…</p>;

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const res = await navproApi.adminGetAuditLogsWithLimit(limit);
      const next = ((res as { logs?: AuditLogRow[] })?.logs || []) as AuditLogRow[];
      setItems(next);
      toast.success("Audit log diperbarui.");
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal memuat audit log.");
      toast.error(e instanceof Error ? e.message : "Gagal memuat audit log.");
    } finally {
      setBusy(false);
    }
  };

  const actions = Array.from(new Set(items.map((x) => x.action))).sort();
  const filtered = items.filter((l) => {
    if (action && l.action !== action) return false;
    if (!q.trim()) return true;
    const s = `${l.timestamp} ${l.user} ${l.action} ${l.old_val ?? ""} ${l.new_val ?? ""} ${l.project_id ?? ""}`;
    return s.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="font-semibold">Audit Log</h3>
        <div className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter (user/action/project)…"
            className="w-[260px]"
          />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Semua aksi</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Input
            inputMode="numeric"
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value || 200))}
            className="w-[120px]"
          />
          <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
            {busy ? "Memuat…" : "Reload"}
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{err}</p>}

      <div className="text-xs text-muted-foreground">
        Menampilkan {filtered.length} dari {items.length} log (limit server: {limit}).
      </div>

      <div className="grid gap-2">
        {filtered.slice(0, 200).map((l) => (
          <Card key={l.id} className="p-3">
            <div className="flex flex-wrap gap-2 justify-between text-xs text-muted-foreground">
              <span className="font-mono">{l.timestamp}</span>
              <span>{l.user || "-"}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 items-center">
              <span className="text-sm font-semibold">{l.action}</span>
              {l.project_id && <span className="text-xs font-mono text-muted-foreground">{l.project_id}</span>}
            </div>
            {(l.old_val || l.new_val) && (
              <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
                <pre className="bg-muted/30 border border-border rounded p-2 overflow-auto max-h-[120px]">
                  {l.old_val || ""}
                </pre>
                <pre className="bg-muted/30 border border-border rounded p-2 overflow-auto max-h-[120px]">
                  {l.new_val || ""}
                </pre>
              </div>
            )}
          </Card>
        ))}
      </div>
      {filtered.length > 200 && (
        <p className="text-xs text-muted-foreground">Catatan: UI membatasi render 200 item pertama untuk performa.</p>
      )}
    </div>
  );
}

function HealthPanel({
  data,
  loading,
  toggling,
  onToggle,
}: {
  data: unknown;
  loading: boolean;
  toggling: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Memuat system health…</p>;
  const d = data as SystemHealth | undefined;
  const maintenance = !!d?.maintenance_mode;
  const services = Array.isArray(d?.services) ? d!.services : [];
  const stats = d?.stats || { active_projects: 0, calculations_today: 0 };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">System Health</h3>
        <Button variant={maintenance ? "destructive" : "outline"} onClick={() => onToggle(!maintenance)} disabled={toggling}>
          {maintenance ? "Matikan Maintenance" : "Aktifkan Maintenance"}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4 space-y-2">
          <h4 className="font-semibold">Services</h4>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada data service.</p>
          ) : (
            <div className="space-y-2">
              {services.map((s: { name: string; status: string; port?: number }) => (
                <div key={s.name} className="flex items-center justify-between text-sm border border-border rounded-lg p-2">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-muted-foreground">
                    {s.status} {s.port ? `• :${s.port}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4 space-y-2">
          <h4 className="font-semibold">Stats</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Active projects: <span className="text-foreground font-medium">{stats.active_projects ?? "-"}</span></div>
            <div>Calculations today: <span className="text-foreground font-medium">{stats.calculations_today ?? "-"}</span></div>
            <div>
              Maintenance mode:{" "}
              <span className={maintenance ? "text-destructive font-semibold" : "text-emerald-600 font-semibold"}>
                {maintenance ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Raw JSON</summary>
        <pre className="mt-2 overflow-auto max-h-[420px] bg-muted/30 p-4 rounded-lg border border-border">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
