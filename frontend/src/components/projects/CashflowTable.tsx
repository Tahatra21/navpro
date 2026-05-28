"use client";

import type { CashflowPeriod } from "@/types/navpro";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./cashflow-table.module.css";

function formatPeriodHeader(n: number) {
  return `Bulan ${n}`;
}

function formatPeriodDateShort(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

type RowDef = {
  key: string;
  label: string;
  rowClass?: string;
  getValue: (p: CashflowPeriod) => number | string;
  format?: (v: number) => string;
  colorize?: boolean;
};

const ROWS: RowDef[] = [
  {
    key: "date",
    label: "Tanggal Cashflow",
    getValue: (p) => p.period_date,
    format: (v) => formatPeriodDateShort(String(v)),
  },
  {
    key: "revenue",
    label: "Revenue (Pendapatan)",
    getValue: (p) => p.revenue,
    format: (v) => formatCurrency(v),
  },
  {
    key: "otc",
    label: "OTC",
    getValue: (p) => p.otc ?? 0,
    format: (v) => formatCurrency(v),
  },
  {
    key: "capex",
    label: "CAPEX (Belanja Modal)",
    getValue: (p) => p.capex,
    format: (v) => formatCurrency(v),
  },
  {
    key: "opex",
    label: "OPEX (Operasional)",
    getValue: (p) => p.opex,
    format: (v) => formatCurrency(v),
  },
  {
    key: "net",
    label: "Net Cashflow",
    rowClass: styles.netRow,
    getValue: (p) => p.net_cashflow,
    format: (v) => formatCurrency(v),
    colorize: true,
  },
  {
    key: "cum",
    label: "Cumulative Cashflow",
    rowClass: styles.cumRow,
    getValue: (p) => p.cumulative_cashflow ?? 0,
    format: (v) => formatCurrency(v),
    colorize: true,
  },
  {
    key: "active",
    label: "Active Flag",
    getValue: (p) => p.active_flag,
    format: (v) => String(v),
  },
];

function cellClass(value: number, colorize?: boolean) {
  if (!colorize || typeof value !== "number") return undefined;
  return value >= 0 ? styles.positive : styles.negative;
}

export function CashflowTable({ periods }: { periods: CashflowPeriod[] }) {
  if (!periods?.length) {
    return <p className="text-sm text-muted-foreground">Tabel cashflow belum tersedia.</p>;
  }

  const sorted = [...periods].sort((a, b) => a.period_number - b.period_number);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th className={styles.stickyCol}>Deskripsi Periode</th>
            {sorted.map((p) => (
              <th
                key={`h-${p.period_number}`}
                className={cn(p.active_flag === 0 && styles.periodColInactive)}
              >
                {formatPeriodHeader(p.period_number)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} className={row.rowClass}>
              <td className={styles.stickyCol}>{row.label}</td>
              {sorted.map((p) => {
                const raw = row.getValue(p);
                const num = typeof raw === "number" ? raw : 0;
                const display =
                  row.key === "date"
                    ? formatPeriodDateShort(p.period_date)
                    : row.format
                      ? row.format(typeof raw === "number" ? raw : num)
                      : String(raw);
                return (
                  <td
                    key={`${row.key}-${p.period_number}`}
                    className={cn(
                      styles.periodCol,
                      p.active_flag === 0 && styles.periodColInactive,
                      cellClass(num, row.colorize)
                    )}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
