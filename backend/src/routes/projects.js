import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query, rowToProject, projectToDetail, durationCategory } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { runCalculationOnProject } from '../services/calculationEngine.js';
import { addAuditLog, addNotification } from '../utils/audit.js';
import { validateProjectPayload } from '../utils/validate.js';
import { getQueue, isQueueEnabled } from '../services/queue.js';

const router = Router();
router.use(authRequired);

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

function canViewAll(role) {
  return ['SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'GM_SRM'].includes(role);
}

function formatIdr(n) {
  const val = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
}

async function loadProjectOr403(req, res) {
  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Not Found' });
    return null;
  }
  const proj = rowToProject(rows[0]);
  if (!canViewAll(req.user.role) && proj.created_by !== req.user.sub) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return proj;
}

router.get('/', async (req, res) => {
  const { status, search, duration_category, duration_months, page = '1', limit = '100' } =
    req.query;
  const params = [];
  let sql = `SELECT * FROM projects WHERE 1=1`;

  if (!canViewAll(req.user.role)) {
    params.push(req.user.sub);
    sql += ` AND created_by = $${params.length}`;
  }
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
  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  const proj = rowToProject(rows[0]);
  if (!canViewAll(req.user.role) && proj.created_by !== req.user.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
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

  const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  const proj = rowToProject(rows[0]);
  if (!canViewAll(req.user.role) && proj.created_by !== req.user.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

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
  const id = body.id || uuidv4();

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
      bcr_threshold_override = $8, detail = $9, updated_at = NOW()
     WHERE id = $10`,
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

  const { rows: lastVer } = await query(
    `SELECT COALESCE(MAX(version_number), 0)::int AS v FROM calculation_versions WHERE project_id = $1`,
    [req.params.id]
  );
  const verNum = (lastVer[0]?.v || 0) + 1;

  const inputSnapshot = {
    project_code: proj.project_code,
    project_name: proj.project_name,
    customer_name: proj.customer_name,
    contract_number: proj.contract_number,
    pic_sales: proj.pic_sales,
    contract_start_date: proj.contract_start_date,
    project_duration_months: proj.project_duration_months,
    duration_category: proj.duration_category,
    wacc_override: proj.wacc_override,
    inflation_rate_override: proj.inflation_rate_override,
    kurs_usd_override: proj.kurs_usd_override,
    bcr_threshold_override: proj.bcr_threshold_override,
    otc_amount: proj.otc_amount,
    capex: proj.capex || [],
    opex: proj.opex || [],
    revenue: proj.revenue || [],
  };
  const resultSnapshot = {
    kpi: proj.kpi,
    cashflow_monthly: proj.cashflow_monthly,
  };

  await query(
    `INSERT INTO calculation_versions
      (project_id, version_number, duration_months, input_snapshot, result_snapshot, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      req.params.id,
      verNum,
      proj.project_duration_months,
      JSON.stringify(inputSnapshot),
      JSON.stringify(resultSnapshot),
      req.user.sub,
      req.user.name,
    ]
  );

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
  proj.status = 'SUBMITTED';
  proj.approval_chain = (proj.approval_chain || []).filter((c) => c.level === 'SUBMIT');
  proj.approval_chain.push({
    level: 'SUBMIT',
    user: req.user.name,
    decided_at: new Date().toISOString(),
    status: 'SUBMITTED',
    comment: req.body?.comment || 'Diajukan untuk approval.',
  });

  await query(`UPDATE projects SET status = 'SUBMITTED', detail = $1, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(projectToDetail(proj)),
    req.params.id,
  ]);

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'SUBMIT_APPROVAL',
    oldVal: oldStatus,
    newVal: 'SUBMITTED',
  });

  await addNotification({
    title: 'Proyek Submitted',
    body: `Proyek ${proj.project_name} diajukan untuk ditinjau oleh Manager.`,
    projectId: req.params.id,
  });

  const { notifyApprovalEvent } = await import('../services/email.js');
  await notifyApprovalEvent({
    to: process.env.APPROVAL_NOTIFY_EMAIL || 'manager@navpro.app',
    projectName: proj.project_name,
    projectCode: proj.project_code,
    event: 'SUBMITTED',
    comment: req.body?.comment,
  });

  res.json({ project: proj });
});

router.post('/:id/approve', async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  let proj = rowToProject(existing[0]);
  const comment = req.body?.comment || 'Disetujui.';
  const role = req.user.role;

  if (role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(proj.status)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Status tidak valid untuk approval Manager' });
    }
    proj.status = 'APPROVED_L1';
    proj.approval_chain.push({
      level: 'MANAGER',
      user: req.user.name,
      decided_at: new Date().toISOString(),
      status: 'APPROVED_L1',
      comment,
    });
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      projectId: req.params.id,
      action: 'APPROVE_L1',
      oldVal: 'SUBMITTED',
      newVal: 'APPROVED_L1',
    });
  } else if (role === 'GM_SRM' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
    if (proj.status !== 'APPROVED_L1') {
      return res.status(400).json({ error: 'Bad Request', message: 'Status tidak valid untuk approval GM/SRM' });
    }
    proj.status = 'APPROVED_FINAL';
    proj.approval_chain.push({
      level: 'GM_SRM',
      user: req.user.name,
      decided_at: new Date().toISOString(),
      status: 'APPROVED_FINAL',
      comment,
    });
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      projectId: req.params.id,
      action: 'APPROVE_FINAL',
      oldVal: 'APPROVED_L1',
      newVal: 'APPROVED_FINAL',
    });
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

  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  let proj = rowToProject(existing[0]);
  const level =
    req.user.role === 'GM_SRM' || (req.user.role === 'FINANCE_ADMIN' && proj.status === 'APPROVED_L1')
      ? 'GM_SRM'
      : 'MANAGER';
  if (!['MANAGER', 'GM_SRM', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  proj.status = 'REJECTED';
  proj.approval_chain.push({
    level,
    user: req.user.name,
    decided_at: new Date().toISOString(),
    status: 'REJECTED',
    comment,
  });

  await query(`UPDATE projects SET status = 'REJECTED', detail = $1, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(projectToDetail(proj)),
    req.params.id,
  ]);

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: req.params.id,
    action: 'REJECT',
    oldVal: existing[0].status,
    newVal: 'REJECTED',
  });

  res.json({ project: proj });
});

router.get('/:id/audit-logs', async (req, res) => {
  const { rows: existing } = await query(`SELECT created_by FROM projects WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });
  if (!canViewAll(req.user.role) && existing[0].created_by !== req.user.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
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
