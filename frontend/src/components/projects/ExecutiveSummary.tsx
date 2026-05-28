"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  CircleDollarSign,
  FileText,
  LineChart,
  TrendingUp,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";
import { CashflowSparkline } from "@/components/projects/CashflowSparkline";
import { MetricHint } from "@/components/projects/MetricHint";
import type { Project } from "@/types/navpro";
import {
  buildCompactHeadline,
  buildExecutiveHeadline,
  buildSensitivityNote,
  getBcrVerdict,
  getConclusionExplanation,
  METRIC_HELP,
} from "@/lib/executive-summary";
import {
  formatCurrency,
  formatDate,
  formatDurationCategory,
  formatPaybackMonths,
  formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type ViewMode = "executive" | "analyst";

function IdentityRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm font-medium text-foreground text-right min-w-0 break-words",
          mono && "font-mono text-xs"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  hint,
  help,
  accent,
  footer,
}: {
  label: string;
  value: string;
  hint?: string;
  help: string;
  accent?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 relative",
        accent ? "border-primary/30 bg-primary/[0.06]" : "border-border/80 bg-background/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pr-6">
          {label}
        </p>
        <MetricHint label={label} help={help} className="absolute top-3 right-3" />
      </div>
      <p className={cn("text-2xl sm:text-3xl font-bold tabular-nums mt-0.5", accent && "text-primary")}>
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{hint}</p> : null}
      {footer ? <div className="mt-2 pt-2 border-t border-border/50">{footer}</div> : null}
    </div>
  );
}

function SecondaryMetric({
  label,
  value,
  help,
  status,
}: {
  label: string;
  value: string;
  help: string;
  status?: "pass" | "warn" | "fail" | "neutral";
}) {
  const statusClass =
    status === "pass"
      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
      : status === "warn"
        ? "border-amber-500/35 bg-amber-500/[0.06]"
        : status === "fail"
          ? "border-destructive/30 bg-destructive/[0.05]"
          : "border-border/80 bg-muted/20";

  return (
    <div className={cn("rounded-lg border px-3 py-2.5 relative", statusClass)}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-5">
          {label}
        </p>
        <MetricHint label={label} help={help} className="absolute top-2 right-2" />
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function ExecutiveSummary({ project }: { project: Project }) {
  const [view, setView] = useState<ViewMode>("executive");
  const kpi = project.kpi;
  const periods = project.cashflow_monthly || [];
  const durationLabel = formatDurationCategory(project.duration_category);
  const bcrVerdict = kpi ? getBcrVerdict(kpi) : "unknown";
  const mandatory = kpi?.bcr_threshold_used?.mandatory;
  const minimum = kpi?.bcr_threshold_used?.minimum;
  const sensitivityNote = kpi ? buildSensitivityNote(kpi) : null;
  const analyst = view === "analyst";

  const bcrHint =
    mandatory != null && kpi?.bcr != null
      ? bcrVerdict === "pass"
        ? `Memenuhi ambang ${mandatory.toFixed(2)}`
        : bcrVerdict === "warn"
          ? `Di atas minimum ${minimum?.toFixed(2) ?? "—"}, di bawah mandatory`
          : `Di bawah ambang ${mandatory.toFixed(2)}`
      : METRIC_HELP.bcr;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {analyst
            ? "Tampilan analis — semua metrik & volume finansial"
            : "Tampilan direksi — fokus keputusan utama"}
        </p>
        <div
          className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40"
          role="tablist"
          aria-label="Mode tampilan ringkasan"
        >
          <Button
            type="button"
            variant={view === "executive" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            role="tab"
            aria-selected={view === "executive"}
            onClick={() => setView("executive")}
          >
            Ringkas
          </Button>
          <Button
            type="button"
            variant={view === "analyst" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            role="tab"
            aria-selected={view === "analyst"}
            onClick={() => setView("analyst")}
          >
            Detail
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border px-5 py-4 sm:px-6 sm:py-5",
          kpi?.conclusion === "LAYAK" && "border-emerald-500/25 bg-emerald-500/[0.04]",
          kpi?.conclusion === "BERSYARAT" && "border-amber-500/30 bg-amber-500/[0.05]",
          kpi?.conclusion === "TIDAK_LAYAK" && "border-destructive/25 bg-destructive/[0.04]",
          !kpi?.conclusion && "border-border bg-muted/20"
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {project.project_code}
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {project.project_name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {[project.customer_name, project.contract_number].filter(Boolean).join(" · ") || "—"}
            </p>
            {analyst && kpi ? (
              <p className="text-xs font-mono text-muted-foreground pt-1">{buildCompactHeadline(kpi)}</p>
            ) : null}
          </div>
          {kpi?.conclusion ? (
            <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kelayakan
                </span>
                <ConclusionBadge conclusion={kpi.conclusion} />
              </div>
              {analyst ? (
                <p className="text-sm text-muted-foreground max-w-md lg:text-right leading-relaxed">
                  {getConclusionExplanation(kpi.conclusion)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {kpi ? (
          <p className="mt-4 pt-4 border-t border-border/60 text-sm sm:text-base text-foreground leading-relaxed">
            {analyst ? buildExecutiveHeadline(kpi) : buildCompactHeadline(kpi)}
          </p>
        ) : (
          <p className="mt-4 pt-4 border-t border-border/60 text-sm text-muted-foreground">
            Belum ada hasil kalkulasi. Jalankan <strong>Hitung Ulang</strong> untuk mengisi ringkasan kelayakan.
          </p>
        )}

        {sensitivityNote && (
          <p
            className={cn(
              "mt-3 text-xs sm:text-sm rounded-lg px-3 py-2 leading-relaxed",
              kpi && kpi.xirr != null && kpi.wacc_used != null && kpi.xirr - kpi.wacc_used < 0.02
                ? "bg-amber-500/10 text-amber-900 dark:text-amber-100 border border-amber-500/25"
                : "bg-muted/50 text-muted-foreground border border-border/60"
            )}
          >
            <strong className="text-foreground font-semibold">Sensitivitas: </strong>
            {sensitivityNote}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Hasil Finansial</h4>
            </div>
            {periods.length >= 2 && (
              <Link
                href="#cashflow"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <LineChart className="h-3.5 w-3.5" />
                Lihat cashflow
              </Link>
            )}
          </div>

          {!kpi ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-8 text-center">
              Metrik XIRR, XNPV, dan BCR akan muncul setelah kalkulasi.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <HeroMetric
                  label="XIRR (per tahun)"
                  value={kpi.xirr != null ? formatPercent(kpi.xirr) : "—"}
                  hint={analyst ? METRIC_HELP.xirr : undefined}
                  help={METRIC_HELP.xirr}
                  accent
                />
                <HeroMetric
                  label="XNPV"
                  value={kpi.xnpv != null ? formatCurrency(kpi.xnpv) : "—"}
                  hint={
                    analyst
                      ? METRIC_HELP.xnpv
                      : periods.length >= 2
                        ? "Kumulatif 24 bulan pertama"
                        : undefined
                  }
                  help={METRIC_HELP.xnpv}
                  footer={
                    periods.length >= 2 ? (
                      <div className="flex items-center justify-between gap-2">
                        <CashflowSparkline periods={periods} />
                        <span className="text-[10px] text-muted-foreground">Arus kas kumulatif</span>
                      </div>
                    ) : null
                  }
                />
              </div>

              {analyst && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <SecondaryMetric
                      label="BCR / PI"
                      value={kpi.bcr != null ? Number(kpi.bcr).toFixed(3) : "—"}
                      help={bcrHint}
                      status={bcrVerdict === "unknown" ? "neutral" : bcrVerdict}
                    />
                    <SecondaryMetric
                      label="Payback"
                      value={formatPaybackMonths(kpi.payback_months)}
                      help={METRIC_HELP.payback}
                    />
                    {kpi.simple_roi != null ? (
                      <SecondaryMetric
                        label="Simple ROI"
                        value={formatPercent(kpi.simple_roi)}
                        help={METRIC_HELP.simple_roi}
                      />
                    ) : (
                      <div className="hidden sm:block" />
                    )}
                  </div>

                  {(kpi.capex_total != null || kpi.revenue_baseline_total != null) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {kpi.capex_total != null && (
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center sm:text-left">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total CAPEX</p>
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(kpi.capex_total)}</p>
                        </div>
                      )}
                      {kpi.revenue_baseline_total != null && (
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center sm:text-left">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pendapatan</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(kpi.revenue_baseline_total)}
                          </p>
                        </div>
                      )}
                      {kpi.opex_baseline_total != null && (
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center sm:text-left">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">OPEX</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(kpi.opex_baseline_total)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {!analyst && kpi.bcr != null && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full border border-border bg-muted/30 px-3 py-1 tabular-nums">
                    BCR <strong>{Number(kpi.bcr).toFixed(2)}</strong>
                  </span>
                  {kpi.payback_months != null && (
                    <span className="rounded-full border border-border bg-muted/30 px-3 py-1 tabular-nums">
                      Payback <strong>{formatPaybackMonths(kpi.payback_months)}</strong>
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
                  Dasar perhitungan
                </span>
                <span>
                  WACC{" "}
                  <strong className="text-foreground">
                    {kpi.wacc_used != null ? formatPercent(kpi.wacc_used) : "—"}
                  </strong>
                </span>
                {analyst && (
                  <>
                    <span className="hidden sm:inline text-border">|</span>
                    <span>
                      Inflasi/bln{" "}
                      <strong className="text-foreground">
                        {kpi.inflation_used != null ? formatPercent(kpi.inflation_used, 3) : "—"}
                      </strong>
                    </span>
                    <span className="hidden sm:inline text-border">|</span>
                    <span>
                      Kurs USD{" "}
                      <strong className="text-foreground">
                        {kpi.kurs_usd_used != null ? formatCurrency(kpi.kurs_usd_used) : "—"}
                      </strong>
                    </span>
                  </>
                )}
                {mandatory != null && (
                  <>
                    <span className="hidden sm:inline text-border">|</span>
                    <span>
                      Ambang BCR{" "}
                      <strong className="text-foreground">
                        {mandatory.toFixed(2)}
                        {minimum != null && analyst ? ` / min ${minimum.toFixed(2)}` : ""}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div
          className={cn(
            "lg:col-span-5 rounded-xl border border-border/80 bg-card/50 px-4 py-3",
            !analyst && "lg:row-span-1"
          )}
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/60">
            <Building2 className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">
              {analyst ? "Kontrak & Tim" : "Ringkasan kontrak"}
            </h4>
          </div>
          {analyst ? (
            <>
              <IdentityRow label="Kode proyek" value={project.project_code} mono />
              <IdentityRow label="PIC Sales" value={project.pic_sales} />
              {project.segment ? <IdentityRow label="Segmen" value={project.segment} mono /> : null}
              <IdentityRow
                label="Mulai kontrak"
                value={
                  <span className="inline-flex items-center justify-end gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {formatDate(project.contract_start_date)}
                  </span>
                }
              />
              <IdentityRow
                label="Durasi"
                value={`${project.project_duration_months} bulan (${durationLabel})`}
              />
              {project.customer_name ? (
                <IdentityRow
                  label="Pelanggan"
                  value={
                    <span className="inline-flex items-center justify-end gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {project.customer_name}
                    </span>
                  }
                />
              ) : null}
              {project.contract_number ? (
                <IdentityRow
                  label="No. kontrak"
                  value={
                    <span className="inline-flex items-center justify-end gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {project.contract_number}
                    </span>
                  }
                  mono
                />
              ) : null}
            </>
          ) : (
            <ul className="space-y-2 text-sm text-foreground">
              <li>
                <span className="text-muted-foreground">Durasi: </span>
                {project.project_duration_months} bulan · {durationLabel}
              </li>
              <li>
                <span className="text-muted-foreground">Mulai: </span>
                {formatDate(project.contract_start_date)}
              </li>
              {project.pic_sales ? (
                <li>
                  <span className="text-muted-foreground">PIC: </span>
                  {project.pic_sales}
                </li>
              ) : null}
              <li className="pt-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setView("analyst")}
                >
                  Tampilkan detail kontrak & metrik →
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
