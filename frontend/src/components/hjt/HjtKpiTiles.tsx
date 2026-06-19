"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { HjtQuotation, HjtQuotationLine } from "@/types/hjt";
import { cn } from "@/lib/utils";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";

type Props = {
  quotation: HjtQuotation;
  lines?: HjtQuotationLine[];
  className?: string;
};

function parseSnapshot(q: HjtQuotation) {
  const raw = q.calc_snapshot;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) as NonNullable<HjtQuotation["calc_snapshot"]> & object;
  } catch {
    return null;
  }
}

export function HjtKpiTiles({ quotation, lines = [], className }: Props) {
  const lastmileLine = lines.find((l) => l.lastmile_bcr != null);
  const bcrOk = lastmileLine?.lastmile_feasible === true;
  const snap = parseSnapshot(quotation);
  const isModeB = quotation.calc_mode === "revenue_sharing";
  const modeB = snap?.result;

  const tiles = isModeB
    ? [
        { label: "Total / bulan", value: quotation.total_per_month },
        { label: "Grand Total Net", value: quotation.grand_total_all, highlight: true },
        { label: "Harga Negosiasi", value: quotation.offer_recommended ?? modeB?.harga_negosiasi },
        {
          label: "Min Quotation Final",
          value: quotation.offer_floor ?? modeB?.revenue_split?.min_quot_final,
        },
        {
          label: "Margin HJT",
          text:
            quotation.margin_percent != null
              ? formatPercent(Number(quotation.margin_percent) / 100)
              : modeB?.margin_hjt != null
                ? formatPercent(Number(modeB.margin_hjt))
                : "—",
        },
        {
          label: "Split ICON : Kawasan",
          text:
            modeB?.revenue_split?.share_icon != null
              ? `${Math.round(Number(modeB.revenue_split.share_icon) * 100)} : ${Math.round(Number(modeB.revenue_split.share_kawasan) * 100)}`
              : "70 : 30",
        },
        { label: "Lain-lain", value: quotation.other_expense_total },
        { label: "Harga Final", value: quotation.harga_final },
      ]
    : [
        { label: "Total / bulan", value: quotation.total_per_month },
        { label: "Grand Total HJT", value: quotation.grand_total_hjt },
        { label: "Lain-lain", value: quotation.other_expense_total },
        { label: "Grand Total All", value: quotation.grand_total_all, highlight: true },
        { label: "Floor", value: quotation.offer_floor },
        { label: "Rekomendasi", value: quotation.offer_recommended },
        {
          label: "Margin rekomendasi",
          text:
            quotation.margin_percent != null
              ? formatPercent(Number(quotation.margin_percent) / 100)
              : "20%",
        },
        { label: "Harga Final", value: quotation.harga_final },
      ];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              "rounded-xl border bg-card p-3 shadow-sm",
              t.highlight && "border-primary/30 bg-primary/5"
            )}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t.label}
            </p>
            <p className="text-sm font-bold mt-1 tabular-nums">
              {"text" in t && t.text
                ? t.text
                : t.value != null
                  ? formatCurrency(Number(t.value))
                  : "—"}
            </p>
          </div>
        ))}
      </div>
      {lastmileLine ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Lastmile KKF BCR:</span>
          <span className="font-mono font-semibold">
            {lastmileLine.lastmile_bcr != null
              ? Number(lastmileLine.lastmile_bcr).toFixed(3)
              : "—"}
          </span>
          <ConclusionBadge conclusion={bcrOk ? "LAYAK" : "TIDAK_LAYAK"} />
        </div>
      ) : null}
    </div>
  );
}
