"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IdNumberInput } from "@/components/shared/IdNumberInput";
import { useToast } from "@/components/shared/toast";
import { navproApi } from "@/services/api";
import { formatCurrency, formatIdNumber, formatPercent, parseIdNumber } from "@/lib/format";
import type { HjtLastmileResult, HjtQuotationLine } from "@/types/hjt";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lineId?: string;
  line?: Pick<
    HjtQuotationLine,
    "backbone" | "uplink" | "capacity" | "harga_dasar" | "lastmile"
  >;
  onApplied: (lastmile: number) => void;
};

export function HjtLastmileDialog({ open, onOpenChange, lineId, line, onApplied }: Props) {
  const toast = useToast();
  const [capex, setCapex] = useState(formatIdNumber(50_000_000));
  const [monthlyRevenue, setMonthlyRevenue] = useState(formatIdNumber(5_000_000));
  const [backboneUnit, setBackboneUnit] = useState(formatIdNumber(97_000));
  const [uplinkUnit, setUplinkUnit] = useState(formatIdNumber(8_800));
  const [capacity, setCapacity] = useState(formatIdNumber(1));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HjtLastmileResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setBackboneUnit(formatIdNumber(line?.backbone || 97_000));
    setUplinkUnit(formatIdNumber(line?.uplink || 8_800));
    setCapacity(formatIdNumber(Math.max(1, Math.round(Number(line?.capacity) || 1))));
    const suggestedRevenue =
      Number(line?.harga_dasar) > 0
        ? Number(line?.harga_dasar)
        : Number(line?.lastmile) > 0
          ? Number(line?.lastmile)
          : 5_000_000;
    setMonthlyRevenue(formatIdNumber(suggestedRevenue));
    setCapex(formatIdNumber(50_000_000));
  }, [open, line]);

  async function runCalc() {
    const revenueParsed = parseIdNumber(monthlyRevenue);
    const capexParsed = parseIdNumber(capex);
    if (capexParsed <= 0) {
      toast.error("CAPEX wajib diisi.");
      return;
    }
    if (revenueParsed <= 0) {
      toast.error("Revenue/bulan wajib diisi (contoh: 10.000.000).");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const { lastmile } = await navproApi.hjtLastmileKkf({
        quotation_line_id: lineId,
        capex: capexParsed,
        monthly_revenue: revenueParsed,
        backbone_unit: parseIdNumber(backboneUnit),
        uplink_unit: parseIdNumber(uplinkUnit),
        capacity: Math.max(1, parseIdNumber(capacity)),
      });
      setResult(lastmile);
      const recommended = Number(lastmile.recommended_lastmile ?? 0);
      if (recommended > 0) {
        toast.success("Perhitungan lastmile selesai.");
      } else {
        toast.error(
          "Rekomendasi lastmile masih 0 — restart server dev (Ctrl+C lalu npm run dev) agar patch API aktif."
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghitung lastmile KKF");
    } finally {
      setBusy(false);
    }
  }

  const recommended = Number(result?.recommended_lastmile ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kalkulator Lastmile KKF</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">CAPEX</Label>
            <IdNumberInput
              value={capex}
              onChange={(v) => {
                setCapex(v);
                setResult(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Revenue / bulan</Label>
            <IdNumberInput
              value={monthlyRevenue}
              onChange={(v) => {
                setMonthlyRevenue(v);
                setResult(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Backbone unit (dari tarif BB)</Label>
            <IdNumberInput
              value={backboneUnit}
              onChange={(v) => {
                setBackboneUnit(v);
                setResult(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Uplink unit (dari tarif UL)</Label>
            <IdNumberInput
              value={uplinkUnit}
              onChange={(v) => {
                setUplinkUnit(v);
                setResult(null);
              }}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Kapasitas</Label>
            <IdNumberInput
              value={capacity}
              onChange={(v) => {
                setCapacity(v);
                setResult(null);
              }}
            />
          </div>
        </div>
        {result ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p>
              IRR: {result.irr != null ? formatPercent(result.irr) : "—"} · NPV:{" "}
              {result.npv != null ? formatCurrency(result.npv) : "—"}
              {result.bcr != null ? ` · BCR: ${Number(result.bcr).toFixed(2)}` : ""}
            </p>
            <p>
              Rekomendasi lastmile:{" "}
              <strong>{recommended > 0 ? formatCurrency(recommended) : "—"}</strong>
            </p>
            {result.is_feasible != null ? (
              <p className="text-xs text-muted-foreground">
                {result.is_feasible ? "Layak (BCR ≥ 1,4)" : "Belum layak (BCR < 1,4)"}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Angka pakai pemisah ribuan (10.000.000). Isi parameter lalu klik <strong>Hitung</strong>.
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button variant="secondary" onClick={runCalc} disabled={busy}>
            {busy ? "Menghitung…" : "Hitung"}
          </Button>
          <Button
            disabled={!result || recommended <= 0}
            onClick={() => {
              if (recommended > 0) {
                onApplied(Math.round(recommended));
                onOpenChange(false);
                setResult(null);
              }
            }}
          >
            Terapkan ke baris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
