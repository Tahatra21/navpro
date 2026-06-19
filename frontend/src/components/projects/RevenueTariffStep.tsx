"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Calculator, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { WizardRevenueRow } from "@/lib/project-mappers";
import {
  buildRevenueRowsFromTariff,
  defaultTariffParams,
  SLA_LABELS,
  TARIFF_PACKAGES,
  type TariffCalculatorSnapshot,
  type TariffCommercialParams,
} from "@/lib/tariff-calculator";
import { buildYearlyRevenuePreview, REVENUE_MODE_LABELS } from "@/lib/revenue-yearly";
import type { RevenueMode } from "@/types/navpro";

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function RevenueTariffStep({
  durationMonths,
  customerName,
  revenueRows,
  setRevenueRows,
  tariffSnapshot,
  setTariffSnapshot,
  onDirty,
  kursUsd,
}: {
  durationMonths: number;
  customerName: string;
  revenueRows: WizardRevenueRow[];
  setRevenueRows: React.Dispatch<React.SetStateAction<WizardRevenueRow[]>>;
  tariffSnapshot: TariffCalculatorSnapshot | null;
  setTariffSnapshot: (s: TariffCalculatorSnapshot | null) => void;
  onDirty: () => void;
  kursUsd: number;
}) {
  const [params, setParams] = useState<TariffCommercialParams>(() => {
    if (tariffSnapshot?.params) return { ...tariffSnapshot.params };
    return defaultTariffParams(durationMonths);
  });
  const [calculatedDraft, setCalculatedDraft] = useState<WizardRevenueRow[] | null>(null);
  const [calcError, setCalcError] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (tariffSnapshot?.params) {
      setParams({ ...tariffSnapshot.params });
    }
  }, [tariffSnapshot]);

  const selectedPkg = TARIFF_PACKAGES.find((p) => p.id === params.packageId);

  const draftPreview = useMemo(() => {
    if (!calculatedDraft?.[0]) return [];
    return buildYearlyRevenuePreview(durationMonths, calculatedDraft[0], kursUsd);
  }, [calculatedDraft, durationMonths, kursUsd]);

  const runCalculator = () => {
    setCalcError("");
    const out = buildRevenueRowsFromTariff(params, durationMonths, customerName);
    if ("error" in out) {
      setCalcError(out.error);
      return;
    }
    setCalculatedDraft(out.rows);
    setTariffSnapshot(out.snapshot);
  };

  const applyToProject = () => {
    if (!calculatedDraft?.length) {
      setCalcError("Hitung tarif terlebih dahulu.");
      return;
    }
    setRevenueRows(calculatedDraft);
    onDirty();
    setCalculatedDraft(null);
    setCalcError("");
  };

  const totalRevOtc = revenueRows.reduce(
    (s, r) => s + (r.currency === "IDR" ? r.otc : r.otc * kursUsd),
    0
  );
  const totalRevSewa = revenueRows.reduce((s, r) => {
    const base =
      r.revenueMode === "step_yearly" ? r.harsatYear1 * r.qty : r.harsat * r.qty;
    return s + (r.currency === "IDR" ? base : base * kursUsd);
  }, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Langkah 5: Estimasi Revenue (KKF)</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Perkiraan revenue komersial untuk kelayakan investasi — bukan penawaran resmi HJT.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
        Untuk penawaran connectivity resmi sesuai kepdir, gunakan modul{" "}
        <Link href="/hjt/quotations" className="font-semibold underline">
          Penawaran HJT
        </Link>
        .
      </div>

      <p className="text-xs text-muted-foreground">
        Isi <strong>parameter komersial</strong> (paket, bandwidth, SLA, diskon). Revenue dihasilkan otomatis —
        bukan input harsat manual. Klik <strong>Hitung Tarif</strong>, tinjau preview, lalu{" "}
        <strong>Terapkan ke proyek</strong>.
      </p>

      <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Calculator size={14} /> Parameter komersial
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Paket / Produk</Label>
            <select
              value={params.packageId}
              onChange={(e) => {
                const packageId = e.target.value;
                const pkg = TARIFF_PACKAGES.find((p) => p.id === packageId);
                setParams((p) => ({
                  ...p,
                  packageId,
                  bandwidthMbps: pkg ? Math.max(p.bandwidthMbps, pkg.minMbps) : p.bandwidthMbps,
                }));
              }}
              className="h-8 w-full px-2 border border-input rounded-md text-sm bg-background"
            >
              {TARIFF_PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bandwidth (Mbps)</Label>
            <Input
              type="number"
              min={selectedPkg?.minMbps ?? 1}
              max={selectedPkg?.maxMbps ?? 100000}
              value={params.bandwidthMbps}
              onChange={(e) => setParams((p) => ({ ...p, bandwidthMbps: Number(e.target.value) }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SLA</Label>
            <select
              value={params.sla}
              onChange={(e) => setParams((p) => ({ ...p, sla: e.target.value as TariffCommercialParams["sla"] }))}
              className="h-8 w-full px-2 border border-input rounded-md text-sm bg-background"
            >
              {(Object.keys(SLA_LABELS) as Array<keyof typeof SLA_LABELS>).map((k) => (
                <option key={k} value={k}>
                  {SLA_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Diskon (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={params.discountPercent}
              onChange={(e) => setParams((p) => ({ ...p, discountPercent: Number(e.target.value) }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Qty (circuit / port)</Label>
            <Input
              type="number"
              min={1}
              value={params.qty}
              onChange={(e) => setParams((p) => ({ ...p, qty: Number(e.target.value) }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">OTC (kosong = default paket)</Label>
            <Input
              type="number"
              min={0}
              value={params.otcOverride ?? ""}
              placeholder={selectedPkg ? String(selectedPkg.defaultOtc) : "0"}
              onChange={(e) => {
                const v = e.target.value;
                setParams((p) => ({
                  ...p,
                  otcOverride: v === "" ? null : Number(v),
                }));
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lokasi</Label>
            <Input
              value={params.location}
              onChange={(e) => setParams((p) => ({ ...p, location: e.target.value }))}
              placeholder="Opsional"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Skema revenue hasil</Label>
            <select
              value={params.revenueMode}
              onChange={(e) =>
                setParams((p) => ({ ...p, revenueMode: e.target.value as RevenueMode }))
              }
              className="h-8 w-full px-2 border border-input rounded-md text-sm bg-background"
            >
              <option value="flat">Flat (tarif tetap)</option>
              <option value="escalation">Eskalasi % bulanan</option>
              <option value="step_yearly">Step tahunan (Y1 / Y2)</option>
            </select>
          </div>
          {params.revenueMode === "escalation" && (
            <div className="space-y-1">
              <Label className="text-xs">Eskalasi (%/bln)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={params.escalationPercent}
                onChange={(e) => setParams((p) => ({ ...p, escalationPercent: Number(e.target.value) }))}
                className="h-8 text-sm"
              />
            </div>
          )}
          {params.revenueMode === "step_yearly" && durationMonths > 12 && (
            <div className="space-y-1">
              <Label className="text-xs">Kenaikan Y2 vs Y1 (%)</Label>
              <Input
                type="number"
                min={0}
                value={params.year2UpliftPercent}
                onChange={(e) => setParams((p) => ({ ...p, year2UpliftPercent: Number(e.target.value) }))}
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" size="sm" variant="outline" onClick={runCalculator} className="h-8 gap-1">
            <Calculator size={14} /> Hitung Tarif
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={applyToProject}
            disabled={!calculatedDraft?.length}
            className="h-8 gap-1 bg-secondary text-secondary-foreground"
          >
            <CheckCircle2 size={14} /> Terapkan ke proyek
          </Button>
        </div>
        {calcError && <p className="text-xs text-destructive">{calcError}</p>}
      </div>

      {tariffSnapshot && (
        <div className="rounded-lg border border-border bg-background p-3 text-xs space-y-1">
          <p className="font-semibold text-foreground">Rincian kalkulator (snapshot)</p>
          <p className="text-muted-foreground">{tariffSnapshot.breakdown.formulaSummary}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <div>
              <span className="text-muted-foreground">List price/bln</span>
              <p className="font-mono font-medium">{formatRp(tariffSnapshot.breakdown.listPriceMonthly)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Setelah SLA</span>
              <p className="font-mono font-medium">{formatRp(tariffSnapshot.breakdown.afterSla)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Net Y1 / bln</span>
              <p className="font-mono font-medium text-primary">
                {formatRp(tariffSnapshot.breakdown.netMonthlyYear1)}
              </p>
            </div>
            {tariffSnapshot.breakdown.netMonthlyYear2 != null && (
              <div>
                <span className="text-muted-foreground">Net Y2 / bln</span>
                <p className="font-mono font-medium text-primary">
                  {formatRp(tariffSnapshot.breakdown.netMonthlyYear2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {calculatedDraft && calculatedDraft.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Preview revenue (hasil kalkulator — belum disimpan)</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="py-1 text-left">Layanan</th>
                <th className="py-1 text-left">Mode</th>
                <th className="py-1 text-right">Sewa/bln</th>
                <th className="py-1 text-right">OTC</th>
              </tr>
            </thead>
            <tbody>
              {calculatedDraft.map((r) => (
                <tr key={r.id}>
                  <td className="py-1">{r.serviceName}</td>
                  <td className="py-1">{REVENUE_MODE_LABELS[r.revenueMode]}</td>
                  <td className="py-1 text-right font-mono">
                    {r.revenueMode === "step_yearly"
                      ? `Y1 ${(r.harsatYear1 * r.qty).toLocaleString("id-ID")} / Y2 ${(r.harsatYear2 * r.qty).toLocaleString("id-ID")}`
                      : (r.harsat * r.qty).toLocaleString("id-ID")}
                  </td>
                  <td className="py-1 text-right font-mono">{r.otc.toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {draftPreview.length > 0 && (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left">Tahun</th>
                  <th className="text-center">Bulan</th>
                  <th className="text-right">Total tahun</th>
                </tr>
              </thead>
              <tbody>
                {draftPreview.map((row) => (
                  <tr key={row.year}>
                    <td>Tahun {row.year}</td>
                    <td className="text-center">
                      {row.startMonth}–{row.endMonth}
                    </td>
                    <td className="text-right font-mono">{row.yearTotal.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Revenue proyek (read-only — dari kalkulator)</p>
        <div className="overflow-auto rounded-lg border border-border max-h-48">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-2">Layanan</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2 text-right">Tarif</th>
                <th className="px-3 py-2 text-right">OTC</th>
                <th className="px-3 py-2 text-center">Periode</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {revenueRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Belum ada revenue. Hitung tarif lalu klik &quot;Terapkan ke proyek&quot;.
                  </td>
                </tr>
              ) : (
                revenueRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-3 py-2">{r.serviceName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{REVENUE_MODE_LABELS[r.revenueMode]}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.revenueMode === "step_yearly"
                        ? `Y1 ${(r.harsatYear1 * r.qty).toLocaleString("id-ID")} / Y2 ${(r.harsatYear2 * r.qty).toLocaleString("id-ID")}`
                        : (r.harsat * r.qty).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.otc.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-center">
                      {r.startPeriod}–{r.endPeriod}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRevenueRows((p) => p.filter((x) => x.id !== r.id));
                          onDirty();
                        }}
                        className="text-destructive p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-right text-sm font-bold">
          Total OTC: {formatRp(totalRevOtc)} | Sewa baseline: {formatRp(totalRevSewa)}/bln
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowManual((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {showManual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Input manual (lanjutan) — hanya jika di luar katalog tarif
      </button>
      {showManual && (
        <p className="text-xs text-muted-foreground border border-dashed rounded p-2">
          Untuk skenario di luar katalog, tambahkan baris revenue manual melalui API/edit data atau hubungi admin.
          Alur utama proyek memakai kalkulator tarif di atas.
        </p>
      )}
    </div>
  );
}
