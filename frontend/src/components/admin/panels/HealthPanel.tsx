"use client";

import {
  Activity,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  Database,
  FolderKanban,
  Server,
  Shield,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPanelCard, AdminPanelSkeleton } from "@/components/admin/AdminPanelCard";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { cn } from "@/lib/utils";
import type { SystemHealth } from "./types";

type Props = {
  data: unknown;
  loading: boolean;
  toggling: boolean;
  onToggle: (enabled: boolean) => void;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Activity;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/30 bg-amber-500/5"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-border/70 bg-card";

  return (
    <Card className={cn("shadow-sm", toneClass)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
            {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceDot({ status }: { status: string }) {
  const ok = status === "healthy" || status === "up";
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        ok ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" : "bg-destructive shadow-[0_0_0_3px_rgba(239,68,68,0.25)]"
      )}
    />
  );
}

function formatIdr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    return d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function HealthPanel({ data, loading, toggling, onToggle }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
        <AdminPanelSkeleton cards={4} />
      </div>
    );
  }

  const d = data as SystemHealth | undefined;
  const maintenance = !!d?.maintenance_mode;
  const status = d?.status || (maintenance ? "maintenance" : "operational");
  const services = Array.isArray(d?.services) ? d.services : [];
  const stats = d?.stats || { active_projects: 0, calculations_today: 0 };
  const fx = d?.fx;
  const recent = d?.recent_activity || [];

  const isOperational = status === "operational";
  const bannerClass = maintenance
    ? "border-destructive/40 bg-gradient-to-r from-destructive/15 via-destructive/5 to-transparent"
    : isOperational
      ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent"
      : "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent";

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <Card className={cn("overflow-hidden border shadow-sm", bannerClass)}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "rounded-xl p-3",
                maintenance ? "bg-destructive/15 text-destructive" : isOperational ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-800"
              )}
            >
              {maintenance ? <Wrench className="h-6 w-6" /> : isOperational ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status sistem</p>
              <h2 className="text-xl font-bold text-foreground">
                {maintenance ? "Maintenance Mode Aktif" : isOperational ? "Sistem Operasional" : "Perlu Perhatian"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {maintenance
                  ? "Pengguna non-admin tidak dapat mengakses aplikasi sampai mode dimatikan."
                  : isOperational
                    ? "Semua layanan inti berjalan normal."
                    : "Satu atau lebih komponen perlu dicek."}
              </p>
              {d?.checked_at ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Pemeriksaan terakhir: {new Date(d.checked_at).toLocaleString("id-ID")}
                  {d.environment ? ` · ${d.environment}` : ""}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            variant={maintenance ? "destructive" : "outline"}
            size="sm"
            onClick={() => onToggle(!maintenance)}
            disabled={toggling}
            className="shrink-0"
          >
            {toggling ? "Memproses…" : maintenance ? "Matikan Maintenance" : "Aktifkan Maintenance"}
          </Button>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Proyek aktif"
          value={stats.active_projects ?? 0}
          hint={stats.draft_projects != null ? `${stats.draft_projects} draft` : undefined}
          icon={FolderKanban}
        />
        <StatCard
          label="Menunggu approval"
          value={stats.pending_approvals ?? 0}
          hint="Perlu tindakan approver"
          icon={Shield}
          tone={(stats.pending_approvals ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Kalkulasi hari ini"
          value={stats.calculations_today ?? 0}
          hint={`${stats.audit_events_today ?? 0} event audit hari ini`}
          icon={Calculator}
          tone={(stats.calculations_today ?? 0) > 0 ? "success" : "default"}
        />
        <StatCard
          label="User aktif"
          value={stats.active_users ?? 0}
          hint={stats.org_units != null ? `${stats.org_units} unit org` : undefined}
          icon={Users}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanelCard
          title="Layanan infrastruktur"
          description="Status konektivitas komponen NAVPRO"
          icon={Server}
          accent="primary"
          className="lg:col-span-2"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">Tidak ada data layanan.</p>
            ) : (
              services.map((s) => {
                const ok = s.status === "healthy" || s.status === "up";
                return (
                  <div
                    key={s.name}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3",
                      ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-destructive/25 bg-destructive/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ServiceDot status={s.status} />
                      <div>
                        <p className="text-sm font-semibold capitalize">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.port ? `Port ${s.port}` : "—"}
                          {s.latency_ms != null ? ` · ${s.latency_ms} ms` : ""}
                        </p>
                      </div>
                    </div>
                    <AdminStatusBadge label={ok ? "Healthy" : "Down"} variant={ok ? "success" : "danger"} />
                  </div>
                );
              })
            )}
          </div>
        </AdminPanelCard>

        <AdminPanelCard title="Kurs & FX" description="Snapshot dari asumsi master" icon={Zap} accent="sky">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Kurs USD</p>
              <p className="text-lg font-bold tabular-nums">{formatIdr(fx?.kurs_usd ?? null)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {fx?.kurs_pending ? (
                <AdminStatusBadge label="Pending approval" variant="warning" />
              ) : (
                <AdminStatusBadge label="Tidak ada pending" variant="success" />
              )}
              {fx?.kurs_usd_source ? (
                <AdminStatusBadge label={String(fx.kurs_usd_source)} variant="info" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Diperbarui: {formatRelativeTime(fx?.kurs_usd_updated_at)}</p>
          </div>
        </AdminPanelCard>
      </div>

      <AdminPanelCard
        title="Aktivitas terbaru"
        description="5 event audit log terakhir di seluruh sistem"
        icon={Activity}
        accent="muted"
      >
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <AdminStatusBadge label={ev.action} variant="muted" />
                  <span className="truncate text-sm text-muted-foreground">{ev.user || "System"}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {ev.at ? new Date(ev.at).toLocaleString("id-ID") : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminPanelCard>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw JSON diagnostik</summary>
        <pre className="mt-2 overflow-auto max-h-[320px] rounded-lg border border-border bg-muted/30 p-4 text-[11px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
