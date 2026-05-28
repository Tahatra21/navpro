import { Router } from 'express';
import { query } from '../db.js';
import { authRequired, loadUser, rlsAfterLoadUser } from '../middleware/auth.js';
import { rowToProject } from '../db.js';
import { buildPortfolioOrgFinancial } from '../utils/portfolioOrgFinancial.js';
import {
  getProjectLifetimeFinancials,
  sumCapexTotal,
} from '../utils/projectLifetimeFinancials.js';

const router = Router();
router.use(authRequired);
router.use(loadUser);
router.use(rlsAfterLoadUser);

function getProjectScopeSql({ role, dbUser, params }) {
  if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
    return { where: '1=1', params };
  }

  if (role === 'SA' || role === 'STAFF') {
    params.push(dbUser?.id || null);
    return { where: `created_by = $${params.length}`, params };
  }

  if (role === 'ASMAN') {
    if (dbUser?.org_unit_id) {
      params.push(dbUser.org_unit_id);
      return { where: `org_unit_id = $${params.length}`, params };
    }
    params.push(dbUser?.id || null);
    return { where: `created_by = $${params.length}`, params };
  }

  if (role === 'MANAGER' || role === 'GM_SRM') {
    if (dbUser?.org_unit_id) {
      params.push(dbUser.org_unit_id);
      const idx = params.length;
      return {
        where: `segment = (SELECT segment FROM organization_units WHERE id = $${idx})`,
        params,
      };
    }
    return { where: '1=1', params };
  }

  return { where: '1=0', params };
}

function addWorkingDays(startDate, days) {
  const d = new Date(startDate);
  let remaining = Math.max(0, Number(days) || 0);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

function getQueueRoleForStatus(status) {
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'MANAGER';
  if (status === 'APPROVED_L1') return 'GM_SRM';
  return null;
}

function getStartTsForSla(p, roleKey) {
  const chain = p?.approval_chain || [];
  const submit = chain.find((x) => x.level === 'SUBMIT');
  const l1 = chain.find((x) => x.level === 'MANAGER');
  if (roleKey === 'GM_SRM') return l1?.decided_at || submit?.decided_at || p.updated_at || p.created_at;
  return submit?.decided_at || p.updated_at || p.created_at;
}

function getKursUsd(p) {
  const o = p?.kurs_usd_override;
  if (o != null && Number.isFinite(Number(o))) return Number(o);
  const k = p?.kpi?.kurs_usd_used;
  if (k != null && Number.isFinite(Number(k))) return Number(k);
  return 16500;
}

router.get('/portfolio', async (req, res) => {
  const params = [];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  const { rows } = await query(`SELECT * FROM projects WHERE ${scope.where}`, scope.params);
  const projects = rows.map(rowToProject);

  const active = projects.filter((p) => !['ARCHIVED', 'CANCELLED'].includes(p.status));
  const APPROVED_STATUSES = ['APPROVED_FINAL', 'APPROVED'];
  const PENDING_STATUSES = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED_L1',
    'IN_REVIEW_ASMAN',
    'IN_REVIEW_MANAGER',
  ];

  const approved = active.filter((p) => APPROVED_STATUSES.includes(p.status));
  const pending = active.filter((p) => PENDING_STATUSES.includes(p.status));
  const draft = active.filter((p) => p.status === 'DRAFT');
  const computed = active.filter((p) => p.status === 'COMPUTED');
  const rejected = active.filter((p) => p.status === 'REJECTED');

  const withKpi = active.filter((p) => p.kpi?.xirr != null && Number.isFinite(Number(p.kpi.xirr)));
  const needsCalculation = active.filter(
    (p) => ['DRAFT', 'COMPUTED'].includes(p.status) && (p.kpi?.xirr == null || !Number.isFinite(Number(p.kpi.xirr)))
  );

  const avgXirr =
    withKpi.length > 0
      ? withKpi.reduce((s, p) => s + (p.kpi?.xirr || 0), 0) / withKpi.length
      : 0;

  const totalXnpv = withKpi.reduce((s, p) => s + (p.kpi?.xnpv || 0), 0);

  const conclusionCounts = { LAYAK: 0, BERSYARAT: 0, TIDAK_LAYAK: 0, NONE: 0 };
  for (const p of withKpi) {
    const c = p.kpi?.conclusion;
    if (c && Object.prototype.hasOwnProperty.call(conclusionCounts, c)) conclusionCounts[c] += 1;
    else conclusionCounts.NONE += 1;
  }

  const { rows: assRows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  const globalAss = assRows[0]?.data || {};

  let total_capex = 0;
  let total_revenue = 0;
  let total_opex = 0;
  for (const p of active) {
    const fin = getProjectLifetimeFinancials(p, globalAss);
    if (fin) {
      total_capex += fin.capex;
      total_revenue += fin.revenue;
      total_opex += fin.opex;
    } else {
      total_capex += sumCapexTotal(p);
    }
  }

  const top_by_xirr = [...withKpi]
    .sort((a, b) => (b.kpi?.xirr || 0) - (a.kpi?.xirr || 0))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      project_code: p.project_code,
      project_name: p.project_name,
      status: p.status,
      xirr: p.kpi?.xirr ?? null,
      xnpv: p.kpi?.xnpv ?? null,
      bcr: p.kpi?.bcr ?? null,
      conclusion: p.kpi?.conclusion ?? null,
    }));

  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const p of active) {
    const bcr = p.kpi?.bcr || 0;
    if (bcr >= 1.23) riskCounts.LOW++;
    else if (bcr >= 1.08) riskCounts.MEDIUM++;
    else riskCounts.HIGH++;
  }

  const statusCounts = {};
  for (const p of active) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }

  const compact = String(req.query.compact || '').toLowerCase() === 'true';
  const payloadProjects = compact
    ? active.map((p) => {
        const fin = getProjectLifetimeFinancials(p, globalAss);
        const capex_total = fin?.capex ?? sumCapexTotal(p);
        return {
          id: p.id,
          created_by: p.created_by,
          project_code: p.project_code,
          project_name: p.project_name,
          status: p.status,
          org_unit_id: p.org_unit_id ?? null,
          segment: p.segment ?? null,
          project_duration_months: p.project_duration_months,
          duration_category: p.duration_category,
          contract_start_date: p.contract_start_date,
          kurs_usd_override: p.kurs_usd_override ?? null,
          kpi: {
            ...(p.kpi || {}),
            capex_total,
            lifetime_revenue_total: fin?.revenue ?? p.kpi?.lifetime_revenue_total,
            lifetime_opex_total: fin?.opex ?? p.kpi?.lifetime_opex_total,
          },
        };
      })
    : active;

  const { rows: orgUnitRows } = await query(
    `SELECT id, code, name, type, segment
     FROM organization_units
     WHERE is_active = true
     ORDER BY type, code`
  );
  const org_financial = buildPortfolioOrgFinancial(active, orgUnitRows, globalAss);

  res.json({
    kpi: {
      total_projects: active.length,
      approved_count: approved.length,
      pending_approval: pending.length,
      draft_count: draft.length,
      computed_count: computed.length,
      rejected_count: rejected.length,
      with_kpi_count: withKpi.length,
      needs_calculation_count: needsCalculation.length,
      avg_xirr: avgXirr,
      total_xnpv: totalXnpv,
      total_capex,
      total_revenue,
      total_opex,
      conclusion_counts: conclusionCounts,
    },
    top_by_xirr,
    risk_distribution: riskCounts,
    status_distribution: statusCounts,
    org_financial,
    projects: payloadProjects,
  });
});

// Dedicated approval queue page data (sorted by SLA due)
router.get('/approval-queue', async (req, res) => {
  const role = req.user.role;

  let statuses = [];
  if (role === 'MANAGER') statuses = ['SUBMITTED', 'UNDER_REVIEW'];
  else if (role === 'GM_SRM') statuses = ['APPROVED_L1'];
  else if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') statuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED_L1'];
  else return res.status(403).json({ error: 'Forbidden' });

  const params = [statuses];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  const scopedWhere = scope.where
    .replaceAll('created_by', 'p.created_by')
    .replaceAll('org_unit_id', 'p.org_unit_id')
    .replaceAll('segment', 'p.segment');
  const { rows } = await query(
    `SELECT p.*, u.full_name AS created_by_name
     FROM projects p
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.status = ANY($1::text[]) AND (${scopedWhere})
     ORDER BY p.updated_at DESC`,
    scope.params
  );
  const projects = rows.map(rowToProject);

  const { rows: slaRows } = await query(`SELECT * FROM sla_config ORDER BY role_key`);
  const slaByRole = new Map(slaRows.map((r) => [r.role_key, r]));

  const now = new Date();
  const items = projects
    .map((p, idx) => {
      const queueRole = getQueueRoleForStatus(p.status);
      const sla = queueRole ? slaByRole.get(queueRole) : null;
      const startTs = queueRole ? getStartTsForSla(p, queueRole) : null;
      const startDate = startTs ? new Date(startTs) : new Date(p.updated_at || p.created_at);
      const dueAt = sla ? addWorkingDays(startDate, sla.sla_working_days || 2) : null;
      const overdue = dueAt ? now.getTime() > dueAt.getTime() : false;
      return {
        project_id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        duration_months: p.project_duration_months,
        created_by: p.created_by,
        created_by_name: rows[idx]?.created_by_name || null,
        updated_at: p.updated_at || p.created_at,
        queue_role: queueRole,
        sla_working_days: sla?.sla_working_days ?? null,
        reminder_hours: sla?.reminder_hours ?? null,
        escalation_hours: sla?.escalation_hours ?? null,
        escalate_to_role: sla?.escalate_to_role ?? null,
        sla_start_at: startDate.toISOString(),
        sla_due_at: dueAt ? dueAt.toISOString() : null,
        sla_overdue: overdue,
      };
    })
    .sort((a, b) => {
      const da = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity;
      const db = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity;
      return da - db;
    });

  res.json({ items });
});

export default router;
