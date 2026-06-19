import { ceiling100 } from './math.js';

/** Wilayah dasar dengan kolom uplink aktif (PRDHJT §4.2). */
export const UPLINK_BASE_REGION_CODES = new Set([
  'Sumatera',
  'Jawa - Bali',
  'Jabodetabek',
  'INTIM',
]);

/**
 * Lookup komponen HPP Mode A (§5.1).
 * @param {object} tariffRow - { backbone, uplink, vas }
 * @param {object} region - { region_code, is_route }
 */
export function lookupHppStandard(tariffRow, region) {
  const backbone = ceiling100(tariffRow?.backbone ?? 0);
  const hasUplink = UPLINK_BASE_REGION_CODES.has(region?.region_code);
  const uplink = hasUplink ? ceiling100(tariffRow?.uplink ?? 0) : 0;
  const vas = region?.is_route ? 0 : ceiling100(tariffRow?.vas ?? 0);
  return { backbone, uplink, vas };
}

/**
 * Lookup komponen Mode B — raw units before discount (§5.7).
 */
export function lookupHppRaw(tariffRow) {
  return {
    backbone: safeInt(tariffRow?.backbone ?? 0),
    uplink: safeInt(tariffRow?.uplink ?? 0),
    access: safeInt(tariffRow?.access ?? 0),
    tarif: safeInt(tariffRow?.tarif ?? 0),
  };
}

function safeInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}

export function existingFactor(aksesExisting) {
  return aksesExisting ? 0 : 1;
}
