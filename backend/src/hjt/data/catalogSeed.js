/**
 * Katalog produk HJT — 125 produk (PRDHJT §4.1).
 * Tarif penuh 125×9 di-import via Excel Admin; seed hanya subset golden.
 */

const MBPS_TIERS = [
  '1–10 Mbps',
  '11–20 Mbps',
  '21–50 Mbps',
  '51–100 Mbps',
  '101–200 Mbps',
  '201–500 Mbps',
  '501–1000 Mbps',
];

const LARGE_TIERS = [...MBPS_TIERS, '1001–5000 Mbps', '5001–10000 Mbps'];

const SMALL_TIERS = MBPS_TIERS.slice(0, 5);

function tierProducts(family, tiers, unit = 'Mbps') {
  return tiers.map((tier) => ({
    product_name: `${family} (${tier})`,
    product_family: family,
    default_unit: unit,
  }));
}

const BASE_PRODUCTS = [
  ...tierProducts('Clear Channel (TDM)', LARGE_TIERS),
  ...tierProducts('IP VPN', MBPS_TIERS),
  ...tierProducts('Metronet', LARGE_TIERS),
  ...tierProducts('Inet Corp IX&IIX', LARGE_TIERS),
  ...tierProducts('Inet Corp IIX', MBPS_TIERS),
  ...tierProducts('Inet Corp IX', MBPS_TIERS),
  ...tierProducts('IP Transit IX&IIX', LARGE_TIERS),
  ...tierProducts('IP Transit IIX', MBPS_TIERS),
  ...tierProducts('IP Transit IX', SMALL_TIERS),
  ...tierProducts('Metro Ethernet', MBPS_TIERS),
  ...tierProducts('DWDM', ['STM-1', 'STM-4', 'STM-16', 'STM-64']),
  ...tierProducts('MPLS VPN', SMALL_TIERS),
  ...tierProducts('Dedicated Internet', MBPS_TIERS),
  ...tierProducts('Ethernet Private Line', SMALL_TIERS),
  { product_name: 'i-WIN Indoor', product_family: 'i-WIN', default_unit: 'Units' },
  { product_name: 'i-WIN Outdoor', product_family: 'i-WIN', default_unit: 'Units' },
  { product_name: 'VSAT Standard', product_family: 'VSAT', default_unit: 'Units' },
  { product_name: 'VSAT Premium', product_family: 'VSAT', default_unit: 'Units' },
  { product_name: 'Colocation Rack Full', product_family: 'Colocation', default_unit: 'Rack' },
  { product_name: 'Colocation Half Rack', product_family: 'Colocation', default_unit: 'Rack' },
  { product_name: 'Colocation U-space 10U', product_family: 'Colocation', default_unit: 'U' },
  { product_name: 'Colocation U-space 20U', product_family: 'Colocation', default_unit: 'U' },
  { product_name: 'MSR Bronze 12 bln', product_family: 'MSR', default_unit: 'Units' },
  { product_name: 'MSR Silver 24 bln', product_family: 'MSR', default_unit: 'Units' },
  { product_name: 'MSR Gold 36 bln', product_family: 'MSR', default_unit: 'Units' },
  { product_name: 'MSR Platinum 48 bln', product_family: 'MSR', default_unit: 'Units' },
  { product_name: 'APK I-See Basic', product_family: 'APK I-See', default_unit: 'Units' },
  { product_name: 'APK I-See Pro', product_family: 'APK I-See', default_unit: 'Units' },
  { product_name: 'Cloud 2core vCPU', product_family: 'Cloud', default_unit: 'Units' },
  { product_name: 'Cloud 4core vCPU', product_family: 'Cloud', default_unit: 'Units' },
  { product_name: 'Cloud 8core vCPU', product_family: 'Cloud', default_unit: 'Units' },
  { product_name: 'Managed Firewall', product_family: 'Managed Service', default_unit: 'Units' },
  { product_name: 'Managed Router', product_family: 'Managed Service', default_unit: 'Units' },
  { product_name: 'Managed Switch', product_family: 'Managed Service', default_unit: 'Units' },
  { product_name: 'Lain-lain Custom', product_family: 'Lain-lain', default_unit: 'Lot' },
];

/** Dedupe and pad to exactly 125 products. */
function buildProductCatalog() {
  const seen = new Set();
  const out = [];
  for (const p of BASE_PRODUCTS) {
    if (seen.has(p.product_name)) continue;
    seen.add(p.product_name);
    out.push(p);
  }
  let n = 1;
  while (out.length < 125) {
    const name = `Connectivity Add-on ${String(n).padStart(2, '0')}`;
    if (!seen.has(name)) {
      out.push({ product_name: name, product_family: 'Add-on', default_unit: 'Lot' });
      seen.add(name);
    }
    n += 1;
  }
  return out.slice(0, 125);
}

export const HJT_PRODUCTS = buildProductCatalog();

/** Golden + referensi PRDHJT §4.2 contoh. */
export const GOLDEN_TARIFF_ROWS = [
  {
    product_name: 'Clear Channel (TDM) (1–10 Mbps)',
    regions: {
      Sumatera: { backbone: 222200, uplink: 0, vas: 0 },
      INTIM: { backbone: 186700, uplink: 0, vas: 0 },
    },
  },
  {
    product_name: 'IP VPN (1–10 Mbps)',
    regions: {
      'Jawa - Bali': { backbone: 20200, uplink: 0, vas: 0 },
    },
  },
  {
    product_name: 'Inet Corp IX&IIX (1–10 Mbps)',
    regions: {
      INTIM: { backbone: 97000, uplink: 8800, vas: 0, access: 50000, tarif: 120000 },
      Jabodetabek: { backbone: 105000, uplink: 9200, vas: 0, access: 55000, tarif: 130000 },
    },
  },
  {
    product_name: 'Metronet (1–10 Mbps)',
    regions: {
      Sumatera: { backbone: 45000, uplink: 5000, vas: 0 },
      'Jawa - Bali': { backbone: 42000, uplink: 4800, vas: 0 },
    },
  },
  {
    product_name: 'Dedicated Internet (1–10 Mbps)',
    regions: {
      Jabodetabek: { backbone: 88000, uplink: 7500, vas: 0 },
    },
  },
  {
    product_name: 'Metro Ethernet (1–10 Mbps)',
    regions: {
      Jabodetabek: { backbone: 52000, uplink: 5800, vas: 0 },
      'Jawa - Bali': { backbone: 48000, uplink: 5400, vas: 0 },
    },
  },
  {
    product_name: 'Metro Ethernet (101–200 Mbps)',
    regions: {
      Jabodetabek: { backbone: 82000, uplink: 8800, vas: 0 },
      'Jawa - Bali': { backbone: 78000, uplink: 8400, vas: 0 },
    },
  },
];

/** 78 baris IBBC (Perdir 0005) — generated tier matrix. */
function buildIbbcSeed() {
  const types = ['On-Net FTTH', 'On-Net FTTH IP Publik', 'Off-Net FTTH', 'Wireless'];
  const cirValues = [4, 10, 20, 50, 100];
  const bwValues = [10, 20, 50, 100, 200, 500, 1000];
  const rows = [];
  for (const type of types) {
    for (const cir of cirValues) {
      for (const up_to_bw of bwValues) {
        if (up_to_bw < cir) continue;
        const base = 80000 + cir * 12000 + up_to_bw * 350;
        rows.push({
          cir_bw_type: `IBBC CIR${cir}-BW${up_to_bw} ${type}`,
          type,
          cir,
          up_to_bw,
          price_jawa_bali: Math.round(base),
          lastmile: type.includes('Off-Net') ? Math.round(base * 0.15) : 0,
        });
        if (rows.length >= 78) return rows;
      }
    }
  }
  return rows;
}

export const HJT_IBBC_SEED = buildIbbcSeed();

export const HJT_DISCOUNT_LEVELS = [
  { code: 'MB_NIAGA', label: 'MB Niaga', disc_rate: 0.05 },
  { code: 'GM_SBU', label: 'GM SBU', disc_rate: 0.12 },
  { code: 'DIRECTOR', label: 'Director', disc_rate: 0.18 },
];
