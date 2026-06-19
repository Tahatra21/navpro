import { Router } from 'express';
import multer from 'multer';
import { authRequired, loadUser, rlsAfterLoadUser } from '../middleware/auth.js';
import {
  requireHjtTariffAdmin,
  requireHjtQuotation,
  requireHjtRead,
} from '../hjt/middleware/hjtRbac.js';
import {
  listTariffVersions,
  createTariffVersion,
  activateTariffVersion,
  lookupTariff,
  searchTariffGrid,
  upsertTariffRow,
  deleteTariffRow,
  listProducts,
  listRegions,
  lookupIbbc,
  getActiveTariffVersion,
  getVersionById,
  assertDraftVersion,
} from '../hjt/services/tariffService.js';
import {
  createQuotation,
  updateQuotation,
  getQuotationFull,
  listQuotations,
  upsertQuotationLine,
  deleteQuotationLine,
  upsertOtherExpense,
  deleteOtherExpense,
  runCalculateQuotation,
  createLastmileKkf,
  createKkfProjectFromQuotation,
} from '../hjt/services/quotationService.js';
import {
  submitQuotation,
  approveQuotation,
  rejectQuotation,
  getApprovalQueue,
  getApprovalTimeline,
} from '../hjt/services/approvalService.js';
import { exportQuotationPdf, exportQuotationXlsx } from '../hjt/services/exportService.js';
import {
  createImportRecord,
  parseUploadBuffer,
  parseAndValidateImport,
  commitImport,
  buildImportTemplateBuffer,
  getImportPreview,
} from '../hjt/services/importService.js';
import { logHjtAudit } from '../hjt/seedHjt.js';
import { query } from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(authRequired);
router.use(loadUser);
router.use(rlsAfterLoadUser);

// ── Catalog (read) ─────────────────────────────────────────────
router.get('/tariff-versions', requireHjtRead, async (req, res) => {
  const versions = await listTariffVersions({ status: req.query.status });
  res.json({ versions });
});

router.get('/products', requireHjtRead, async (req, res) => {
  const products = await listProducts(req.query.q);
  res.json({ products });
});

router.get('/regions', requireHjtRead, async (_req, res) => {
  const regions = await listRegions();
  res.json({ regions });
});

router.get('/tariff', requireHjtRead, async (req, res) => {
  const version =
    (req.query.version && (await getVersionById(req.query.version))) ||
    (await getActiveTariffVersion());
  if (!version) return res.status(404).json({ error: 'Not Found', message: 'Versi tarif tidak ditemukan' });

  const row = await lookupTariff({
    versionId: version.id,
    productId: Number(req.query.product),
    regionId: Number(req.query.region),
  });
  res.json({ version: version.kepdir_ref, ...row });
});

router.get('/ibbc', requireHjtRead, async (req, res) => {
  const version = (await getActiveTariffVersion()) || null;
  if (!version) return res.status(404).json({ error: 'Not Found' });
  const items = await lookupIbbc({
    versionId: version.id,
    type: req.query.type,
    cir: req.query.cir,
    bw: req.query.bw,
  });
  res.json({ items });
});

// ── Quotations ─────────────────────────────────────────────────
router.get('/quotations', requireHjtRead, async (req, res) => {
  const search = String(req.query.search || req.query.q || '').trim();
  const status = String(req.query.status || '').trim() || undefined;
  const limitRaw = req.query.limit;
  const limit =
    limitRaw === 'all' || limitRaw === '-1' ? -1 : Math.min(500, Math.max(1, Number(limitRaw) || 500));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const result = await listQuotations({
    userId: req.user.sub,
    role: req.user.role,
    search: search || undefined,
    status,
    limit,
    offset,
  });
  res.json(result);
});

router.post('/quotations', requireHjtQuotation, async (req, res) => {
  const q = await createQuotation(req.body, req.user.sub);
  res.status(201).json({ quotation: q });
});

router.get('/quotations/:id', requireHjtRead, async (req, res) => {
  const full = await getQuotationFull(req.params.id);
  if (!full) return res.status(404).json({ error: 'Not Found' });
  res.json(full);
});

router.patch('/quotations/:id', requireHjtQuotation, async (req, res) => {
  const q = await updateQuotation(req.params.id, req.body, req.user.sub);
  if (!q) return res.status(404).json({ error: 'Not Found' });
  res.json({ quotation: q });
});

router.post('/quotations/:id/lines', requireHjtQuotation, async (req, res) => {
  const out = await upsertQuotationLine(req.params.id, req.body, req.user.sub);
  if (out.error) return res.status(400).json({ error: 'Bad Request', message: out.error });
  res.json(out);
});

router.post('/quotations/:id/calculate', requireHjtQuotation, async (req, res) => {
  const mode = req.query.mode || req.body?.mode;
  const result = await runCalculateQuotation(req.params.id, mode);
  if (result.error) {
    const status = result.error === 'NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: 'Bad Request', message: result.error, details: result.details });
  }
  res.json(result);
});

router.post('/lastmile-kkf', requireHjtQuotation, async (req, res) => {
  try {
    const row = await createLastmileKkf(req.body);
    res.status(201).json({ lastmile: row });
  } catch (err) {
    console.error('[hjt:lastmile-kkf]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Gagal menghitung lastmile KKF',
    });
  }
});

router.delete('/quotations/:id/lines/:lineId', requireHjtQuotation, async (req, res) => {
  const out = await deleteQuotationLine(req.params.id, req.params.lineId);
  if (out.error) return res.status(400).json({ error: 'Bad Request', message: out.error });
  res.json(out);
});

router.post('/quotations/:id/other-expenses', requireHjtQuotation, async (req, res) => {
  const out = await upsertOtherExpense(req.params.id, req.body, req.user.sub);
  if (out.error) return res.status(400).json({ error: 'Bad Request', message: out.error });
  res.json(out);
});

router.delete('/quotations/:id/other-expenses/:expenseId', requireHjtQuotation, async (req, res) => {
  const out = await deleteOtherExpense(req.params.id, req.params.expenseId);
  if (out.error) return res.status(400).json({ error: 'Bad Request', message: out.error });
  res.json(out);
});

router.post('/quotations/:id/submit', requireHjtQuotation, async (req, res) => {
  const result = await submitQuotation(req.params.id, req.user.sub, req.body);
  if (result.error) {
    const status =
      result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 400;
    return res.status(status).json({ error: 'Bad Request', message: result.message || result.error, ...result });
  }
  res.json(result);
});

router.post('/quotations/:id/approve', requireHjtRead, async (req, res) => {
  const result = await approveQuotation(req.params.id, req.user.sub, req.user.role, req.body);
  if (result.error) {
    const status =
      result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 400;
    return res.status(status).json({ error: 'Bad Request', message: result.message || result.error });
  }
  res.json(result);
});

router.post('/quotations/:id/reject', requireHjtRead, async (req, res) => {
  const result = await rejectQuotation(req.params.id, req.user.sub, req.user.role, req.body);
  if (result.error) {
    const status =
      result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 400;
    return res.status(status).json({ error: 'Bad Request', message: result.message || result.error });
  }
  res.json(result);
});

router.get('/approvals/queue', requireHjtRead, async (req, res) => {
  const items = await getApprovalQueue({ role: req.user.role, userId: req.user.sub });
  res.json({ items });
});

router.get('/quotations/:id/approvals', requireHjtRead, async (req, res) => {
  const timeline = await getApprovalTimeline(req.params.id);
  res.json({ approvals: timeline });
});

router.get('/quotations/:id/export.pdf', requireHjtRead, async (req, res) => {
  const result = await exportQuotationPdf(req.params.id, res);
  if (result?.error === 'NOT_FOUND') {
    if (!res.headersSent) return res.status(404).json({ error: 'Not Found' });
  }
});

router.get('/quotations/:id/export.xlsx', requireHjtRead, async (req, res) => {
  const result = await exportQuotationXlsx(req.params.id, res);
  if (result?.error === 'NOT_FOUND') {
    if (!res.headersSent) return res.status(404).json({ error: 'Not Found' });
  }
});

router.post('/quotations/:id/create-project', requireHjtQuotation, async (req, res) => {
  const result = await createKkfProjectFromQuotation(req.params.id, req.user.sub, req.user.role);
  if (result.error) {
    const status =
      result.error === 'NOT_FOUND'
        ? 404
        : result.error === 'ALREADY_LINKED'
          ? 409
          : 400;
    return res.status(status).json({ error: 'Bad Request', message: result.message || result.error, ...result });
  }
  res.status(201).json(result);
});

// ── Admin: tariff versions ─────────────────────────────────────
router.post('/admin/tariff-versions', requireHjtTariffAdmin, async (req, res) => {
  const { kepdir_ref, effective_date } = req.body || {};
  if (!kepdir_ref || !effective_date) {
    return res.status(400).json({ error: 'Bad Request', message: 'kepdir_ref dan effective_date wajib' });
  }
  const version = await createTariffVersion({
    kepdirRef: kepdir_ref,
    effectiveDate: effective_date,
    createdBy: req.user.sub,
  });
  await logHjtAudit(query, {
    entity: 'hjt_tariff_version',
    entityId: version.id,
    action: 'CREATE',
    actorId: req.user.sub,
    payload: { kepdir_ref },
  });
  res.status(201).json({ version });
});

router.post('/admin/tariff-versions/:id/activate', requireHjtTariffAdmin, async (req, res) => {
  const version = await activateTariffVersion(req.params.id, req.user.sub);
  if (!version) return res.status(400).json({ error: 'Bad Request', message: 'Versi tidak ditemukan atau bukan draft' });
  await logHjtAudit(query, {
    entity: 'hjt_tariff_version',
    entityId: version.id,
    action: 'ACTIVATE',
    actorId: req.user.sub,
  });
  res.json({ version });
});

router.get('/admin/tariff', requireHjtTariffAdmin, async (req, res) => {
  const versionId = req.query.version || (await getActiveTariffVersion())?.id;
  if (!versionId) return res.status(404).json({ error: 'Not Found' });
  const rows = await searchTariffGrid({
    versionId,
    productId: req.query.product ? Number(req.query.product) : null,
    regionId: req.query.region ? Number(req.query.region) : null,
    q: req.query.q,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  res.json({ items: rows });
});

router.post('/admin/tariff', requireHjtTariffAdmin, async (req, res) => {
  const { version_id, product_id, region_id, backbone, uplink, vas, access, tarif } = req.body || {};
  const draft = await assertDraftVersion(version_id);
  if (!draft.ok) return res.status(400).json({ error: 'Bad Request', message: draft.error });
  const row = await upsertTariffRow({
    versionId: version_id,
    productId: product_id,
    regionId: region_id,
    backbone,
    uplink,
    vas,
    access,
    tarif,
  });
  await logHjtAudit(query, {
    entity: 'hjt_tariff',
    entityId: row.id,
    action: 'UPSERT',
    actorId: req.user.sub,
    payload: req.body,
  });
  res.status(201).json({ tariff: row });
});

router.patch('/admin/tariff/:id', requireHjtTariffAdmin, async (req, res) => {
  const { rows } = await query(`SELECT version_id, product_id, region_id FROM hjt_tariff WHERE id = $1`, [
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  const draft = await assertDraftVersion(rows[0].version_id);
  if (!draft.ok) return res.status(400).json({ error: 'Bad Request', message: draft.error });
  const row = await upsertTariffRow({
    versionId: rows[0].version_id,
    productId: rows[0].product_id,
    regionId: rows[0].region_id,
    backbone: req.body.backbone ?? 0,
    uplink: req.body.uplink ?? 0,
    vas: req.body.vas ?? 0,
    access: req.body.access ?? 0,
    tarif: req.body.tarif ?? 0,
  });
  res.json({ tariff: row });
});

router.delete('/admin/tariff/:id', requireHjtTariffAdmin, async (req, res) => {
  const { rows } = await query(`SELECT version_id FROM hjt_tariff WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  const ok = await deleteTariffRow(req.params.id, rows[0].version_id);
  if (!ok) return res.status(400).json({ error: 'Bad Request', message: 'Hanya versi draft' });
  res.json({ ok: true });
});

// ── Admin: IBBC & overhead (read/update draft) ─────────────────
router.get('/admin/ibbc', requireHjtTariffAdmin, async (req, res) => {
  const versionId = req.query.version || (await getActiveTariffVersion())?.id;
  const items = await lookupIbbc({ versionId, type: req.query.type, cir: req.query.cir, bw: req.query.bw });
  res.json({ items });
});

router.get('/admin/overhead', requireHjtTariffAdmin, async (req, res) => {
  const versionId = req.query.version || (await getActiveTariffVersion())?.id;
  const { rows } = await query(
    `SELECT * FROM hjt_overhead_param WHERE version_id = $1 ORDER BY fiscal_year DESC`,
    [versionId]
  );
  res.json({ items: rows });
});

// ── Admin: Excel import ────────────────────────────────────────
router.get('/admin/import/template', requireHjtTariffAdmin, async (_req, res) => {
  const buf = await buildImportTemplateBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="hjt-tariff-template.xlsx"');
  res.send(Buffer.from(buf));
});

router.post('/admin/import', requireHjtTariffAdmin, upload.single('file'), async (req, res) => {
  const versionId = req.body.version_id;
  if (!versionId || !req.file?.buffer) {
    return res.status(400).json({ error: 'Bad Request', message: 'version_id dan file wajib' });
  }
  const draft = await assertDraftVersion(versionId);
  if (!draft.ok) return res.status(400).json({ error: 'Bad Request', message: draft.error });

  const created = await createImportRecord(query, {
    versionId,
    filename: req.file.originalname,
    buffer: req.file.buffer,
    uploadedBy: req.user.sub,
  });
  if (created.error) return res.status(409).json({ error: 'Conflict', message: created.error });

  await parseUploadBuffer(query, { importId: created.importRecord.id, buffer: req.file.buffer });
  const summary = await parseAndValidateImport(query, created.importRecord.id);
  res.status(201).json({ import: created.importRecord, summary });
});

router.get('/admin/import/:id/preview', requireHjtTariffAdmin, async (req, res) => {
  const preview = await getImportPreview(query, req.params.id);
  if (!preview.import) return res.status(404).json({ error: 'Not Found' });
  res.json(preview);
});

router.post('/admin/import/:id/commit', requireHjtTariffAdmin, async (req, res) => {
  const result = await commitImport(query, req.params.id, req.user.sub);
  if (result.error) return res.status(400).json({ error: 'Bad Request', message: result.error });
  await logHjtAudit(query, {
    entity: 'hjt_tariff_import',
    entityId: req.params.id,
    action: 'COMMIT',
    actorId: req.user.sub,
    payload: result,
  });
  res.json(result);
});

export default router;
