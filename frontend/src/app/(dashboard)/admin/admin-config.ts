import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  BookOpenCheck,
  Building2,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  Settings,
  Shield,
  Tags,
  Timer,
  Users,
} from "lucide-react";

export const ADMIN_TAB_IDS = [
  "assumptions",
  "kurs",
  "presets",
  "sla",
  "categories",
  "templates",
  "org",
  "system",
  "users",
  "audit",
  "health",
  "hjt-tariff",
] as const;

export type AdminTabId = (typeof ADMIN_TAB_IDS)[number];

export type AdminTabDef = {
  id: AdminTabId;
  label: string;
  desc: string;
  hints?: string[];
  icon: LucideIcon;
};

export const ADMIN_TABS: AdminTabDef[] = [
  {
    id: "assumptions",
    label: "Asumsi Master",
    desc: "Parameter global yang dipakai engine KKF (WACC, inflasi, BCR).",
    hints: [
      "Perubahan berlaku untuk proyek baru atau setelah recalculate.",
      "Kurs valuta dikelola di tab Kurs & FX.",
    ],
    icon: BookOpenCheck,
  },
  {
    id: "kurs",
    label: "Kurs & FX",
    desc: "Kurs USD/EUR/SGD untuk konversi CAPEX, OPEX, dan revenue.",
    hints: [
      "Auto sync berjalan setiap hari ≥ 09:00 WIB jika diaktifkan.",
      "Perubahan >5% membutuhkan persetujuan Finance Admin.",
    ],
    icon: DollarSign,
  },
  {
    id: "presets",
    label: "Duration Presets",
    desc: "Preset durasi dan threshold BCR di wizard proyek.",
    hints: ["Preset aktif muncul sebagai pilihan di Langkah 1 wizard."],
    icon: Timer,
  },
  {
    id: "categories",
    label: "Kategori",
    desc: "Daftar kategori CAPEX dan OPEX untuk input wizard.",
    hints: ["Kode kategori harus unik dan konsisten dengan BRD."],
    icon: Tags,
  },
  {
    id: "sla",
    label: "SLA Config",
    desc: "Batas waktu approval per role dan aturan eskalasi.",
    hints: ["Reminder dan escalation dihitung dalam jam kerja."],
    icon: Shield,
  },
  {
    id: "templates",
    label: "Notif Templates",
    desc: "Template pesan notifikasi in-app dan email.",
    hints: ["Disimpan di system_config, kategori NOTIFICATION_TEMPLATE."],
    icon: Bell,
  },
  {
    id: "org",
    label: "Organisasi",
    desc: "Unit Pusat/SBU untuk segmentasi proyek dan RBAC.",
    hints: [
      "Assign unit ke user di tab Pengguna.",
      "Backfill proyek lama jika unit baru ditambahkan.",
    ],
    icon: Building2,
  },
  {
    id: "system",
    label: "System Config",
    desc: "Feature flag, formula engine, dan parameter teknis.",
    hints: ["Edit hati-hati — langsung memengaruhi perilaku aplikasi."],
    icon: Settings,
  },
  {
    id: "users",
    label: "Pengguna",
    desc: "Akun login, role, dan unit organisasi.",
    hints: [
      "Role menentukan menu dan akses data (RBAC).",
      "User nonaktif tidak bisa login.",
    ],
    icon: Users,
  },
  {
    id: "hjt-tariff",
    label: "HJT Tarif",
    desc: "Versi kepdir, grid tarif connectivity, import Excel, IBBC & overhead.",
    hints: [
      "Hanya versi draft yang bisa di-edit/import.",
      "Aktivasi versi meng-archive versi active sebelumnya.",
      "Lihat docs/HJT_ADMIN_KEPDIR.md untuk prosedur lengkap.",
    ],
    icon: FileSpreadsheet,
  },
  {
    id: "audit",
    label: "Audit Log",
    desc: "Jejak aktivitas: login, perubahan data, approval.",
    hints: ["Read-only. Gunakan filter untuk menemukan aksi spesifik."],
    icon: ClipboardList,
  },
  {
    id: "health",
    label: "System Health",
    desc: "Status backend, statistik, dan maintenance mode.",
    hints: ["Maintenance mode memblokir akses non-admin."],
    icon: Activity,
  },
];

export const ADMIN_TAB_MAP = Object.fromEntries(
  ADMIN_TABS.map((t) => [t.id, t])
) as Record<AdminTabId, AdminTabDef>;

export const ADMIN_TAB_GROUPS: { title: string; tabIds: AdminTabId[] }[] = [
  { title: "Finansial", tabIds: ["assumptions", "kurs", "presets"] },
  { title: "Operasional", tabIds: ["categories", "sla", "templates", "org", "hjt-tariff"] },
  { title: "Sistem", tabIds: ["system", "users", "audit", "health"] },
];

export function parseAdminTab(value: string | null | undefined): AdminTabId {
  if (value && ADMIN_TAB_IDS.includes(value as AdminTabId)) {
    return value as AdminTabId;
  }
  return "assumptions";
}
