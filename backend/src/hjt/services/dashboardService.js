import { query } from '../../db.js';

function scopeWhere({ userId, role, params }) {
  const parts = [];
  if (!['SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'GM_SRM', 'ASMAN', 'VP_SA'].includes(role)) {
    params.push(userId);
    parts.push(`q.created_by = $${params.length}`);
  }
  return parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
}

function dealValue(q) {
  const v = q.harga_final ?? q.offer_recommended ?? q.grand_total_all;
  return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
}

export async function buildHjtDashboardSummary({ userId, role }) {
  const params = [];
  const where = scopeWhere({ userId, role, params });
  const join =
    ' LEFT JOIN hjt_region r ON r.id = q.region_id LEFT JOIN users u ON u.id = q.created_by';

  const { rows } = await query(
    `SELECT q.id, q.customer_name, q.contract_no, q.status, q.calc_mode,
            q.grand_total_all, q.harga_final, q.offer_recommended, q.margin_percent,
            q.linked_project_id, q.submitted_at, q.approved_at, q.updated_at,
            r.region_code, u.full_name AS creator_name
     FROM hjt_quotation q${join}${where}
     ORDER BY q.updated_at DESC`,
    params
  );

  const statusDist = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  const modeDist = { standard: 0, revenue_sharing: 0 };
  let pendingApproval = 0;
  let approvedCount = 0;
  let approvedValue = 0;
  let pipelineValue = 0;
  let linkedKkfCount = 0;
  let withMargin = 0;
  let marginSum = 0;
  const regionCounts = {};
  const topByValue = [];

  for (const q of rows) {
    statusDist[q.status] = (statusDist[q.status] || 0) + 1;
    if (q.calc_mode) modeDist[q.calc_mode] = (modeDist[q.calc_mode] || 0) + 1;
    if (q.status === 'submitted') pendingApproval += 1;
    if (q.status === 'approved') {
      approvedCount += 1;
      approvedValue += dealValue(q);
    }
    if (['submitted', 'approved'].includes(q.status)) {
      pipelineValue += dealValue(q);
    }
    if (q.linked_project_id) linkedKkfCount += 1;
    if (q.margin_percent != null && Number.isFinite(Number(q.margin_percent))) {
      withMargin += 1;
      marginSum += Number(q.margin_percent);
    }
    const rc = q.region_code || '—';
    regionCounts[rc] = (regionCounts[rc] || 0) + 1;
    if (['approved', 'submitted'].includes(q.status) && dealValue(q) > 0) {
      topByValue.push({
        id: q.id,
        customer_name: q.customer_name,
        contract_no: q.contract_no,
        status: q.status,
        calc_mode: q.calc_mode,
        region_code: q.region_code,
        deal_value: dealValue(q),
        approved_at: q.approved_at,
        updated_at: q.updated_at,
      });
    }
  }

  topByValue.sort((a, b) => b.deal_value - a.deal_value);

  let lastmileRiskCount = 0;
  if (rows.length) {
    const riskParams = [];
    const riskWhere = scopeWhere({ userId, role, params: riskParams });
    try {
      const { rows: riskRows } = await query(
        `SELECT COUNT(DISTINCT ql.quotation_id)::int AS c
         FROM hjt_quotation_line ql
         JOIN hjt_quotation q ON q.id = ql.quotation_id
         JOIN hjt_lastmile_kkf k ON k.quotation_line_id = ql.id
         ${riskWhere}${riskWhere ? ' AND' : ' WHERE'} k.is_feasible = false
         AND q.status IN ('submitted', 'approved')`,
        riskParams
      );
      lastmileRiskCount = riskRows[0]?.c ?? 0;
    } catch {
      lastmileRiskCount = 0;
    }
  }

  const regionTop = Object.entries(regionCounts)
    .map(([region_code, count]) => ({ region_code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const recentApproved = rows
    .filter((q) => q.status === 'approved')
    .slice(0, 5)
    .map((q) => ({
      id: q.id,
      customer_name: q.customer_name,
      contract_no: q.contract_no,
      region_code: q.region_code,
      deal_value: dealValue(q),
      calc_mode: q.calc_mode,
      approved_at: q.approved_at,
      linked_project_id: q.linked_project_id,
    }));

  return {
    kpi: {
      total_quotations: rows.length,
      approved_count: approvedCount,
      pending_approval: pendingApproval,
      rejected_count: statusDist.rejected || 0,
      draft_count: statusDist.draft || 0,
      approved_value: approvedValue,
      pipeline_value: pipelineValue,
      avg_margin_percent: withMargin > 0 ? marginSum / withMargin : null,
      linked_kkf_count: linkedKkfCount,
      lastmile_risk_count: lastmileRiskCount,
    },
    status_distribution: statusDist,
    mode_distribution: modeDist,
    region_top: regionTop,
    top_by_value: topByValue.slice(0, 5),
    recent_approved: recentApproved,
  };
}
