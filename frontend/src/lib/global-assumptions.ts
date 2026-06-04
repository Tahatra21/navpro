/** Asumsi master dari Admin — dipakai untuk pre-fill wizard Langkah 2 (P1). */

export type GlobalAssumptions = {
  wacc_annual?: number;
  inflation_monthly?: number;
  inflation_annual?: number;
  bcr_mandatory?: number;
  bcr_minimum?: number;
  kurs_usd?: number;
  effective_date?: string;
  notes?: string;
};

const FALLBACK: Required<
  Pick<GlobalAssumptions, "wacc_annual" | "inflation_monthly" | "bcr_mandatory" | "bcr_minimum" | "kurs_usd">
> = {
  wacc_annual: 9.72,
  inflation_monthly: 0.2466,
  bcr_mandatory: 1.23,
  bcr_minimum: 1.08,
  kurs_usd: 16500,
};

export function resolveGlobalAssumptions(raw?: GlobalAssumptions | null) {
  const a = raw || {};
  let inflationMonthly = a.inflation_monthly;
  if (inflationMonthly == null && a.inflation_annual != null) {
    inflationMonthly = parseFloat(
      ((Math.pow(1 + a.inflation_annual / 100, 1 / 12) - 1) * 100).toFixed(6)
    );
  }
  return {
    wacc_annual: a.wacc_annual ?? FALLBACK.wacc_annual,
    inflation_monthly: inflationMonthly ?? FALLBACK.inflation_monthly,
    bcr_mandatory: a.bcr_mandatory ?? FALLBACK.bcr_mandatory,
    bcr_minimum: a.bcr_minimum ?? FALLBACK.bcr_minimum,
    kurs_usd: a.kurs_usd ?? FALLBACK.kurs_usd,
    effective_date: a.effective_date,
    notes: a.notes,
  };
}

/** String untuk field wizard (pre-fill tampilan). */
export function assumptionFieldsForWizard(raw?: GlobalAssumptions | null) {
  const r = resolveGlobalAssumptions(raw);
  return {
    waccOverride: String(r.wacc_annual),
    inflationOverride: String(r.inflation_monthly),
    kursUsdOverride: String(r.kurs_usd),
    bcrMandatory: String(r.bcr_mandatory),
    bcrMinimum: String(r.bcr_minimum),
    effectiveDate: r.effective_date,
  };
}

export function projectUsesCustomAssumptions(project: {
  wacc_override?: number | null;
  inflation_rate_override?: number | null;
  kurs_usd_override?: number | null;
  bcr_threshold_override?: { mandatory?: number; minimum?: number } | null;
}) {
  return (
    project.wacc_override != null ||
    project.inflation_rate_override != null ||
    project.kurs_usd_override != null ||
    project.bcr_threshold_override?.mandatory != null ||
    project.bcr_threshold_override?.minimum != null
  );
}
