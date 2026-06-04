export interface OpexCatalogItem {
  code: string;
  name: string;
  category: string;
  icon_key: string;
  unit: string;
  default_type: "NOMINAL" | "PERCENT";
  default_amount: number;
  default_currency: "IDR" | "USD";
  description?: string | null;
}

/** Tampilan ikon katalog (tanpa dependensi tambahan). */
export const OPEX_ICON_DISPLAY: Record<string, string> = {
  monitor: "🖥️",
  users: "👥",
  wifi: "📡",
  globe: "🌐",
  wrench: "🔧",
  zap: "⚡",
  building: "🏢",
  server: "🗄️",
  shield: "🛡️",
  truck: "🚚",
  percent: "％",
  alert: "⚠️",
  satellite: "🛰️",
  box: "📦",
};

export function opexIconChar(iconKey: string): string {
  return OPEX_ICON_DISPLAY[iconKey] || OPEX_ICON_DISPLAY.box;
}

export function filterOpexCatalog(items: OpexCatalogItem[], query: string): OpexCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.code.toLowerCase().includes(q) ||
      it.name.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      (it.description || "").toLowerCase().includes(q)
  );
}

export function catalogToOpexDefaults(item: OpexCatalogItem) {
  return {
    catalogCode: item.code,
    name: item.name,
    category: item.category,
    iconKey: item.icon_key,
    unit: item.unit,
    type: item.default_type as "NOMINAL" | "PERCENT",
    amount: item.default_amount,
    currency: (item.default_currency || "IDR") as "IDR" | "USD",
  };
}

export function unitLabel(unit: string): string {
  if (unit === "percent_of_revenue") return "% dari revenue";
  if (unit === "per_month") return "per bulan";
  return unit;
}
