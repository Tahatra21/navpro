"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin } from "lucide-react";
import { CostRevenueChart, type CostRevenueChartType } from "@/components/dashboard/CostRevenueChart";
import { navproApi } from "@/services/api";
import {
  buildOrgUnitFinancialRows,
  orgRowsToChartRows,
  pickDefaultOrgSelection,
  type OrgUnitFinancialRow,
} from "@/lib/portfolio-org-financial";
import type { Project } from "@/types/navpro";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type UnitTab = "PUSAT" | "SBU";

export function OrgUnitFinancialAnalysis({
  projects,
  loading,
}: {
  projects: Project[];
  loading?: boolean;
}) {
  const [unitTab, setUnitTab] = useState<UnitTab>("PUSAT");
  const [chartType, setChartType] = useState<CostRevenueChartType>("bar");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const orgUnitsQuery = useQuery({
    queryKey: ["config-org-units"],
    queryFn: () => navproApi.getOrgUnits(),
  });

  const orgUnits = orgUnitsQuery.data?.org_units || [];

  const rowsForTab = useMemo(
    () => buildOrgUnitFinancialRows(projects, orgUnits, unitTab),
    [projects, orgUnits, unitTab]
  );

  useEffect(() => {
    setSelectedIds(pickDefaultOrgSelection(rowsForTab, 8));
  }, [unitTab, rowsForTab]);

  const selectedRows = useMemo(() => {
    if (chartType === "pie") {
      const withProjects = rowsForTab.filter((r) => r.projectCount > 0);
      return withProjects.length ? withProjects : rowsForTab;
    }
    if (selectedIds.length === 0) return rowsForTab.slice(0, 8);
    return rowsForTab.filter((r) => selectedIds.includes(r.id));
  }, [rowsForTab, selectedIds, chartType]);

  const chartRows = useMemo(() => orgRowsToChartRows(selectedRows), [selectedRows]);

  const pusatCount = orgUnits.filter((u) => u.type === "PUSAT").length;
  const sbuCount = orgUnits.filter((u) => u.type === "SBU").length;

  const toggleUnit = (id: string) => {
    setSelectedIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 8) return cur;
      return [...cur, id];
    });
  };

  if (loading || orgUnitsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground py-8">Memuat agregat unit…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">CAPEX, OPEX &amp; Revenue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agregat per unit organisasi — Pusat ({pusatCount} unit) dan SBU regional ({sbuCount} unit)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as CostRevenueChartType)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie (agregat tab)</option>
          </select>
          {chartType !== "pie" && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
              onClick={() => setSelectedIds(pickDefaultOrgSelection(rowsForTab, 8))}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div
        className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40"
        role="tablist"
        aria-label="Tipe unit organisasi"
      >
        <button
          type="button"
          role="tab"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            unitTab === "PUSAT" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setUnitTab("PUSAT")}
        >
          <Building2 className="h-3.5 w-3.5" />
          Unit Pusat
        </button>
        <button
          type="button"
          role="tab"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            unitTab === "SBU" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setUnitTab("SBU")}
        >
          <MapPin className="h-3.5 w-3.5" />
          SBU Regional
        </button>
      </div>

      {chartType !== "pie" && (
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {rowsForTab.map((r) => (
            <UnitChip
              key={r.id}
              row={r}
              active={selectedIds.includes(r.id)}
              onClick={() => toggleUnit(r.id)}
            />
          ))}
        </div>
      )}

      {chartType !== "pie" && selectedIds.length >= 8 && (
        <p className="text-[10px] text-amber-700">Maksimal 8 unit per bandingan chart.</p>
      )}

      <CostRevenueChart rows={chartRows} type={chartType} />

      <UnitSummaryTable rows={rowsForTab} />
    </div>
  );
}

function UnitChip({
  row,
  active,
  onClick,
}: {
  row: OrgUnitFinancialRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${row.name} · ${row.projectCount} proyek`}
      className={cn(
        "text-left text-[11px] px-2.5 py-1.5 rounded-lg border max-w-[200px]",
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "border-border text-muted-foreground hover:bg-muted",
        row.projectCount === 0 && "opacity-50"
      )}
    >
      <span className="font-mono font-semibold block">{row.code}</span>
      <span className="text-[10px] opacity-80">{row.projectCount} proyek</span>
    </button>
  );
}

function UnitSummaryTable({ rows }: { rows: OrgUnitFinancialRow[] }) {
  const withData = rows.filter((r) => r.projectCount > 0);
  if (withData.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        Belum ada proyek terhubung ke unit pada kategori ini.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left font-semibold px-3 py-2">Unit</th>
            <th className="text-right font-semibold px-2 py-2">Proyek</th>
            <th className="text-right font-semibold px-2 py-2">CAPEX</th>
            <th className="text-right font-semibold px-2 py-2">OPEX</th>
            <th className="text-right font-semibold px-3 py-2">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {withData.map((r) => (
            <tr key={r.id} className="border-t border-border/50">
              <td className="px-3 py-2">
                <span className="font-mono font-semibold text-foreground">{r.code}</span>
                <span className="block text-[10px] text-muted-foreground truncate max-w-[180px]">{r.name}</span>
              </td>
              <td className="text-right px-2 py-2 tabular-nums">{r.projectCount}</td>
              <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(r.CAPEX, true)}</td>
              <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(r.OPEX, true)}</td>
              <td className="text-right px-3 py-2 tabular-nums">{formatCurrency(r.Revenue, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
