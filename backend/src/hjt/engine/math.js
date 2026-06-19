/** Excel-parity math helpers (PRDHJT §4.3, §5). */

export function ceiling100(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 100) * 100;
}

/** ROUNDUP(x, -3) — kelipatan 1.000 ke atas */
export function roundup1000(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 1000) * 1000;
}

export function safeInt(value, fallback = 0) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Parse angka locale ID: "97.000" → 97000 */
export function parseIdNumber(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n) : null;
}
