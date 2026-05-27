function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function asInt(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isInteger(Number(v))) return Number(v);
  return null;
}

function asNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function validateProjectPayload(body, { allowPartial = false } = {}) {
  const errors = [];

  const project_name = body?.project_name;
  const contract_start_date = body?.contract_start_date;

  if (!allowPartial) {
    if (!isNonEmptyString(project_name)) errors.push('project_name wajib diisi');
    if (!isNonEmptyString(contract_start_date)) errors.push('contract_start_date wajib diisi');
  } else {
    if (project_name != null && !isNonEmptyString(project_name)) errors.push('project_name wajib diisi');
    if (contract_start_date != null && !isNonEmptyString(contract_start_date))
      errors.push('contract_start_date wajib diisi');
  }

  const monthsRaw = body?.project_duration_months;
  const months = monthsRaw == null ? null : asInt(monthsRaw);
  if (monthsRaw != null) {
    if (months == null) errors.push('project_duration_months harus integer');
    else if (months < 1 || months > 120) errors.push('project_duration_months harus 1–120');
  }

  // Overrides (percent values in UI)
  for (const key of ['wacc_override', 'inflation_rate_override']) {
    if (body?.[key] != null && body?.[key] !== '') {
      const val = asNumber(body[key]);
      if (val == null) errors.push(`${key} harus angka`);
      else if (val < 0) errors.push(`${key} tidak boleh negatif`);
    }
  }
  if (body?.kurs_usd_override != null && body?.kurs_usd_override !== '') {
    const val = asNumber(body.kurs_usd_override);
    if (val == null) errors.push('kurs_usd_override harus angka');
    else if (val < 0) errors.push('kurs_usd_override tidak boleh negatif');
  }

  if (body?.bcr_threshold_override != null) {
    const mand = asNumber(body.bcr_threshold_override?.mandatory);
    const min = asNumber(body.bcr_threshold_override?.minimum);
    if (mand == null || mand < 0) errors.push('bcr_threshold_override.mandatory harus angka >= 0');
    if (min == null || min < 0) errors.push('bcr_threshold_override.minimum harus angka >= 0');
    if (mand != null && min != null && mand < min)
      errors.push('bcr_threshold_override.mandatory harus >= minimum');
  }

  const duration = months ?? asInt(body?.project_duration_months) ?? 12;

  // CAPEX
  if (body?.capex != null) {
    if (!Array.isArray(body.capex)) errors.push('capex harus array');
    else {
      body.capex.forEach((c, idx) => {
        if (!isNonEmptyString(c?.name)) errors.push(`capex[${idx}].name wajib diisi`);
        const amt = asNumber(c?.amount);
        if (amt == null) errors.push(`capex[${idx}].amount harus angka`);
        else if (amt < 0) errors.push(`capex[${idx}].amount tidak boleh negatif`);
        const period = asInt(c?.period);
        if (period == null) errors.push(`capex[${idx}].period harus integer`);
        else if (period < 0 || period > duration) errors.push(`capex[${idx}].period harus 0–${duration}`);
      });
    }
  }

  // OPEX
  if (body?.opex != null) {
    if (!Array.isArray(body.opex)) errors.push('opex harus array');
    else {
      body.opex.forEach((o, idx) => {
        if (!isNonEmptyString(o?.name)) errors.push(`opex[${idx}].name wajib diisi`);
        const base = asNumber(o?.baseline_amount);
        if (base == null) errors.push(`opex[${idx}].baseline_amount harus angka`);
        else if (base < 0) errors.push(`opex[${idx}].baseline_amount tidak boleh negatif`);
        const start = asInt(o?.start_period);
        const end = asInt(o?.end_period);
        if (start == null || start < 1 || start > duration)
          errors.push(`opex[${idx}].start_period harus 1–${duration}`);
        if (end == null || end < 1 || end > duration)
          errors.push(`opex[${idx}].end_period harus 1–${duration}`);
        if (start != null && end != null && end < start)
          errors.push(`opex[${idx}] end_period harus >= start_period`);
      });
    }
  }

  // Revenue
  if (body?.revenue != null) {
    if (!Array.isArray(body.revenue)) errors.push('revenue harus array');
    else {
      body.revenue.forEach((r, idx) => {
        if (!isNonEmptyString(r?.name)) errors.push(`revenue[${idx}].name wajib diisi`);
        const amt = asNumber(r?.monthly_amount);
        if (amt == null) errors.push(`revenue[${idx}].monthly_amount harus angka`);
        else if (amt < 0) errors.push(`revenue[${idx}].monthly_amount tidak boleh negatif`);
        const esc = asNumber(r?.escalation_rate);
        if (esc != null && esc < 0) errors.push(`revenue[${idx}].escalation_rate tidak boleh negatif`);
        const start = asInt(r?.start_period);
        const end = asInt(r?.end_period);
        if (start == null || start < 1 || start > duration)
          errors.push(`revenue[${idx}].start_period harus 1–${duration}`);
        if (end == null || end < 1 || end > duration)
          errors.push(`revenue[${idx}].end_period harus 1–${duration}`);
        if (start != null && end != null && end < start)
          errors.push(`revenue[${idx}] end_period harus >= start_period`);
      });
    }
  }

  // OTC
  if (body?.otc_amount != null && body?.otc_amount !== '') {
    const otc = asNumber(body.otc_amount);
    if (otc == null) errors.push('otc_amount harus angka');
    else if (otc < 0) errors.push('otc_amount tidak boleh negatif');
  }

  return { ok: errors.length === 0, errors };
}

