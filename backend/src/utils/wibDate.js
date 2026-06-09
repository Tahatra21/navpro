/** Asia/Jakarta calendar date as YYYY-MM-DD */
export function toWibDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function wibDateOffsetDays(offsetDays, from = new Date()) {
  const base = toWibDate(from);
  const [y, m, day] = base.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, day + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utc));
}

/** Current hour in WIB (0–23) */
export function wibHour(d = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hour12: false,
    }).format(d)
  );
}
