import { lookupHppRaw, existingFactor } from './lookup.js';
import { clamp, roundup1000, safeInt } from './math.js';

function distributeTariff({ base, years, targetIrr, scheme, isMsrFlat }) {
  const n = Math.max(1, safeInt(years, 1));
  if (scheme === 'OTC' || isMsrFlat) return base;
  if (n === 1) return base;
  return Math.round((Math.pow(1 + targetIrr, n) * base) / n);
}

function distributeAccess({ base, years, targetIrr, existing }) {
  const n = Math.max(1, safeInt(years, 1));
  const factor = existingFactor(existing);
  if (n === 1) return Math.round(base * factor);
  return Math.round(((Math.pow(1 + targetIrr, n) * base) / n) * factor);
}

function isMsrFlatPackage(productFamily, durationYears, contractMonths) {
  if (productFamily !== 'MSR') return false;
  const months = contractMonths ?? safeInt(durationYears, 1) * 12;
  return [12, 24, 36].includes(months);
}

/**
 * Hitung satu baris Mode B (§5.7).
 */
export function calcLineRevenueSharing({
  capacity,
  qty,
  tariffRow,
  scheme,
  durationYears,
  contractMonths,
  productFamily,
  targetIrr,
  discBackbone = 0,
  discPort = 0,
  aksesExisting = false,
}) {
  const D = Number(capacity) || 0;
  const F = safeInt(qty, 1);
  const raw = lookupHppRaw(tariffRow);
  const db = clamp(Number(discBackbone) || 0, 0, 1);
  const dp = clamp(Number(discPort) || 0, 0, 0.6);
  const irr = Number(targetIrr) || 0;

  const backbone = Math.round(raw.backbone * (1 - db));
  const port = Math.round(raw.uplink * (1 - dp));
  const L = distributeAccess({
    base: raw.access,
    years: durationYears,
    targetIrr: irr,
    existing: aksesExisting,
  });
  const msrFlat = isMsrFlatPackage(productFamily, durationYears, contractMonths);
  const M = distributeTariff({
    base: raw.tarif,
    years: durationYears,
    targetIrr: irr,
    scheme,
    isMsrFlat: msrFlat,
  });

  let harga_dasar;
  if (scheme === 'OTC') {
    harga_dasar = M;
  } else {
    harga_dasar = Math.round((D * (backbone + port + M) + L) * F);
  }

  return {
    backbone,
    uplink: port,
    vas: 0,
    access: L,
    tarif: M,
    harga_dasar,
  };
}

/**
 * Agregasi Mode B (§5.7).
 */
export function calcQuotationRevenueSharing({
  lines,
  scheme,
  durationYears,
  otherExpenses = [],
  discountRate = 0,
  marginCustom = 0,
  shareIcon = 0.7,
  shareKawasan = 0.3,
  hargaFinalTotal = null,
}) {
  const total_per_month = lines.reduce((s, l) => s + safeInt(l.harga_dasar, 0), 0);
  const dur = Math.max(1, safeInt(durationYears, 1));
  const grand_total =
    scheme === 'Subscription' ? total_per_month * dur * 12 : total_per_month;
  const disc = Number(discountRate) || 0;
  const discount_amt = disc > 0 ? Math.round((disc * grand_total) / (1 + disc)) : 0;
  const other_expense_total = otherExpenses.reduce(
    (s, e) => s + safeInt(e.total ?? e.harsat * e.jumlah, 0),
    0
  );
  const grand_total_net = grand_total - discount_amt + other_expense_total;

  const harga_negosiasi = roundup1000(total_per_month * (1 + (Number(marginCustom) || 0)));
  const si = Number(shareIcon) || 0.7;
  const sk = Number(shareKawasan) || 0.3;
  const ratio = si > 0 ? sk / si : 0;

  const icon_normal = harga_negosiasi;
  const kawasan_normal = Math.round(ratio * icon_normal);
  const min_quot_normal = roundup1000(icon_normal + kawasan_normal);

  const icon_final = scheme === 'Subscription' ? Math.round(grand_total_net / (dur * 12)) : grand_total_net;
  const kawasan_final = Math.round(ratio * icon_final);
  const min_quot_final = roundup1000(icon_final + kawasan_final);

  const finalTotal = hargaFinalTotal ?? harga_negosiasi;
  const profit_hjt = finalTotal - grand_total_net;
  const margin_hjt = grand_total_net > 0 ? profit_hjt / grand_total_net : 0;

  return {
    lines,
    total_per_month,
    grand_total,
    discount_amt,
    other_expense_total,
    grand_total_net,
    harga_negosiasi,
    revenue_split: {
      share_icon: si,
      share_kawasan: sk,
      icon_normal,
      kawasan_normal,
      min_quot_normal,
      icon_final,
      kawasan_final,
      min_quot_final,
    },
    profit_hjt,
    margin_hjt,
  };
}

export function validateRevenueSharingHeader({ targetIrr, waccAnnual, discPort }) {
  const errors = [];
  const irr = Number(targetIrr);
  const wacc = Number(waccAnnual);
  if (Number.isFinite(irr) && Number.isFinite(wacc) && irr <= wacc) {
    errors.push('TARGET_IRR_MUST_EXCEED_WACC');
  }
  if (Number(discPort) > 0.6) errors.push('DISC_PORT_MAX_60');
  return errors;
}
