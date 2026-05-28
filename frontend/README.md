# NAVPRO Frontend (Next.js 14)

Aplikasi web **Kajian Kelayakan Finansial (KKF)** — enterprise UI untuk NAVPRO.

## Prasyarat

- Node.js LTS
- Backend API berjalan di `http://localhost:4000` (lihat `../docs/README.md`)

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) → login demo: `budi.santoso@navpro.app` / `Navpro@2026`

## Struktur utama

```
src/app/
  (auth)/login/          # Login JWT
  (dashboard)/
    dashboard/           # Portofolio KPI + heatmap
    projects/            # Daftar, wizard, detail, edit
    approvals/           # Approval queue
    admin/               # CMS (read-only tabs, Batch C+)
src/components/
  layout/AppShell.tsx
  projects/ProjectWizard.tsx
```

## Scripts

| Perintah | Keterangan |
|----------|------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |

## Dokumen terkait

- [PLAN_PENYEMPURNAAN.md](../docs/PLAN_PENYEMPURNAAN.md) — roadmap fase
- [TRACEABILITY.md](../docs/TRACEABILITY.md) — FR → halaman
