"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, MapPin } from "lucide-react";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  apiOrgFinancialToRows,
  apiOrgFinancialTotals,
  buildOrgUnitFinancialRows,
  orgRowsToRevenueCost,
  type OrgUnitMeta,
  type RevenueVsCostRow,
} from "@/lib/portfolio-org-financial";
import type { PortfolioOrgFinancialUnit, Project } from "@/types/navpro";
import { formatCurrency } from "@/lib/format";

const DASHBOARD_ORG_ROLES = new Set(["SUPER_ADMIN", "FINANCE_ADMIN", "VP_SA"]);

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload?: RevenueVsCostRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const margin = row ? row.Revenue - row.Cost : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md max-w-[220px]">
      <p className="font-semibold text-foreground mb-1">{row?.fullName || label}</p>
      {row ? <p className="text-muted-foreground mb-1">{row.projectCount} proyek</p> : null}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(Number(p.value) || 0)}
        </p>
      ))}
      {row ? (
        <p className={margin >= 0 ? "text-emerald-700 mt-1" : "text-destructive mt-1"}>
          Margin kontrak: {formatCurrency(margin)}
        </p>
      ) : null}
    </div>
  );
}

function OrgRevenueCostPanel({
  title,
  icon: Icon,
  rows,
  emptyHint,
}: {
  title: string;
  icon: typeof Building2;
  rows: RevenueVsCostRow[];
  emptyHint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col min-h-[320px]">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Revenue &amp; OPEX = total arus kas kontrak (lifetime) · Cost = CAPEX + OPEX lifetime
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground flex-1 flex items-center justify-center py-8">{emptyHint}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={64} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} width={56} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" name="Revenue" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Cost" name="Cost" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/60">
                  <th className="text-left py-1 font-semibold">Unit</th>
                  <th className="text-right py-1 font-semibold">Rev</th>
                  <th className="text-right py-1 font-semibold">Cost</th>
                  <th className="text-right py-1 font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-border/40">
                    <td className="py-1 font-mono">{r.name}</td>
                    <td className="text-right tabular-nums">{formatCurrency(r.Revenue, true)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(r.Cost, true)}</td>
                    <td
                      className={`text-right tabular-nums font-medium ${
                        r.Revenue - r.Cost >= 0 ? "text-emerald-700" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(r.Revenue - r.Cost, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function hasOrgFinancialData(org?: {
  pusat?: PortfolioOrgFinancialUnit[];
  sbu?: PortfolioOrgFinancialUnit[];
}) {
  return (org?.pusat?.length ?? 0) > 0 || (org?.sbu?.length ?? 0) > 0;
}

export function RevenueVsCostByOrg({
  orgFinancial,
  projects,
  projectCount,
  loading,
}: {
  orgFinancial?: {
    pusat: PortfolioOrgFinancialUnit[];
    sbu: PortfolioOrgFinancialUnit[];
  };
  projects: Project[];
  projectCount: number;
  loading?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const useAdminOrgList = DASHBOARD_ORG_ROLES.has(role || "");

  const needsClientFallback = !hasOrgFinancialData(orgFinancial);

  const adminOrgQuery = useQuery({
    queryKey: ["admin-org-units-dashboard"],
    queryFn: () => navproApi.adminGetOrgUnits(),
    enabled: needsClientFallback && useAdminOrgList,
  });

  const configOrgQuery = useQuery({
    queryKey: ["config-org-units-dashboard"],
    queryFn: () => navproApi.getOrgUnits(),
    enabled: needsClientFallback && !useAdminOrgList,
  });

  const orgUnits: OrgUnitMeta[] = useMemo(() => {
    if (useAdminOrgList && adminOrgQuery.data?.org_units) {
      return adminOrgQuery.data.org_units;
    }
    return configOrgQuery.data?.org_units || [];
  }, [useAdminOrgList, adminOrgQuery.data, configOrgQuery.data]);

  const { pusatRows, sbuRows, pusatTotal, sbuTotal } = useMemo(() => {
    if (hasOrgFinancialData(orgFinancial)) {
      return {
        pusatRows: apiOrgFinancialToRows(orgFinancial!.pusat),
        sbuRows: apiOrgFinancialToRows(orgFinancial!.sbu),
        pusatTotal: apiOrgFinancialTotals(orgFinancial!.pusat),
        sbuTotal: apiOrgFinancialTotals(orgFinancial!.sbu),
      };
    }
    if (orgUnits.length && projects.length) {
      const pusatRaw = buildOrgUnitFinancialRows(projects, orgUnits, "PUSAT");
      const sbuRaw = buildOrgUnitFinancialRows(projects, orgUnits, "SBU");
      return {
        pusatRows: orgRowsToRevenueCost(pusatRaw),
        sbuRows: orgRowsToRevenueCost(sbuRaw),
        pusatTotal: apiOrgFinancialTotals(
          pusatRaw
            .filter((r) => r.projectCount > 0)
            .map((r) => ({
              id: r.id,
              code: r.code,
              name: r.name,
              type: r.type,
              project_count: r.projectCount,
              capex: r.CAPEX,
              opex: r.OPEX,
              revenue: r.Revenue,
              cost: r.CAPEX + r.OPEX,
            }))
        ),
        sbuTotal: apiOrgFinancialTotals(
          sbuRaw
            .filter((r) => r.projectCount > 0)
            .map((r) => ({
              id: r.id,
              code: r.code,
              name: r.name,
              type: r.type,
              project_count: r.projectCount,
              capex: r.CAPEX,
              opex: r.OPEX,
              revenue: r.Revenue,
              cost: r.CAPEX + r.OPEX,
            }))
        ),
      };
    }
    return { pusatRows: [], sbuRows: [], pusatTotal: [], sbuTotal: [] };
  }, [orgFinancial, orgUnits, projects]);

  const orgLoading =
    needsClientFallback && (useAdminOrgList ? adminOrgQuery.isLoading : configOrgQuery.isLoading);

  if (loading || orgLoading) {
    return <p className="text-sm text-muted-foreground py-8">Memuat grafik Revenue vs Cost…</p>;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Analisis Finansial
        </p>
        <h2 className="text-lg font-semibold text-foreground">Revenue vs Cost per Organisasi</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Agregat lifetime cashflow (selaras kalkulasi KKF / LAYAK) dari {projectCount} proyek portofolio — bukan
          baseline satu bulan
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OrgRevenueCostPanel
          title="Unit Pusat"
          icon={Building2}
          rows={pusatRows}
          emptyHint="Belum ada proyek pada unit Pusat."
        />
        <OrgRevenueCostPanel
          title="SBU Regional"
          icon={MapPin}
          rows={sbuRows}
          emptyHint="Belum ada proyek pada SBU."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 flex justify-between items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-foreground">Total Pusat</p>
            <p className="text-[10px] text-muted-foreground">{pusatTotal[0]?.fullName || "—"}</p>
          </div>
          {pusatTotal[0] ? (
            <div className="text-right text-xs tabular-nums">
              <p>
                Rev <strong className="text-[var(--chart-3)]">{formatCurrency(pusatTotal[0].Revenue, true)}</strong>
              </p>
              <p>
                Cost <strong className="text-[var(--chart-4)]">{formatCurrency(pusatTotal[0].Cost, true)}</strong>
              </p>
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 flex justify-between items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-foreground">Total SBU</p>
            <p className="text-[10px] text-muted-foreground">{sbuTotal[0]?.fullName || "—"}</p>
          </div>
          {sbuTotal[0] ? (
            <div className="text-right text-xs tabular-nums">
              <p>
                Rev <strong className="text-[var(--chart-3)]">{formatCurrency(sbuTotal[0].Revenue, true)}</strong>
              </p>
              <p>
                Cost <strong className="text-[var(--chart-4)]">{formatCurrency(sbuTotal[0].Cost, true)}</strong>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
