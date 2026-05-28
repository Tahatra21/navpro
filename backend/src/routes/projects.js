import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query, rowToProject, projectToDetail, durationCategory } from '../db.js';
import { authRequired, loadUser, requireRoles, rlsAfterLoadUser } from '../middleware/auth.js';
import { runCalculationOnProject } from '../services/calculationEngine.js';
import { addAuditLog } from '../utils/audit.js';
import { notifyMatrix } from '../utils/notifyMatrix.js';
import { validateProjectPayload } from '../utils/validate.js';
import { getQueue, isQueueEnabled } from '../services/queue.js';
import { resolveProjectOrgUnit } from '../utils/orgUnit.js';
import { computeDueAtForRole } from '../utils/sla.js';
import { createCalculationSnapshot } from '../utils/calculationSnapshot.js';

const router = Router();
router.use(authRequired);
router.use(loadUser);
router.use(rlsAfterLoadUser);

async function getAssumptions() {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  return rows[0]?.data || {
    wacc_annual: 9.72,
    inflation_annual: 3.0,
    inflation_monthly: 0.2466,
    bcr_mandatory: 1.23,
    bcr_minimum: 1.08,
    kurs_usd: 16500,
  };
}

function canViewAllLegacy(role) {
  return ['SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'GM_SRM'].includes(role);
}

function getProjectScopeSql({ role, dbUser, params }) {
  // BRD v2.0 scoping (soft-enforced to avoid breaking existing envs):
  // - Admins: all
  // - SA/STAFF: own only
  // - ASMAN: unit scope if assigned, else own only
  // - MANAGER/GM_SRM: segment scope if assigned, else legacy (all)
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
    // Until org assignment is rolled out everywhere, keep legacy behavior to avoid "empty data" surprises.
    return { where: '1=1', params };
  }

  return { where: '1=0', params };
}

function formatIdr(n) {
  const val = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
}

async function loadProjectOr403(req, res) {
  const params = [req.params.id];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  const { rows } = await query(`SELECT * FROM projects WHERE id = $1 AND ${scope.where}`, scope.params);
  if (!rows[0]) {
    res.status(404).json({ error: 'Not Found' });
    return null;
  }
  const proj = rowToProject(rows[0]);
  return proj;
}

router.get('/', async (req, res) => {
  const { status, search, duration_category, duration_months, page = '1', limit = '100' } =
    req.query;
  const params = [];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  let sql = `SELECT * FROM projects WHERE ${scope.where}`;
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  if (duration_category) {
    params.push(duration_category);
    sql += ` AND duration_category = $${params.length}`;
  }
  if (duration_months) {
    const months = parseInt(duration_months, 10);
    if (Number.isInteger(months) && months >= 1 && months <= 120) {
      params.push(months);
      sql += ` AND project_duration_months = $${params.length}`;
    }
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (project_name ILIKE $${params.length} OR project_code ILIKE $${params.length})`;
  }

  sql += ` ORDER BY created_at DESC`;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  params.push(parseInt(limit, 10), offset);
  sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  res.json({ projects: rows.map(rowToProject) });
});

router.get('/:id', async (req, res) => {
  const proj = await loadProjectOr403(req, res);
  if (!proj) return;
  const { rows: vrows } = await query(
    `SELECT version_number, duration_months, created_at, created_by_name, result_snapshot
     FROM calculation_versions WHERE project_id = $1 ORDER BY version_number DESC`,
    [req.params.id]
  );
  proj.versions = vrows.map((v) => ({
    version_number: v.version_number,
    duration_months: v.duration_months,
    created_at: v.created_at,
    created_by_name: v.created_by_name,
    xirr: v.result_snapshot?.kpi?.xirr,
    xnpv: v.result_snapshot?.kpi?.xnpv,
    bcr: v.result_snapshot?.kpi?.bcr,
    conclusion: v.result_snapshot?.kpi?.conclusion,
  }));
  res.json({ project: proj });
});

router.get('/:id/versions', async (req, res) => {
  const params = [req.params.id];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  const { rows } = await query(`SELECT * FROM projects WHERE id = $1 AND ${scope.where}`, scope.params);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  const { rows: vrows } = await query(
    `SELECT version_number, duration_months, created_at, created_by_name, result_snapshot
     FROM calculation_versions WHERE project_id = $1 ORDER BY version_number DESC`,
    [req.params.id]
  );
  res.json({
    versions: vrows.map((v) => ({
      version_number: v.version_number,
      duration_months: v.duration_months,
      created_at: v.created_at,
      created_by_name: v.created_by_name,
      kpi: v.result_snapshot?.kpi || null,
    })),
  });
});

router.get('/:id/versions/:ver', async (req, res) => {
  const ver = parseInt(req.params.ver, 10);
  if (!Number.isInteger(ver) || ver < 1) {
    return res.status(400).json({ error: 'Bad Request', message: 'Version number tidak valid' });
  }

  const params = [req.params.id];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  const { rows } = await query(`SELECT * FROM projects WHERE id = $1 AND ${scope.where}`, scope.params);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });

  const { rows: vrows } = await query(
    `SELECT version_number, duration_months, created_at, created_by_name, input_snapshot, result_snapshot
     FROM calculation_versions WHERE project_id = $1 AND version_number = $2`,
    [req.params.id, ver]
  );
  if (!vrows[0]) return res.status(404).json({ error: 'Not Found', message: 'Version tidak ditemukan' });

  res.json({
    version: {
      version_number: vrows[0].version_number,
      duration_months: vrows[0].duration_months,
      created_at: vrows[0].created_at,
      created_by_name: vrows[0].created_by_name,
      input_snapshot: vrows[0].input_snapshot,
      result_snapshot: vrows[0].result_snapshot,
    },
  });
});

router.get('/:id/export.xlsx', async (req, res) => {
  const proj = await loadProjectOr403(req, res);
  if (!proj) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'NAVPRO';
  wb.created = new Date();

  // Sheet 08 - Ringkasan (identitas + KPI)
  const wsSummary = wb.addWorksheet('08_Ringkasan');
  wsSummary.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 48 },
  ];
  wsSummary.addRows([
    { field: 'Project Code', value: proj.project_code },
    { field: 'Project Name', value: proj.project_name },
    { field: 'Customer', value: proj.customer_name || '' },
    { field: 'Contract Number', value: proj.contract_number || '' },
    { field: 'PIC Sales', value: proj.pic_sales || '' },
    { field: 'Contract Start Date', value: proj.contract_start_date },
    { field: 'Duration (months)', value: proj.project_duration_months },
    { field: 'Status', value: proj.status },
    { field: 'Conclusion', value: proj.kpi?.conclusion || '' },
    { field: 'XIRR', value: proj.kpi?.xirr ?? null },
    { field: 'XNPV', value: proj.kpi?.xnpv ?? null },
    { field: 'BCR', value: proj.kpi?.bcr ?? null },
    { field: 'Payback (months)', value: proj.kpi?.payback_months ?? null },
    { field: 'WACC used', value: proj.kpi?.wacc_used ?? null },
    { field: 'Inflation used', value: proj.kpi?.inflation_used ?? null },
    { field: 'Kurs USD used', value: proj.kpi?.kurs_usd_used ?? null },
  ]);
  wsSummary.getColumn('field').font = { bold: true };
  wsSummary.getRow(1).font = { bold: true };

  // Sheet 07 - Cashflow bulanan
  const wsCf = wb.addWorksheet('07_Cashflow');
  wsCf.columns = [
    { header: 'Period', key: 'period_number', width: 10 },
    { header: 'Date', key: 'period_date', width: 14 },
    { header: 'Revenue', key: 'revenue', width: 16 },
    { header: 'OTC', key: 'otc', width: 16 },
    { header: 'OPEX', key: 'opex', width: 16 },
    { header: 'CAPEX', key: 'capex', width: 16 },
    { header: 'Net Cashflow', key: 'net_cashflow', width: 16 },
    { header: 'Cumulative', key: 'cumulative_cashflow', width: 16 },
    { header: 'Active', key: 'active_flag', width: 10 },
  ];
  const rows = Array.isArray(proj.cashflow_monthly) ? proj.cashflow_monthly : [];
  wsCf.addRows(rows);
  wsCf.getRow(1).font = { bold: true };
  for (const k of ['revenue', 'otc', 'opex', 'capex', 'net_cashflow', 'cumulative_cashflow']) {
    wsCf.getColumn(k).numFmt = '#,##0';
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = `NAVPRO_${proj.project_code}_Cashflow.xlsx`.replace(/[^\w.-]+/g, '_');

  // Optional: store to MinIO/S3 and return a presigned URL
  if (String(req.query.presign || '').toLowerCase() === 'true') {
    try {
      const { isObjectStoreEnabled, uploadBufferAndPresignGet } = await import(
        '../services/objectStore.js'
      );
      if (!isObjectStoreEnabled()) {
        return res.status(400).json({
          error: 'OBJECT_STORE_NOT_CONFIGURED',
          message:
            'Object store belum dikonfigurasi. Set MINIO_ENDPOINT, MINIO_BUCKET, MINIO_ACCESS_KEY, MINIO_SECRET_KEY.',
        });
      }

      const key = `exports/${proj.id}/${Date.now()}_${filename}`;
      const out = await uploadBufferAndPresignGet({
        key,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(buf),
        expiresInSeconds: Math.min(
          Math.max(Number(req.query.expires || 600), 60),
          3600
        ),
      });
      return res.json({ presigned: out });
    } catch (e) {
      console.error('presign export.xlsx failed', e);
      return res.status(500).json({ error: 'PRESIGN_FAILED' });
    }
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

router.get('/:id/export.pdf', async (req, res) => {
  const proj = await loadProjectOr403(req, res);
  if (!proj) return;

  const filename = `NAVPRO_${proj.project_code}_ExecutiveSummary.pdf`.replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);

  doc.fontSize(18).text('Executive Summary — Kajian Kelayakan Finansial', { align: 'left' });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor('#333333').text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown(1.0);
  doc.fillColor('#000000');

  doc.fontSize(13).text('Identitas Proyek', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Project Code: ${proj.project_code}`);
  doc.text(`Project Name: ${proj.project_name}`);
  if (proj.customer_name) doc.text(`Customer: ${proj.customer_name}`);
  if (proj.contract_number) doc.text(`Contract Number: ${proj.contract_number}`);
  if (proj.pic_sales) doc.text(`PIC Sales: ${proj.pic_sales}`);
  doc.text(`Start Date: ${proj.contract_start_date}`);
  doc.text(`Durasi: ${proj.project_duration_months} bulan (${proj.duration_category})`);
  doc.text(`Status: ${proj.status}`);

  doc.moveDown(0.9);
  doc.fontSize(13).text('Ringkasan KPI', { underline: true });
  doc.moveDown(0.5);
  const kpi = proj.kpi || {};
  doc.fontSize(11);
  doc.text(`Conclusion: ${kpi.conclusion || '-'}`);
  doc.text(`XIRR: ${kpi.xirr != null ? (kpi.xirr * 100).toFixed(2) + '%' : '-'}`);
  doc.text(`XNPV: ${kpi.xnpv != null ? 'Rp ' + formatIdr(kpi.xnpv) : '-'}`);
  doc.text(`BCR: ${kpi.bcr != null ? Number(kpi.bcr).toFixed(3) : '-'}`);
  doc.text(`Payback: ${kpi.payback_months != null ? `${kpi.payback_months} bulan` : '-'}`);

  doc.moveDown(0.9);
  doc.fontSize(13).text('Asumsi Digunakan', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`WACC used: ${kpi.wacc_used != null ? (kpi.wacc_used * 100).toFixed(2) + '%' : '-'}`);
  doc.text(
    `Inflation used: ${
      kpi.inflation_used != null ? (kpi.inflation_used * 100).toFixed(3) + '%/bulan' : '-'
    }`
  );
  doc.text(`Kurs USD used: ${kpi.kurs_usd_used != null ? 'Rp ' + formatIdr(kpi.kurs_usd_used) : '-'}`);

  doc.moveDown(0.9);
  doc.fontSize(13).text('Catatan', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  doc.text(
    'Dokumen ini dihasilkan otomatis oleh NAVPRO berdasarkan input proyek dan engine kalkulasi. ' +
      'Untuk detail cashflow lengkap, gunakan export Excel (07_Cashflow).'
  );
  doc.fillColor('#000000');

  doc.end();
});

router.post('/', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  const body = req.body || {};
  const { ok, errors } = validateProjectPayload(body, { allowPartial: false });
  if (!ok) return res.status(400).json({ error: 'Bad Request', message: 'Validasi gagal', details: errors });

  const orgResolved = await resolveProjectOrgUnit(req, body.org_unit_id);
  if (orgResolved.error) {
    return res.status(400).json({
      error: orgResolved.error,
      message: orgResolved.message,
    });
  }
  const { orgUnitId, segment } = orgResolved;

  const year = new Date().getFullYear();
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS c FROM projects WHERE project_code LIKE $1`,
    [`NAVPRO-${year}-%`]
  );
  const seq = (countRows[0]?.c || 0) + 1;
  const project_code = body.project_code || `NAVPRO-${year}-${String(seq).padStart(4, '0')}`;
  const months = body.project_duration_months || 12;

  let proj = {
    ...body,
    project_code,
    status: body.status || 'DRAFT',
    project_duration_months: months,
    duration_category: durationCategory(months),
    capex: body.capex || [],
    opex: body.opex || [],
    revenue: body.revenue || [],
    approval_chain: body.approval_chain || [],
    versions: body.versions || [],
  };

  const assumptions = await getAssumptions();
  proj = runCalculationOnProject(proj, assumptions);

  const detail = projectToDetail(proj);
  const id = uuidv4();

  await query(
    `INSERT INTO projects (
      id, created_by, org_unit_id, segment, project_code, project_name, status,
      project_duration_months, duration_category, contract_start_date,
      wacc_override, inflation_rate_override, bcr_threshold_override, detail
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      req.user.sub,
      orgUnitId,
      segment,
      project_code,
      body.project_name || 'Proyek Baru',
      proj.status,
      months,
      proj.duration_category,
      body.contract_start_date || new Date().toISOString().substring(0, 10),
      body.wacc_override ?? null,
      body.inflation_rate_override ?? null,
      body.bcr_threshold_override ? JSON.stringify(body.bcr_threshold_override) : null,
      JSON.stringify(detail),
    ]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: id,
    action: 'CREATE_PROJECT',
    oldVal: null,
    newVal: `${project_code} (${body.project_name})`,
  });

  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [id]);
  res.status(201).json({ project: rowToProject(rows[0]) });
});

router.put('/:id', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  const current = rowToProject(existing[0]);
  if (current.status !== 'DRAFT' && current.status !== 'COMPUTED' && current.status !== 'REJECTED') {
    return res.status(400).json({ error: 'Bad Request', message: 'Proyek tidak dapat diedit pada status ini' });
  }

  const body = req.body || {};
  const { ok, errors } = validateProjectPayload(body, { allowPartial: true });
  if (!ok) return res.status(400).json({ error: 'Bad Request', message: 'Validasi gagal', details: errors });

  let proj = { ...current, ...body, id: req.params.id };
  if (!current.org_unit_id && body.org_unit_id) {
    const orgResolved = await resolveProjectOrgUnit(req, body.org_unit_id);
    if (orgResolved.error) {
      return res.status(400).json({ error: orgResolved.error, message: orgResolved.message });
    }
    proj.org_unit_id = orgResolved.orgUnitId;
    proj.segment = orgResolved.segment;
  } else {
    proj.org_unit_id = current.org_unit_id || null;
    proj.segment = current.segment || null;
  }
  const months = proj.project_duration_months;
  proj.duration_category = durationCategory(months);

  const assumptions = await getAssumptions();
  proj = runCalculationOnProject(proj, assumptions);

  const detail = projectToDetail(proj);

  await query(
    `UPDATE projects SET
      project_name = $1, status = $2, project_duration_months = $3,
      duration_category = $4, contract_start_date = $5,
      wacc_override = $6, inflation_rate_override = $7,
      bcr_threshold_override = $8, detail = $9,
      org_unit_id = $10, segment = $11, updated_at = NOW()
     WHERE id = $12`,
    [
      proj.project_name,
      proj.status,
      months,
      proj.duration_category,
      proj.contract_start_date,
      proj.wacc_override ?? null,
      proj.inflation_rate_override ?? null,
      proj.bcr_threshold_override ? JSON.stringify(proj.bcr_threshold_override) : null,
      JSON.stringify(detail),
      proj.org_unit_id ?? null,
      proj.segment ?? null,
      req.params.id,
    ]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'SAVE_PROJECT',
    oldVal: null,
    newVal: `${proj.project_code} - ${proj.project_name}`,
  });

  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  res.json({ project: rowToProject(rows[0]) });
});

router.delete('/:id', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  const proj = rowToProject(rows[0]);
  if (proj.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Bad Request', message: 'Hanya proyek DRAFT yang dapat dihapus' });
  }
  await query(`DELETE FROM projects WHERE id = $1`, [req.params.id]);
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'DELETE_PROJECT',
    oldVal: proj.project_code,
    newVal: null,
  });
  res.json({ ok: true });
});

router.post('/:id/calculate', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA', 'MANAGER'), async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  let proj = rowToProject(existing[0]);
  const { ok, errors } = validateProjectPayload(proj, { allowPartial: false });
  if (!ok) return res.status(400).json({ error: 'Bad Request', message: 'Validasi gagal', details: errors });

  const assumptions = await getAssumptions();
  proj = runCalculationOnProject(proj, assumptions);
  proj.status = 'COMPUTED';

  const verNum = await createCalculationSnapshot({
    projectId: req.params.id,
    proj,
    userId: req.user.sub,
    userName: req.user.name,
    snapshotType: 'CALC',
  });

  proj.versions = proj.versions || [];
  proj.versions.push({
    version_number: verNum,
    duration_months: proj.project_duration_months,
    created_at: new Date().toISOString(),
    created_by_name: req.user.name,
    xirr: proj.kpi.xirr,
    xnpv: proj.kpi.xnpv,
    bcr: proj.kpi.bcr,
    conclusion: proj.kpi.conclusion,
  });

  const detail = projectToDetail(proj);
  await query(
    `UPDATE projects SET status = 'COMPUTED', detail = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(detail), req.params.id]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'CALCULATE',
    oldVal: null,
    newVal: `${proj.project_code} (Versi ${verNum}, XIRR: ${(proj.kpi.xirr * 100).toFixed(2)}%)`,
  });

  res.json({ project: proj, status: 'COMPUTED' });
});

router.post('/:id/calculate-async', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA', 'MANAGER'), async (req, res) => {
// Async calculate via BullMQ (requires REDIS_URL)
  if (!isQueueEnabled()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Queue belum aktif. Set REDIS_URL untuk menggunakan calculate async.',
    });
  }

  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  const proj = rowToProject(existing[0]);
  const { ok, errors } = validateProjectPayload(proj, { allowPartial: false });
  if (!ok) return res.status(400).json({ error: 'Bad Request', message: 'Validasi gagal', details: errors });

  const q = getQueue('navpro-calc');
  const job = await q.add(
    'calculate',
    { projectId: req.params.id, actor: { userId: req.user.sub, userName: req.user.name } },
    { removeOnComplete: 1000, removeOnFail: 1000 }
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'CALC_ENQUEUED',
    oldVal: null,
    newVal: `job:${job.id}`,
  });

  res.status(202).json({ ok: true, job_id: String(job.id) });
});

router.post('/:id/submit', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  let proj = rowToProject(existing[0]);
  const oldStatus = proj.status;
  // BRD v2.0: SUBMITTED -> IN_REVIEW_ASMAN (system routes to ASMAN)
  if (!['DRAFT', 'COMPUTED', 'REJECTED'].includes(proj.status)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Status tidak valid untuk submit' });
  }

  if (!proj.kpi || proj.kpi.xirr == null) {
    return res.status(400).json({
      error: 'CALC_REQUIRED',
      message: 'Jalankan kalkulasi terlebih dahulu sebelum submit approval.',
    });
  }

  if (!proj.project_name?.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Nama proyek wajib diisi.' });
  }

  const projectOrgUnitId = existing[0].org_unit_id || null;
  const projectSegment = existing[0].segment || null;
  if (!projectOrgUnitId || !projectSegment) {
    return res.status(400).json({
      error: 'ORG_NOT_ASSIGNED',
      message:
        'Project belum memiliki org_unit/segment. Pastikan user pembuat sudah di-assign org unit, lalu buat ulang project atau lakukan backfill.',
    });
  }

  // Find ASMAN in same org unit
  const { rows: asmanRows } = await query(
    `SELECT u.id, u.full_name
     FROM users u
     WHERE u.role = 'ASMAN' AND u.is_active = true AND u.org_unit_id = $1
     ORDER BY u.created_at ASC
     LIMIT 1`,
    [projectOrgUnitId]
  );
  const asman = asmanRows[0];
  if (!asman) {
    return res.status(400).json({
      error: 'ASMAN_NOT_FOUND',
      message: 'Asman untuk unit ini belum tersedia. Assign user role ASMAN ke org unit yang sama.',
    });
  }

  const submitComment = req.body?.comment || 'Diajukan untuk approval.';
  const verNum = await createCalculationSnapshot({
    projectId: req.params.id,
    proj: { ...proj, submit_comment: submitComment },
    userId: req.user.sub,
    userName: req.user.name,
    snapshotType: 'SUBMIT',
  });

  proj.versions = proj.versions || [];
  proj.versions.push({
    version_number: verNum,
    duration_months: proj.project_duration_months,
    created_at: new Date().toISOString(),
    created_by_name: req.user.name,
    xirr: proj.kpi?.xirr,
    xnpv: proj.kpi?.xnpv,
    bcr: proj.kpi?.bcr,
    conclusion: proj.kpi?.conclusion,
  });

  proj.status = 'IN_REVIEW_ASMAN';
  proj.approval_chain = (proj.approval_chain || []).filter((c) => c.level === 'SUBMIT');
  proj.approval_chain.push({
    level: 'SUBMIT',
    user: req.user.name,
    decided_at: new Date().toISOString(),
    status: 'SUBMITTED',
    comment: submitComment,
  });

  const asmanDueAt = await computeDueAtForRole('ASMAN', new Date());

  // Create approval step 1 (ASMAN)
  const { rows: stepRows } = await query(
    `INSERT INTO approval_steps (project_id, step_order, approver_level, approver_role, assigned_to, org_unit_id, status, due_at)
     VALUES ($1, 1, 'ASMAN', 'ASMAN', $2, $3, 'PENDING', $4)
     ON CONFLICT (project_id, step_order) DO UPDATE SET
       assigned_to = EXCLUDED.assigned_to,
       org_unit_id = EXCLUDED.org_unit_id,
       status = 'PENDING',
       due_at = EXCLUDED.due_at,
       acted_at = NULL,
       comments = NULL
     RETURNING id`,
    [req.params.id, asman.id, projectOrgUnitId, asmanDueAt]
  );

  await query(
    `UPDATE projects
     SET status = $1, submitted_at = NOW(), current_version = $2, detail = $3, updated_at = NOW()
     WHERE id = $4`,
    [proj.status, verNum, JSON.stringify(projectToDetail(proj)), req.params.id]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'SUBMIT_APPROVAL',
    oldVal: oldStatus,
    newVal: `${proj.status} (snapshot v${verNum})`,
  });

  await notifyMatrix({
    event: 'SUBMITTED',
    projectId: req.params.id,
    projectCode: proj.project_code,
    projectName: proj.project_name,
    userIds: [asman.id],
    comment: req.body?.comment || `Diajukan oleh ${req.user.name}`,
  });

  res.json({ project: proj });
});

router.post('/:id/approve', async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  let proj = rowToProject(existing[0]);
  const comment = req.body?.comment || 'Disetujui.';
  const role = req.user.role;

  // V2 workflow: ASMAN -> MANAGER
  if (role === 'ASMAN') {
    if (proj.status !== 'IN_REVIEW_ASMAN') {
      return res.status(400).json({ error: 'Bad Request', message: 'Status tidak valid untuk approval Asman' });
    }

    // Ensure pending step 1 exists and is assigned to this user
    const { rows: stepRows } = await query(
      `SELECT * FROM approval_steps WHERE project_id = $1 AND step_order = 1 LIMIT 1`,
      [req.params.id]
    );
    const step1 = stepRows[0];
    if (!step1 || step1.status !== 'PENDING' || step1.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden', message: 'Approval step Asman tidak valid' });
    }

    // mark step approved
    await query(
      `UPDATE approval_steps SET status = 'APPROVED', comments = $1, acted_at = NOW() WHERE id = $2`,
      [comment, step1.id]
    );

    // find MANAGER for segment
    const segment = existing[0].segment || null;
    if (!segment) {
      return res.status(400).json({ error: 'Bad Request', message: 'Segment project belum tersedia' });
    }
    const { rows: mgrRows } = await query(
      `SELECT u.id, u.full_name
       FROM users u
       LEFT JOIN organization_units ou ON ou.id = u.org_unit_id
       WHERE u.role = 'MANAGER' AND u.is_active = true AND ou.segment = $1
       ORDER BY u.created_at ASC
       LIMIT 1`,
      [segment]
    );
    const mgr = mgrRows[0];
    if (!mgr) {
      return res.status(400).json({ error: 'MANAGER_NOT_FOUND', message: 'Manager untuk segment ini belum tersedia.' });
    }

    const mgrDueAt = await computeDueAtForRole('MANAGER', new Date());

    // create/update step 2
    await query(
      `INSERT INTO approval_steps (project_id, step_order, approver_level, approver_role, assigned_to, org_unit_id, status, due_at)
       VALUES ($1, 2, 'MANAGER', 'MANAGER', $2, $3, 'PENDING', $4)
       ON CONFLICT (project_id, step_order) DO UPDATE SET
         assigned_to = EXCLUDED.assigned_to,
         status = 'PENDING',
         due_at = EXCLUDED.due_at,
         acted_at = NULL,
         comments = NULL`,
      [req.params.id, mgr.id, existing[0].org_unit_id, mgrDueAt]
    );

    proj.status = 'IN_REVIEW_MANAGER';
    proj.approval_chain.push({
      level: 'ASMAN',
      user: req.user.name,
      decided_at: new Date().toISOString(),
      status: 'APPROVED',
      comment,
    });
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      projectId: req.params.id,
      action: 'APPROVE_ASMAN',
      oldVal: 'IN_REVIEW_ASMAN',
      newVal: 'IN_REVIEW_MANAGER',
    });
    await notifyMatrix({
      event: 'APPROVED',
      projectId: req.params.id,
      projectCode: proj.project_code,
      projectName: proj.project_name,
      userIds: [mgr.id],
      comment: `Disetujui Asman — menunggu Manager. ${comment}`,
    });
  } else if (role === 'MANAGER') {
    if (proj.status !== 'IN_REVIEW_MANAGER') {
      return res.status(400).json({ error: 'Bad Request', message: 'Status tidak valid untuk approval Manager' });
    }

    const { rows: stepRows } = await query(
      `SELECT * FROM approval_steps WHERE project_id = $1 AND step_order = 2 LIMIT 1`,
      [req.params.id]
    );
    const step2 = stepRows[0];
    if (!step2 || step2.status !== 'PENDING' || step2.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden', message: 'Approval step Manager tidak valid' });
    }
    await query(
      `UPDATE approval_steps SET status = 'APPROVED', comments = $1, acted_at = NOW() WHERE id = $2`,
      [comment, step2.id]
    );

    proj.status = 'APPROVED';
    proj.approval_chain.push({
      level: 'MANAGER',
      user: req.user.name,
      decided_at: new Date().toISOString(),
      status: 'APPROVED',
      comment,
    });
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      projectId: req.params.id,
      action: 'APPROVE_MANAGER',
      oldVal: 'IN_REVIEW_MANAGER',
      newVal: 'APPROVED',
    });
    await query(
      `UPDATE projects SET approved_at = NOW(), approved_by = $1 WHERE id = $2`,
      [req.user.sub, req.params.id]
    );

    const pdfPath = `/api/v1/projects/${req.params.id}/export.pdf`;
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      projectId: req.params.id,
      action: 'PDF_AVAILABLE',
      oldVal: null,
      newVal: pdfPath,
    });

    const { rows: creatorRows } = await query(`SELECT created_by FROM projects WHERE id = $1`, [
      req.params.id,
    ]);
    await notifyMatrix({
      event: 'APPROVED',
      projectId: req.params.id,
      projectCode: proj.project_code,
      projectName: proj.project_name,
      userIds: creatorRows[0]?.created_by ? [creatorRows[0].created_by] : [],
      comment: `Disetujui final. Unduh PDF executive summary dari menu Export PDF. ${comment}`,
    });
  } else if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Gunakan akun approver (ASMAN/MANAGER) untuk approve.' });
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await query(`UPDATE projects SET status = $1, detail = $2, updated_at = NOW() WHERE id = $3`, [
    proj.status,
    JSON.stringify(projectToDetail(proj)),
    req.params.id,
  ]);

  res.json({ project: proj });
});

router.post('/:id/reject', async (req, res) => {
  const comment = req.body?.comment;
  if (!comment?.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Catatan penolakan wajib diisi' });
  }
  if (String(comment).trim().length < 20) {
    return res.status(400).json({ error: 'Bad Request', message: 'Catatan penolakan minimal 20 karakter' });
  }

  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  let proj = rowToProject(existing[0]);
  const role = req.user.role;
  if (!['ASMAN', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (proj.status === 'IN_REVIEW_ASMAN') {
    if (role !== 'ASMAN') return res.status(403).json({ error: 'Forbidden' });
    const { rows: stepRows } = await query(
      `SELECT * FROM approval_steps WHERE project_id = $1 AND step_order = 1 LIMIT 1`,
      [req.params.id]
    );
    const step1 = stepRows[0];
    if (!step1 || step1.status !== 'PENDING' || step1.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden', message: 'Approval step Asman tidak valid' });
    }
    await query(`UPDATE approval_steps SET status='REJECTED', comments=$1, acted_at=NOW() WHERE id=$2`, [
      comment,
      step1.id,
    ]);
  } else if (proj.status === 'IN_REVIEW_MANAGER') {
    if (role !== 'MANAGER') return res.status(403).json({ error: 'Forbidden' });
    const { rows: stepRows } = await query(
      `SELECT * FROM approval_steps WHERE project_id = $1 AND step_order = 2 LIMIT 1`,
      [req.params.id]
    );
    const step2 = stepRows[0];
    if (!step2 || step2.status !== 'PENDING' || step2.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden', message: 'Approval step Manager tidak valid' });
    }
    await query(`UPDATE approval_steps SET status='REJECTED', comments=$1, acted_at=NOW() WHERE id=$2`, [
      comment,
      step2.id,
    ]);
  } else {
    // legacy / other statuses
    if (!['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Status tidak valid untuk reject' });
    }
  }

  proj.status = 'DRAFT';
  proj.approval_chain.push({
    level: role,
    user: req.user.name,
    decided_at: new Date().toISOString(),
    status: 'REJECTED_TO_DRAFT',
    comment,
  });

  await query(
    `UPDATE projects
     SET status = 'DRAFT', rejection_reason = $1, rejected_by = $2, rejected_at = NOW(),
         detail = $3, updated_at = NOW()
     WHERE id = $4`,
    [comment, req.user.sub, JSON.stringify(projectToDetail(proj)), req.params.id]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'REJECT',
    oldVal: existing[0].status,
    newVal: 'DRAFT',
  });

  await notifyMatrix({
    event: 'REJECTED',
    projectId: req.params.id,
    projectCode: proj.project_code,
    projectName: proj.project_name,
    userIds: existing[0].created_by ? [existing[0].created_by] : [],
    comment,
  });

  res.json({ project: proj });
});

router.get('/:id/audit-logs', async (req, res) => {
  const params = [req.params.id];
  const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
  const { rows: existing } = await query(`SELECT created_by FROM projects WHERE id = $1 AND ${scope.where}`, scope.params);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });
  const { rows } = await query(
    `SELECT id, user_id, user_name, action, old_val, new_val, created_at
     FROM audit_logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [req.params.id]
  );
  res.json({ logs: rows });
});

router.post('/:id/duplicate', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  const source = rowToProject(existing[0]);
  const year = new Date().getFullYear();
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS c FROM projects WHERE project_code LIKE $1`,
    [`NAVPRO-${year}-%`]
  );
  const seq = (countRows[0]?.c || 0) + 1;
  const project_code = `NAVPRO-${year}-${String(seq).padStart(4, '0')}`;
  const id = uuidv4();
  const months = source.project_duration_months || 12;

  const proj = {
    ...source,
    id,
    project_code,
    project_name: `${source.project_name} (Salinan)`,
    status: 'DRAFT',
    approval_chain: [],
    versions: [],
    duration_category: durationCategory(months),
  };

  const detail = projectToDetail(proj);
  await query(
    `INSERT INTO projects (
      id, created_by, project_code, project_name, status,
      project_duration_months, duration_category, contract_start_date,
      wacc_override, inflation_rate_override, bcr_threshold_override, detail
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      req.user.sub,
      project_code,
      proj.project_name,
      'DRAFT',
      months,
      proj.duration_category,
      source.contract_start_date,
      source.wacc_override ?? null,
      source.inflation_rate_override ?? null,
      source.bcr_threshold_override ? JSON.stringify(source.bcr_threshold_override) : null,
      JSON.stringify(detail),
    ]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: id,
    action: 'DUPLICATE_PROJECT',
    oldVal: source.project_code,
    newVal: project_code,
  });

  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [id]);
  res.status(201).json({ project: rowToProject(rows[0]) });
});

router.post('/:id/archive', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });
  let proj = rowToProject(existing[0]);
  proj.status = 'ARCHIVED';
  await query(`UPDATE projects SET status = 'ARCHIVED', detail = $1, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(projectToDetail(proj)),
    req.params.id,
  ]);
  res.json({ project: proj });
});

export default router;
