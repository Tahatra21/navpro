import { Card } from "@/components/ui/card";
import type { Project } from "@/types/navpro";
import { formatDate } from "@/lib/format";

function formatIdr(n: number | null | undefined) {
  const val = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(val);
}

export function ExecutiveSummary({ project }: { project: Project }) {
  const kpi = project.kpi;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Identitas Proyek</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <span className="font-mono">{project.project_code}</span>
            </div>
            <div className="text-foreground font-medium">{project.project_name}</div>
            <div>Customer: {project.customer_name || "-"}</div>
            <div>Contract: {project.contract_number || "-"}</div>
            <div>PIC Sales: {project.pic_sales || "-"}</div>
            <div>Mulai: {formatDate(project.contract_start_date)}</div>
            <div>Durasi: {project.project_duration_months} bulan</div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Ringkasan KPI</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              Conclusion: <span className="text-foreground font-medium">{kpi?.conclusion || "-"}</span>
            </div>
            <div>XIRR: {kpi?.xirr != null ? `${(kpi.xirr * 100).toFixed(2)}%` : "-"}</div>
            <div>XNPV: {kpi?.xnpv != null ? `Rp ${formatIdr(kpi.xnpv)}` : "-"}</div>
            <div>BCR: {kpi?.bcr != null ? Number(kpi.bcr).toFixed(3) : "-"}</div>
            <div>Payback: {kpi?.payback_months != null ? `${kpi.payback_months} bulan` : "-"}</div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Asumsi Digunakan</h3>
        <div className="text-sm text-muted-foreground grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div>WACC used: {kpi?.wacc_used != null ? `${(kpi.wacc_used * 100).toFixed(2)}%` : "-"}</div>
          <div>
            Inflation used:{" "}
            {kpi?.inflation_used != null ? `${(kpi.inflation_used * 100).toFixed(3)}%/bulan` : "-"}
          </div>
          <div>Kurs USD used: {kpi?.kurs_usd_used != null ? `Rp ${formatIdr(kpi.kurs_usd_used)}` : "-"}</div>
        </div>
      </Card>
    </div>
  );
}

