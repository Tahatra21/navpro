import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { getQuotationFull } from './quotationService.js';
import { getApprovalTimeline } from './approvalService.js';
import { query } from '../../db.js';

function formatIdr(n) {
  return Math.round(Number(n) || 0).toLocaleString('id-ID');
}

export async function exportQuotationPdf(quotationId, res) {
  const full = await getQuotationFull(quotationId);
  if (!full) return { error: 'NOT_FOUND' };

  const { quotation, lines, expenses } = full;
  const approvals = await getApprovalTimeline(quotationId);
  let kepdir = '';
  if (quotation.tariff_version_id) {
    const { rows } = await query(`SELECT kepdir_ref FROM hjt_tariff_version WHERE id = $1`, [
      quotation.tariff_version_id,
    ]);
    kepdir = rows[0]?.kepdir_ref || '';
  }

  const filename = `HJT_${quotation.id.slice(0, 8)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);

  doc.fontSize(16).text('Penawaran HJT — Connectivity', { align: 'left' });
  doc.fontSize(10).fillColor('#555').text(`Referensi: ${kepdir}`);
  doc.text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown(0.8);
  doc.fillColor('#000');

  doc.fontSize(12).text('Header Penawaran', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(`Pelanggan: ${quotation.customer_name || '-'}`);
  doc.text(`NPWP: ${quotation.npwp || '-'}`);
  doc.text(`Kontrak: ${quotation.contract_no || '-'}`);
  doc.text(`Skema: ${quotation.scheme} · Durasi: ${quotation.duration_years} tahun`);
  doc.text(`Mode: ${quotation.calc_mode} · Status: ${quotation.status}`);

  doc.moveDown(0.8);
  doc.fontSize(12).text('Rincian Layanan', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9);
  for (const line of lines) {
    doc.text(
      `• ${line.product_name || '-'} | D=${line.capacity} ${line.unit} ×${line.qty} → Rp ${formatIdr(line.harga_dasar)}/bln`
    );
  }

  doc.moveDown(0.8);
  doc.fontSize(12).text('Ringkasan', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(`Total/bulan: Rp ${formatIdr(quotation.total_per_month)}`);
  doc.text(`Grand Total HJT: Rp ${formatIdr(quotation.grand_total_hjt)}`);
  doc.text(`Lain-lain: Rp ${formatIdr(quotation.other_expense_total)}`);
  doc.text(`Grand Total All: Rp ${formatIdr(quotation.grand_total_all)}`);
  doc.text(`Floor: Rp ${formatIdr(quotation.offer_floor)} · Rekomendasi: Rp ${formatIdr(quotation.offer_recommended)}`);
  if (quotation.harga_final) doc.text(`Harga Final: Rp ${formatIdr(quotation.harga_final)}`);

  if (expenses.length) {
    doc.moveDown(0.6);
    doc.fontSize(11).text('Pengeluaran Lain-lain');
    expenses.forEach((e) => doc.fontSize(9).text(`  ${e.item}: Rp ${formatIdr(e.total)}`));
  }

  doc.moveDown(0.8);
  doc.fontSize(12).text('Approval', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9);
  for (const a of approvals) {
    doc.text(`${a.role_level}: ${a.decision}${a.approver_name ? ` — ${a.approver_name}` : ''}`);
  }

  doc.moveDown(0.8);
  doc.fontSize(12).text('Persetujuan & Tanda Tangan', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#333');
  doc.text('Dokumen ini mengacu pada tarif connectivity sesuai Kepdir yang berlaku.');
  doc.text(`Referensi Kepdir: ${kepdir || '—'}`);
  if (quotation.floor_override_justification) {
    doc.moveDown(0.4);
    doc.text(`Catatan di bawah floor: ${quotation.floor_override_justification}`);
  }
  doc.moveDown(1.2);

  const approved = approvals.filter((a) => a.decision === 'approved');
  const signRoles = ['MANAGER', 'GM_SRM'];
  const signatories = signRoles.map((role) => approved.find((a) => a.role_level === role)).filter(Boolean);

  if (signatories.length) {
    doc.text('Disetujui oleh:');
    doc.moveDown(1.5);
    const left = signatories[0];
    const right = signatories[1];
    if (left && right) {
      doc.text('_________________________          _________________________');
      doc.text(
        `${left.approver_name || left.role_level}                    ${right.approver_name || right.role_level}`
      );
      const leftDate = left.decided_at ? new Date(left.decided_at).toLocaleDateString('id-ID') : '_______________';
      const rightDate = right.decided_at ? new Date(right.decided_at).toLocaleDateString('id-ID') : '_______________';
      doc.text(`Tanggal: ${leftDate}            Tanggal: ${rightDate}`);
    } else {
      for (const s of signatories) {
        doc.moveDown(0.8);
        doc.text('_________________________');
        doc.text(`${s.approver_name || s.role_level}`);
        doc.text(`Tanggal: ${s.decided_at ? new Date(s.decided_at).toLocaleDateString('id-ID') : '_______________'}`);
      }
    }
  } else {
    doc.text('Disetujui oleh:');
    doc.moveDown(2);
    doc.text('_________________________          _________________________');
    doc.text('Manager Pemasaran                    Senior Regional Manager');
    doc.text('Tanggal: _______________            Tanggal: _______________');
  }
  doc.fillColor('#000');

  doc.end();
  return { ok: true };
}

export async function exportQuotationXlsx(quotationId, res) {
  const full = await getQuotationFull(quotationId);
  if (!full) return { error: 'NOT_FOUND' };

  const { quotation, lines, expenses } = full;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Penawaran');
  ws.addRow(['Penawaran HJT']);
  ws.addRow(['Pelanggan', quotation.customer_name]);
  ws.addRow(['NPWP', quotation.npwp]);
  ws.addRow(['Skema', quotation.scheme]);
  ws.addRow(['Status', quotation.status]);
  ws.addRow([]);
  ws.addRow(['Produk', 'Kapasitas', 'Qty', 'Backbone', 'Uplink', 'Lastmile', 'Harga Dasar']);
  for (const l of lines) {
    ws.addRow([
      l.product_name,
      l.capacity,
      l.qty,
      l.backbone,
      l.uplink,
      l.lastmile,
      l.harga_dasar,
    ]);
  }
  ws.addRow([]);
  ws.addRow(['Total/bulan', quotation.total_per_month]);
  ws.addRow(['Grand Total', quotation.grand_total_all]);

  const ws2 = wb.addWorksheet('Lain-lain');
  ws2.addRow(['Item', 'Harsat', 'Jumlah', 'Total']);
  expenses.forEach((e) => ws2.addRow([e.item, e.harsat, e.jumlah, e.total]));

  const filename = `HJT_${quotation.id.slice(0, 8)}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  return { ok: true };
}
