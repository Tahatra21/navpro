import { v4 as uuidv4 } from 'uuid';
import { query, durationCategory, projectToDetail } from '../../db.js';
import { runCalculationOnProject } from '../../services/calculationEngine.js';
import {
  calcLineStandard,
  calcQuotationStandard,
  validateStandardLine,
  validateStandardQuotation,
} from '../engine/standard.js';
import {
  calcLineRevenueSharing,
  calcQuotationRevenueSharing,
  validateRevenueSharingHeader,
} from '../engine/revenueSharing.js';
import { calcLastmileKkf, mapLastmileKkfInput } from '../engine/lastmileSimpleIrr.js';
import {
  getActiveTariffVersion,
  lookupTariff,
  getBusinessParams,
  getOverheadParam,
  getDiscountLevel,
  resolveRegionByCode,
  resolveRegionById,
} from './tariffService.js';
import { logHjtAudit } from '../seedHjt.js';

async function getWaccFromAssumptions() {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  const wacc = rows[0]?.data?.wacc_annual;
  return wacc != null ? Number(wacc) / 100 : 0.1043;
}

async function resolveUserOrg(userId) {
  const { rows } = await query(
    `SELECT u.org_unit_id, ou.segment
     FROM users u
     LEFT JOIN organization_units ou ON ou.id = u.org_unit_id
     WHERE u.id = $1`,
    [userId]
  );
  return { orgUnitId: rows[0]?.org_unit_id || null, segment: rows[0]?.segment || null };
}

export async function getQuotationFull(id) {
  const { rows: qRows } = await query(`SELECT * FROM hjt_quotation WHERE id = $1`, [id]);
  if (!qRows[0]) return null;
  const quotation = qRows[0];
  const { rows: lines } = await query(
    `SELECT l.*, p.product_name, p.product_family, k.bcr AS lastmile_bcr, k.is_feasible AS lastmile_feasible
     FROM hjt_quotation_line l
     LEFT JOIN hjt_product p ON p.id = l.product_id
     LEFT JOIN hjt_lastmile_kkf k ON k.id = l.lastmile_kkf_id
     WHERE l.quotation_id = $1
     ORDER BY l.sort_order, l.id`,
    [id]
  );
  const { rows: expenses } = await query(
    `SELECT * FROM hjt_other_expense WHERE quotation_id = $1`,
    [id]
  );
  let region = null;
  if (quotation.region_id) {
    const { rows } = await query(`SELECT * FROM hjt_region WHERE id = $1`, [quotation.region_id]);
    region = rows[0];
  }
  return { quotation, lines, expenses, region };
}

export async function runCalculateQuotation(id, mode) {
  const full = await getQuotationFull(id);
  if (!full) return { error: 'NOT_FOUND' };

  const { quotation, lines, expenses, region } = full;
  const calcMode = mode || quotation.calc_mode || 'standard';

  const version =
    (quotation.tariff_version_id &&
      (await query(`SELECT * FROM hjt_tariff_version WHERE id = $1`, [quotation.tariff_version_id]))
        .rows[0]) ||
    (await getActiveTariffVersion());

  if (!version) return { error: 'NO_ACTIVE_TARIFF_VERSION' };

  const business = await getBusinessParams(version.id);
  const waccAnnual = await getWaccFromAssumptions();

  if (calcMode === 'revenue_sharing') {
    const headerErrors = validateRevenueSharingHeader({
      targetIrr: quotation.target_irr,
      waccAnnual,
      discPort: quotation.disc_port,
    });
    if (headerErrors.length) return { error: 'VALIDATION_FAILED', details: headerErrors };

    const discount = await getDiscountLevel(version.id, quotation.discount_level);
    const computedLines = [];

    for (const line of lines) {
      const lineRegion = line.region_code
        ? await resolveRegionByCode(line.region_code)
        : region;
      const tariffRow = await lookupTariff({
        versionId: version.id,
        productId: line.product_id,
        regionId: quotation.region_id || lineRegion?.id,
      });
      const computed = calcLineRevenueSharing({
        capacity: line.capacity,
        qty: line.qty,
        tariffRow,
        scheme: quotation.scheme,
        durationYears: quotation.duration_years,
        productFamily: line.product_family,
        targetIrr: Number(quotation.target_irr) || 0.2,
        discBackbone: quotation.disc_backbone,
        discPort: quotation.disc_port,
        aksesExisting: line.akses_existing,
      });
      computedLines.push({ ...line, ...computed });
      await query(
        `UPDATE hjt_quotation_line SET backbone=$2, uplink=$3, vas=$4, access=$5, tarif=$6, harga_dasar=$7
         WHERE id=$1`,
        [line.id, computed.backbone, computed.uplink, computed.vas, computed.access, computed.tarif, computed.harga_dasar]
      );
    }

    const result = calcQuotationRevenueSharing({
      lines: computedLines,
      scheme: quotation.scheme,
      durationYears: quotation.duration_years,
      otherExpenses: expenses,
      discountRate: Number(discount?.disc_rate) || 0,
      marginCustom: quotation.margin_custom,
      shareIcon: quotation.share_icon,
      shareKawasan: quotation.share_kawasan,
    });

    const floor = result.revenue_split.min_quot_final;
    const recommended = result.harga_negosiasi;
    const marginPct = result.margin_hjt != null ? result.margin_hjt * 100 : null;

    const snapshot = { mode: calcMode, result, tariff_version_id: version.id, wacc_annual: waccAnnual };
    await query(
      `UPDATE hjt_quotation SET
         tariff_version_id = $2,
         calc_mode = $3,
         total_per_month = $4,
         grand_total_hjt = $5,
         other_expense_total = $6,
         grand_total_all = $7,
         offer_floor = $8,
         offer_recommended = $9,
         margin_nominal = $10,
         margin_percent = $11,
         calc_snapshot = $12,
         updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        version.id,
        calcMode,
        result.total_per_month,
        result.grand_total,
        result.other_expense_total,
        result.grand_total_net,
        floor,
        recommended,
        result.profit_hjt,
        marginPct,
        JSON.stringify(snapshot),
      ]
    );

    return {
      ...result,
      tariff_version: version.kepdir_ref,
      mode: calcMode,
    };
  }

  // Mode A — standard
  const qErrors = validateStandardQuotation({ durationYears: quotation.duration_years });
  if (qErrors.length) return { error: 'VALIDATION_FAILED', details: qErrors };

  const computedLines = [];
  for (const line of lines) {
    const lineErrors = validateStandardLine({
      capacity: line.capacity,
      qty: line.qty,
      productId: line.product_id,
      regionId: quotation.region_id,
    });
    if (lineErrors.length) return { error: 'VALIDATION_FAILED', details: lineErrors, line_id: line.id };

    const tariffRow = await lookupTariff({
      versionId: version.id,
      productId: line.product_id,
      regionId: quotation.region_id,
    });
    const computed = calcLineStandard({
      capacity: line.capacity,
      qty: line.qty,
      lastmile: line.lastmile,
      tariffRow,
      region,
    });
    computedLines.push({ ...line, ...computed });
    await query(
      `UPDATE hjt_quotation_line SET backbone=$2, uplink=$3, vas=$4, lastmile=$5, harga_dasar=$6 WHERE id=$1`,
      [line.id, computed.backbone, computed.uplink, computed.vas, computed.lastmile, computed.harga_dasar]
    );
  }

  const result = calcQuotationStandard({
    lines: computedLines,
    scheme: quotation.scheme,
    durationYears: quotation.duration_years,
    otherExpenses: expenses,
    marginFloor: Number(business.margin_floor) || 0.1,
    marginRecommended: Number(business.margin_recommended) || 0.2,
  });

  const snapshot = { mode: calcMode, result, tariff_version_id: version.id };
  await query(
    `UPDATE hjt_quotation SET
       tariff_version_id = $2,
       calc_mode = $3,
       total_per_month = $4,
       grand_total_hjt = $5,
       other_expense_total = $6,
       grand_total_all = $7,
       offer_floor = $8,
       offer_recommended = $9,
       margin_nominal = $10,
       margin_percent = $11,
       calc_snapshot = $12,
       updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      version.id,
      calcMode,
      result.total_per_month,
      result.grand_total_hjt,
      result.other_expense_total,
      result.grand_total_all,
      result.offer.floor,
      result.offer.recommended,
      Math.max(0, result.offer.recommended - result.total_per_month),
      Number(business.margin_recommended) * 100,
      JSON.stringify(snapshot),
    ]
  );

  return {
    lines: computedLines.map((l) => ({
      product: l.product_name,
      backbone: l.backbone,
      uplink: l.uplink,
      vas: l.vas,
      lastmile: l.lastmile,
      harga_dasar: l.harga_dasar,
    })),
    total_per_month: result.total_per_month,
    grand_total_hjt: result.grand_total_hjt,
    other_expense_total: result.other_expense_total,
    grand_total_all: result.grand_total_all,
    offer: result.offer,
    margin: result.margin,
    tariff_version: version.kepdir_ref,
    mode: calcMode,
  };
}

export async function createLastmileKkf(body) {
  const overheadPct = body.overhead ?? (await getOverheadParam(body.version_id)) ?? 0.2435;
  const wacc = body.wacc_annual ?? (await getWaccFromAssumptions());
  const result = calcLastmileKkf({
    ...mapLastmileKkfInput(body),
    overhead: Number(overheadPct),
    waccAnnual: Number(wacc),
  });

  const { rows } = await query(
    `INSERT INTO hjt_lastmile_kkf
       (quotation_line_id, capex, depreciation_years, rev_share, overhead, koef_backbone, koef_port,
        wacc_annual, horizon_years, monthly_revenue, backbone_unit, uplink_unit, capacity,
        cashflows, irr, npv, bcr, is_feasible, recommended_lastmile)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      body.quotation_line_id || null,
      body.capex,
      body.depreciation_years ?? 8,
      body.rev_share ?? 0.2,
      overheadPct,
      body.koef_backbone ?? 0.3,
      body.koef_port ?? 1.0,
      wacc,
      body.horizon_years ?? 2,
      body.monthly_revenue ?? 0,
      body.backbone_unit ?? 0,
      body.uplink_unit ?? 0,
      body.capacity ?? 1,
      JSON.stringify(result.cashflows),
      result.irr,
      result.npv,
      result.bcr,
      result.is_feasible,
      result.recommended_lastmile,
    ]
  );
  if (body.quotation_line_id && rows[0]) {
    await query(
      `UPDATE hjt_quotation_line SET lastmile_kkf_id = $2, lastmile = $3 WHERE id = $1`,
      [body.quotation_line_id, rows[0].id, result.recommended_lastmile ?? 0]
    );
  }
  return {
    ...rows[0],
    irr: result.irr,
    npv: result.npv,
    bcr: result.bcr,
    is_feasible: result.is_feasible,
    recommended_lastmile: result.recommended_lastmile,
  };
}

export async function createQuotation(body, userId) {
  const version = await getActiveTariffVersion();
  const { orgUnitId, segment } = await resolveUserOrg(userId);
  const { rows } = await query(
    `INSERT INTO hjt_quotation
       (customer_name, npwp, contract_no, contract_year, region_id, scheme, calc_mode,
        duration_years, tariff_version_id, created_by, org_unit_id, segment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      body.customer_name,
      body.npwp,
      body.contract_no,
      body.contract_year ?? 1,
      body.region_id,
      body.scheme ?? 'Subscription',
      body.calc_mode ?? 'standard',
      body.duration_years ?? 1,
      version?.id || null,
      userId,
      orgUnitId,
      segment,
    ]
  );
  await logHjtAudit(query, {
    entity: 'hjt_quotation',
    entityId: rows[0].id,
    action: 'CREATE',
    actorId: userId,
    payload: { customer_name: body.customer_name },
  });
  return rows[0];
}

export async function updateQuotation(id, body, userId) {
  const fields = [];
  const params = [id];
  const allowed = [
    'customer_name', 'npwp', 'contract_no', 'contract_year', 'region_id', 'scheme',
    'calc_mode', 'duration_years', 'discount_level', 'sph_mitra', 'target_irr',
    'disc_backbone', 'disc_port', 'margin_custom', 'share_icon', 'share_kawasan',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      params.push(body[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  const { rows } = await query(
    `UPDATE hjt_quotation SET ${fields.join(', ')} WHERE id = $1 AND status = 'draft' RETURNING *`,
    params
  );
  if (rows[0]) {
    await logHjtAudit(query, {
      entity: 'hjt_quotation',
      entityId: id,
      action: 'UPDATE',
      actorId: userId,
      payload: body,
    });
  }
  return rows[0] || null;
}

export async function upsertQuotationLine(quotationId, line, userId) {
  const { rows: q } = await query(
    `SELECT status, region_id, calc_mode FROM hjt_quotation WHERE id = $1`,
    [quotationId]
  );
  if (!q[0] || q[0].status !== 'draft') return { error: 'QUOTATION_LOCKED' };

  if (line.id) {
    const { rows } = await query(
      `UPDATE hjt_quotation_line SET
         product_id = COALESCE($2, product_id),
         capacity = COALESCE($3, capacity),
         unit = COALESCE($4, unit),
         qty = COALESCE($5, qty),
         lastmile = COALESCE($6, lastmile),
         akses_existing = COALESCE($7, akses_existing),
         sort_order = COALESCE($8, sort_order),
         backbone = COALESCE($9, backbone),
         uplink = COALESCE($10, uplink),
         vas = COALESCE($11, vas),
         access = COALESCE($12, access),
         tarif = COALESCE($13, tarif),
         harga_dasar = COALESCE($14, harga_dasar)
       WHERE id = $1 AND quotation_id = $15
       RETURNING *`,
      [
        line.id,
        line.product_id,
        line.capacity,
        line.unit,
        line.qty,
        line.lastmile,
        line.akses_existing,
        line.sort_order,
        line.backbone,
        line.uplink,
        line.vas,
        line.access,
        line.tarif,
        line.harga_dasar,
        quotationId,
      ]
    );
    let updated = rows[0];
    if (
      updated &&
      q[0].calc_mode === 'standard' &&
      q[0].region_id &&
      (line.backbone != null ||
        line.uplink != null ||
        line.vas != null ||
        line.lastmile != null ||
        line.capacity != null ||
        line.qty != null)
    ) {
      const region = await resolveRegionById(q[0].region_id);
      const preview = calcLineStandard({
        capacity: updated.capacity,
        qty: updated.qty,
        lastmile: updated.lastmile,
        tariffRow: updated,
        region,
      });
      const { rows: previewRows } = await query(
        `UPDATE hjt_quotation_line SET harga_dasar = $2 WHERE id = $1 RETURNING *`,
        [updated.id, preview.harga_dasar]
      );
      updated = previewRows[0] || updated;
    }
    return { line: updated };
  }

  const { rows } = await query(
    `INSERT INTO hjt_quotation_line
       (quotation_id, product_id, capacity, unit, qty, lastmile, akses_existing, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      quotationId,
      line.product_id,
      line.capacity ?? 1,
      line.unit ?? 'Mbps',
      line.qty ?? 1,
      line.lastmile ?? 0,
      line.akses_existing ?? false,
      line.sort_order ?? 0,
    ]
  );
  await logHjtAudit(query, {
    entity: 'hjt_quotation_line',
    entityId: rows[0].id,
    action: 'UPSERT_LINE',
    actorId: userId,
    payload: { quotation_id: quotationId },
  });
  let inserted = rows[0];
  if (inserted?.product_id && q[0].region_id && q[0].calc_mode === 'standard') {
    const version = await getActiveTariffVersion();
    if (version) {
      const tariffRow = await lookupTariff({
        versionId: version.id,
        productId: inserted.product_id,
        regionId: q[0].region_id,
      });
      if (tariffRow.found) {
        const region = await resolveRegionById(q[0].region_id);
        const preview = calcLineStandard({
          capacity: inserted.capacity,
          qty: inserted.qty,
          lastmile: inserted.lastmile,
          tariffRow,
          region,
        });
        const { rows: filled } = await query(
          `UPDATE hjt_quotation_line SET backbone=$2, uplink=$3, vas=$4, harga_dasar=$5 WHERE id=$1 RETURNING *`,
          [inserted.id, preview.backbone, preview.uplink, preview.vas, preview.harga_dasar]
        );
        inserted = filled[0] || inserted;
      }
    }
  }
  return { line: inserted };
}

export async function upsertOtherExpense(quotationId, expense, userId) {
  const { rows: q } = await query(`SELECT status FROM hjt_quotation WHERE id = $1`, [quotationId]);
  if (!q[0] || q[0].status !== 'draft') return { error: 'QUOTATION_LOCKED' };

  if (expense.id) {
    const { rows } = await query(
      `UPDATE hjt_other_expense SET item=$2, harsat=$3, jumlah=$4, total=$5
       WHERE id=$1 AND quotation_id=$6 RETURNING *`,
      [expense.id, expense.item, expense.harsat, expense.jumlah, expense.total, quotationId]
    );
    return { expense: rows[0] };
  }

  const total = expense.total ?? Number(expense.harsat || 0) * Number(expense.jumlah || 1);
  const { rows } = await query(
    `INSERT INTO hjt_other_expense (quotation_id, item, harsat, jumlah, total)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [quotationId, expense.item, expense.harsat, expense.jumlah, total]
  );
  await logHjtAudit(query, {
    entity: 'hjt_other_expense',
    entityId: rows[0].id,
    action: 'UPSERT',
    actorId: userId,
    payload: { quotation_id: quotationId },
  });
  return { expense: rows[0] };
}

export async function deleteQuotationLine(quotationId, lineId) {
  const { rows: q } = await query(`SELECT status FROM hjt_quotation WHERE id = $1`, [quotationId]);
  if (!q[0] || q[0].status !== 'draft') return { error: 'QUOTATION_LOCKED' };
  await query(`DELETE FROM hjt_quotation_line WHERE id = $1 AND quotation_id = $2`, [lineId, quotationId]);
  return { ok: true };
}

export async function deleteOtherExpense(quotationId, expenseId) {
  const { rows: q } = await query(`SELECT status FROM hjt_quotation WHERE id = $1`, [quotationId]);
  if (!q[0] || q[0].status !== 'draft') return { error: 'QUOTATION_LOCKED' };
  await query(`DELETE FROM hjt_other_expense WHERE id = $1 AND quotation_id = $2`, [expenseId, quotationId]);
  return { ok: true };
}

export async function listQuotations({ userId, role, search, status, limit, offset = 0 }) {
  const params = [];
  const whereParts = [];
  const join = ' LEFT JOIN hjt_region r ON r.id = q.region_id';

  if (!['SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'GM_SRM', 'ASMAN', 'VP_SA'].includes(role)) {
    params.push(userId);
    whereParts.push(`q.created_by = $${params.length}`);
  }

  const needle = String(search || '').trim();
  if (needle) {
    params.push(`%${needle}%`);
    const idx = params.length;
    whereParts.push(
      `(q.customer_name ILIKE $${idx} OR q.contract_no ILIKE $${idx} OR r.region_code ILIKE $${idx})`
    );
  }

  if (status) {
    params.push(status);
    whereParts.push(`q.status = $${params.length}`);
  }

  const where = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM hjt_quotation q${join}${where}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const listParams = [...params];
  let sql = `SELECT q.*, r.region_code FROM hjt_quotation q${join}${where} ORDER BY q.updated_at DESC`;

  const effectiveLimit =
    limit == null || limit === -1 ? null : Math.min(500, Math.max(1, Number(limit) || 500));

  if (effectiveLimit != null) {
    listParams.push(effectiveLimit, Math.max(0, Number(offset) || 0));
    sql += ` LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;
  } else {
    listParams.push(500);
    sql += ` LIMIT $${listParams.length}`;
  }

  const { rows } = await query(sql, listParams);
  return {
    quotations: rows,
    total,
    limit: effectiveLimit ?? rows.length,
    offset: effectiveLimit != null ? Math.max(0, Number(offset) || 0) : 0,
  };
}

export async function createKkfProjectFromQuotation(quotationId, userId, userRole) {
  const full = await getQuotationFull(quotationId);
  if (!full) return { error: 'NOT_FOUND' };
  const { quotation, lines } = full;
  if (quotation.status !== 'approved') {
    return { error: 'INVALID_STATUS', message: 'Hanya penawaran approved yang bisa dijadikan proyek KKF' };
  }
  if (quotation.linked_project_id) {
    return { error: 'ALREADY_LINKED', project_id: quotation.linked_project_id };
  }
  if (!lines.length) {
    return { error: 'NO_LINES', message: 'Penawaran tidak memiliki baris layanan' };
  }

  const { orgUnitId, segment } = quotation.org_unit_id
    ? { orgUnitId: quotation.org_unit_id, segment: quotation.segment }
    : await resolveUserOrg(userId);
  if (!orgUnitId) {
    return { error: 'ORG_REQUIRED', message: 'User atau penawaran harus punya unit organisasi' };
  }

  const months = Math.max(12, (quotation.duration_years || 1) * 12);
  const year = new Date().getFullYear();
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS c FROM projects WHERE project_code LIKE $1`,
    [`NAVPRO-${year}-%`]
  );
  const seq = (countRows[0]?.c || 0) + 1;
  const project_code = `NAVPRO-${year}-${String(seq).padStart(4, '0')}`;

  const revenue = lines.map((line, idx) => ({
    name: line.product_name || `Connectivity ${idx + 1}`,
    monthly_amount: Number(line.harga_dasar) || 0,
    harsat: Number(line.harga_dasar) || 0,
    qty: 1,
    currency: 'IDR',
    revenue_mode: 'flat',
    start_period: 1,
    end_period: months,
    escalation_rate: 0,
  }));

  const { rows: assumptionRows } = await query(
    `SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`
  );
  const assumptions = assumptionRows[0]?.data || {};

  let proj = {
    project_code,
    project_name: `KKF — ${quotation.customer_name || 'Connectivity'}`,
    customer_name: quotation.customer_name,
    contract_number: quotation.contract_no,
    status: 'DRAFT',
    project_duration_months: months,
    duration_category: durationCategory(months),
    contract_start_date: new Date().toISOString().slice(0, 10),
    capex: [],
    opex: [],
    revenue,
    approval_chain: [],
    versions: [],
    hjt_quotation_id: quotationId,
    notes: `Pre-filled dari penawaran HJT ${quotationId}`,
  };

  proj = runCalculationOnProject(proj, assumptions);
  const detail = projectToDetail(proj);
  detail.hjt_quotation_id = quotationId;
  let kepdirRef = '';
  if (quotation.tariff_version_id) {
    const { rows: tvRows } = await query(
      `SELECT kepdir_ref FROM hjt_tariff_version WHERE id = $1`,
      [quotation.tariff_version_id]
    );
    kepdirRef = tvRows[0]?.kepdir_ref || '';
  }
  detail.hjt_kepdir_ref = kepdirRef;

  const projectId = uuidv4();
  await query(
    `INSERT INTO projects (
      id, created_by, org_unit_id, segment, project_code, project_name, status,
      project_duration_months, duration_category, contract_start_date, detail
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      projectId,
      userId,
      orgUnitId,
      segment,
      project_code,
      proj.project_name,
      'DRAFT',
      months,
      proj.duration_category,
      proj.contract_start_date,
      JSON.stringify(detail),
    ]
  );

  await query(
    `UPDATE hjt_quotation SET linked_project_id = $2, updated_at = NOW() WHERE id = $1`,
    [quotationId, projectId]
  );

  await logHjtAudit(query, {
    entity: 'hjt_quotation',
    entityId: quotationId,
    action: 'CREATE_KKF_PROJECT',
    actorId: userId,
    payload: { project_id: projectId, project_code },
  });

  return { ok: true, project_id: projectId, project_code };
}
