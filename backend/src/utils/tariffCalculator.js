/** Server-side mirror of frontend tariff calculator (audit / future API). */

export const SLA_MULTIPLIERS = { standard: 1, premium: 1.15, platinum: 1.3 };

export const TARIFF_PACKAGES = [
  {
    id: 'dia',
    label: 'Dedicated Internet (DIA)',
    pricing: 'per_mbps',
    ratePerMbps: 850000,
    minMbps: 10,
    maxMbps: 10000,
    defaultOtc: 5000000,
  },
  {
    id: 'mpls',
    label: 'MPLS / SD-WAN',
    pricing: 'per_mbps',
    ratePerMbps: 1200000,
    minMbps: 5,
    maxMbps: 5000,
    defaultOtc: 10000000,
  },
  {
    id: 'ftth_biz',
    label: 'FTTH Business',
    pricing: 'flat',
    flatMonthly: 3500000,
    minMbps: 50,
    maxMbps: 1000,
    defaultOtc: 2500000,
  },
  {
    id: 'ip_transit',
    label: 'IP Transit',
    pricing: 'per_mbps',
    ratePerMbps: 650000,
    minMbps: 100,
    maxMbps: 40000,
    defaultOtc: 0,
  },
];

export function getTariffPackage(id) {
  return TARIFF_PACKAGES.find((p) => p.id === id);
}

export function computeTariffBreakdown(params) {
  const pkg = getTariffPackage(params?.packageId);
  if (!pkg) return { error: 'Paket tidak dikenali' };

  const mbps = Math.min(pkg.maxMbps, Math.max(pkg.minMbps, Number(params.bandwidthMbps) || pkg.minMbps));
  const list =
    pkg.pricing === 'flat'
      ? pkg.flatMonthly ?? 0
      : Math.round((pkg.ratePerMbps ?? 0) * mbps);
  const slaMult = SLA_MULTIPLIERS[params.sla] ?? 1;
  const afterSla = Math.round(list * slaMult);
  const disc = Math.max(0, Math.min(100, Number(params.discountPercent) || 0));
  const netY1 = Math.round(afterSla * (1 - disc / 100));
  const uplift = Math.max(0, Number(params.year2UpliftPercent) || 0);
  const netY2 =
    params.revenueMode === 'step_yearly' ? Math.round(netY1 * (1 + uplift / 100)) : null;
  const otc =
    params.otcOverride != null && params.otcOverride >= 0
      ? Number(params.otcOverride)
      : pkg.defaultOtc;

  return {
    pkg,
    mbps,
    breakdown: {
      listPriceMonthly: list,
      slaMultiplier: slaMult,
      afterSla,
      discountPercent: disc,
      netMonthlyYear1: netY1,
      netMonthlyYear2: netY2,
      otc,
    },
  };
}
