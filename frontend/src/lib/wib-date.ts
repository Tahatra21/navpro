/** WIB calendar helpers for frontend (mirrors backend Asia/Jakarta) */
export function wibDateOffsetDays(offsetDays: number, from = new Date()): string {
  const base = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
  const [y, m, day] = base.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, day + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utc));
}
