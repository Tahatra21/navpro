import { createHash } from 'crypto';
import ExcelJS from 'exceljs';
import { parseIdNumber } from '../engine/math.js';
import {
  resolveProductByName,
  resolveRegionByCode,
  upsertTariffRow,
  assertDraftVersion,
} from './tariffService.js';

export async function createImportRecord(query, { versionId, filename, buffer, uploadedBy }) {
  const source_hash = createHash('sha256').update(buffer).digest('hex');
  const dup = await query(
    `SELECT id FROM hjt_tariff_import WHERE version_id = $1 AND source_hash = $2 LIMIT 1`,
    [versionId, source_hash]
  );
  if (dup.rows[0]) {
    return { error: 'DUPLICATE_FILE' };
  }

  const { rows } = await query(
    `INSERT INTO hjt_tariff_import (version_id, source_filename, source_hash, status, uploaded_by)
     VALUES ($1,$2,$3,'validating',$4) RETURNING *`,
    [versionId, filename, source_hash, uploadedBy]
  );
  return { importRecord: rows[0] };
}

export async function parseAndValidateImport(query, importId) {
  const { rows: impRows } = await query(`SELECT * FROM hjt_tariff_import WHERE id = $1`, [importId]);
  const imp = impRows[0];
  if (!imp) return { error: 'IMPORT_NOT_FOUND' };

  // Rows already staged via parseUploadBuffer
  const { rows } = await query(
    `SELECT * FROM hjt_tariff_import_row WHERE import_id = $1 ORDER BY row_no`,
    [importId]
  );

  let valid = 0;
  let errors = 0;
  const seen = new Set();

  for (const row of rows) {
    const key = `${row.product_name}::${row.region_code}`;
    const details = [];
    let status = 'ok';

    if (seen.has(key)) {
      status = 'error';
      details.push({ code: 'DUPLICATE_ROW' });
    }
    seen.add(key);

    const product = row.product_name ? await resolveProductByName(row.product_name) : null;
    const region = row.region_code ? await resolveRegionByCode(row.region_code) : null;

    if (!product) {
      status = 'error';
      details.push({ code: 'PRODUCT_NOT_FOUND' });
    }
    if (!region) {
      status = 'error';
      details.push({ code: 'REGION_INVALID' });
    }

    const backbone = parseIdNumber(row.backbone);
    const uplink = parseIdNumber(row.uplink);
    const vas = parseIdNumber(row.vas);

    if (backbone == null || backbone < 0) {
      status = 'error';
      details.push({ code: 'NON_NUMERIC', field: 'backbone' });
    }
    if (uplink == null || uplink < 0) {
      status = 'error';
      details.push({ code: 'NON_NUMERIC', field: 'uplink' });
    }
    if (vas == null || vas < 0) {
      status = 'error';
      details.push({ code: 'NON_NUMERIC', field: 'vas' });
    }

    if (region?.is_route && uplink > 0 && status !== 'error') {
      status = 'warning';
      details.push({ code: 'UPLINK_ON_ROUTE' });
    }

    if (status === 'error') errors += 1;
    else valid += 1;

    await query(
      `UPDATE hjt_tariff_import_row SET
         resolved_product_id = $2,
         resolved_region_id = $3,
         row_status = $4,
         error_detail = $5
       WHERE id = $1`,
      [
        row.id,
        product?.id || null,
        region?.id || null,
        status,
        JSON.stringify(details),
      ]
    );
  }

  const finalStatus = errors > 0 ? 'validated' : 'validated';
  await query(
    `UPDATE hjt_tariff_import SET status = $2, total_rows = $3, valid_rows = $4, error_rows = $5
     WHERE id = $1`,
    [importId, finalStatus, rows.length, valid, errors]
  );

  return { importId, total: rows.length, valid, errors };
}

export async function parseUploadBuffer(query, { importId, buffer }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: 0 };

  const headerRow = sheet.getRow(1);
  const headers = {};
  headerRow.eachCell((cell, col) => {
    headers[String(cell.value || '').trim().toLowerCase()] = col;
  });

  const colProduct = headers.product_name || headers.produk;
  const colRegion = headers.region_code || headers.region;
  const colBb = headers.backbone;
  const colUp = headers.uplink;
  const colVas = headers.vas;

  if (!colProduct || !colRegion || !colBb) {
    throw new Error('INVALID_TEMPLATE');
  }

  let rowNo = 0;
  sheet.eachRow((row, idx) => {
    if (idx === 1) return;
    const product_name = String(row.getCell(colProduct).value || '').trim();
    const region_code = String(row.getCell(colRegion).value || '').trim();
    if (!product_name && !region_code) return;
    rowNo += 1;
  });

  // Re-iterate for insert
  let insertNo = 0;
  for (let idx = 2; idx <= sheet.rowCount; idx++) {
    const row = sheet.getRow(idx);
    const product_name = String(row.getCell(colProduct).value || '').trim();
    const region_code = String(row.getCell(colRegion).value || '').trim();
    if (!product_name && !region_code) continue;
    insertNo += 1;
    await query(
      `INSERT INTO hjt_tariff_import_row (import_id, row_no, product_name, region_code, backbone, uplink, vas)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        importId,
        insertNo,
        product_name,
        region_code,
        row.getCell(colBb).value,
        colUp ? row.getCell(colUp).value : 0,
        colVas ? row.getCell(colVas).value : 0,
      ]
    );
  }

  return { rows: insertNo };
}

export async function commitImport(query, importId, actorId) {
  const { rows: impRows } = await query(`SELECT * FROM hjt_tariff_import WHERE id = $1`, [importId]);
  const imp = impRows[0];
  if (!imp) return { error: 'IMPORT_NOT_FOUND' };
  const draft = await assertDraftVersion(imp.version_id);
  if (!draft.ok) return { error: draft.error };

  const { rows } = await query(
    `SELECT * FROM hjt_tariff_import_row
     WHERE import_id = $1 AND row_status IN ('ok','warning')`,
    [importId]
  );

  let committed = 0;
  for (const row of rows) {
    if (!row.resolved_product_id || !row.resolved_region_id) continue;
    await upsertTariffRow({
      versionId: imp.version_id,
      productId: row.resolved_product_id,
      regionId: row.resolved_region_id,
      backbone: parseIdNumber(row.backbone) ?? 0,
      uplink: parseIdNumber(row.uplink) ?? 0,
      vas: parseIdNumber(row.vas) ?? 0,
    });
    committed += 1;
  }

  await query(
    `UPDATE hjt_tariff_import SET status = 'committed', committed_at = NOW() WHERE id = $1`,
    [importId]
  );

  return { committed };
}

export async function buildImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('tariff');
  sheet.addRow(['product_name', 'region_code', 'backbone', 'uplink', 'vas']);
  sheet.addRow(['Inet Corp IX&IIX (1–10 Mbps)', 'INTIM', 97000, 8800, 0]);
  return workbook.xlsx.writeBuffer();
}

export async function getImportPreview(query, importId) {
  const { rows: imp } = await query(`SELECT * FROM hjt_tariff_import WHERE id = $1`, [importId]);
  const { rows } = await query(
    `SELECT row_no, product_name, region_code, backbone, uplink, vas, row_status, error_detail
     FROM hjt_tariff_import_row WHERE import_id = $1 ORDER BY row_no`,
    [importId]
  );
  return { import: imp[0], rows };
}
