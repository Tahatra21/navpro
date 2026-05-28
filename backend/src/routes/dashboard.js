import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { rowToProject } from '../db.js';

const router = Router();
router.use(authRequired);

function canViewAll(role) {
  return ['SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'GM_SRM'].includes(role);
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

function sumCapexTotal(p) {
  if (p?.kpi?.capex_total != null && Number.isFinite(Number(p.kpi.capex_total))) {
    return Number(p.kpi.capex_total);
  }
  const kurs = getKursUsd(p);
  return (p.capex || []).reduce((s, c) => {
    const amt = parseFloat(String(c.amount || 0));
    return s + (c.currency === 'USD' ? amt * kurs : amt);
  }, 0);
}

function sumOpexBaseline(p) {
  const kurs = getKursUsd(p);
  return (p.opex || []).reduce((s, o) => {
    if (o.is_percent) return s;
    const amt = parseFloat(String(o.baseline_amount || 0));
    return s + (o.currency === 'USD' ? amt * kurs : amt);
  }, 0);
}

function sumRevenueBaseline(p) {
  const kurs = getKursUsd(p);
  return (p.revenue || []).reduce((s, r) => {
    const h = parseFloat(String(r.harsat ?? r.monthly_amount ?? 0));
    const q = parseFloat(String(r.qty ?? 1));
    return s + (r.currency === 'USD' ? h * q * kurs : h * q);
  }, 0);
}

router.get('/portfolio', async (req, res) => {
  const params = [];
  let sql = `SELECT * FROM projects`;
  if (!canViewAll(req.user.role)) {
    params.push(req.user.sub);
    sql += ` WHERE created_by = $1`;
  }
  const { rows } = await query(sql, params);
  const projects = rows.map(rowToProject);

  const active = projects.filter((p) => !['ARCHIVED', 'CANCELLED'].includes(p.status));
  const approved = active.filter((p) => p.status === 'APPROVED_FINAL');
  const pending = active.filter((p) =>
    ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED_L1'].includes(p.status)
  );

  const avgXirr =
    approved.length > 0
      ? approved.reduce((s, p) => s + (p.kpi?.xirr || 0), 0) / approved.length
      : 0;

  const totalXnpv = approved.reduce((s, p) => s + (p.kpi?.xnpv || 0), 0);

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
        const capex_total = sumCapexTotal(p);
        const opex_baseline_total = sumOpexBaseline(p);
        const revenue_baseline_total = sumRevenueBaseline(p);
        return {
          id: p.id,
          created_by: p.created_by,
          project_code: p.project_code,
          project_name: p.project_name,
          status: p.status,
          project_duration_months: p.project_duration_months,
          duration_category: p.duration_category,
          contract_start_date: p.contract_start_date,
          kurs_usd_override: p.kurs_usd_override ?? null,
          kpi: {
            ...(p.kpi || {}),
            capex_total,
            opex_baseline_total,
            revenue_baseline_total,
          },
        };
      })
    : active;

  res.json({
    kpi: {
      total_projects: active.length,
      approved_count: approved.length,
      pending_approval: pending.length,
      avg_xirr: avgXirr,
      total_xnpv: totalXnpv,
    },
    risk_distribution: riskCounts,
    status_distribution: statusCounts,
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

  const { rows } = await query(
    `SELECT p.*, u.full_name AS created_by_name
     FROM projects p
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.status = ANY($1::text[])
     ORDER BY p.updated_at DESC`,
    [statuses]
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
