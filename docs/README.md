# NAVPRO — Kajian Kelayakan Finansial

NAVPRO adalah aplikasi web untuk **kajian kelayakan finansial** proyek/investasi: input CAPEX/OPEX/Revenue, hitung KPI (XIRR, XNPV, BCR, Payback), versioning hasil kalkulasi, export laporan, dan workflow approval berbasis role.

Dokumen ini menggambarkan **kondisi implementasi saat ini** (MVP) di repo ini.

---

## Fitur utama (MVP saat ini)

- **Wizard 6 langkah** pembuatan/edit proyek + validasi kuat (FE+BE)
- **Kalkulasi finansial** (cashflow bulanan + KPI)
- **Version history**: snapshot input+hasil per kalkulasi (`calculation_versions`) + UI Load Snapshot (online/API)
- **Export**:
  - PDF (print stylesheet rapi)
  - Excel `.xlsx` (SheetJS)
- **Workflow approval**: submit → manager → GM/SRM, reject dengan komentar wajib
- **Approval Queue**:
  - Dashboard queue ringkas
  - Halaman `Approvals` khusus (filter Due/Overdue, status, cari)
  - Approve/Reject langsung dari tabel
- **SLA reminder server-side** + escalation + notifikasi in-app (berdasarkan `sla_config`, dedup via `sla_events`)
- **Mode offline**: fallback `localStorage` jika API tidak tersedia

---

## Arsitektur (kondisi sekarang)

| Layer | Teknologi | Port |
|---|---|---|
| Frontend | Static HTML/CSS/JS (Chart.js, SheetJS) | 3000 |
| Backend API | Node.js + Express 4 + JWT | 4000 |
| Database | PostgreSQL | 5432 |
| Queue (opsional) | Redis + BullMQ | 6379 |

Catatan:
- BullMQ **sudah di-scaffold**, namun baru aktif jika environment variable `REDIS_URL` diset.
- Kalkulasi sinkron masih tersedia di `POST /api/v1/projects/:id/calculate`.

---

## ERD (Mermaid)

```mermaid
erDiagram
  users {
    UUID id PK
    VARCHAR email
    VARCHAR password_hash
    VARCHAR full_name
    VARCHAR role
    BOOLEAN is_active
    TIMESTAMPTZ last_login_at
    TIMESTAMPTZ created_at
  }

  projects {
    UUID id PK
    UUID created_by FK
    VARCHAR project_code
    VARCHAR project_name
    VARCHAR status
    INTEGER project_duration_months
    VARCHAR duration_category
    DATE contract_start_date
    NUMERIC wacc_override
    NUMERIC inflation_rate_override
    JSONB bcr_threshold_override
    JSONB detail
    TIMESTAMPTZ created_at
    TIMESTAMPTZ updated_at
  }

  calculation_versions {
    UUID id PK
    UUID project_id FK
    INTEGER version_number
    INTEGER duration_months
    JSONB input_snapshot
    JSONB result_snapshot
    UUID created_by FK
    VARCHAR created_by_name
    TIMESTAMPTZ created_at
  }

  audit_logs {
    UUID id PK
    UUID user_id FK
    VARCHAR user_name
    UUID project_id FK
    VARCHAR action
    TEXT old_val
    TEXT new_val
    TIMESTAMPTZ created_at
  }

  notifications {
    UUID id PK
    UUID user_id FK
    VARCHAR title
    TEXT body
    UUID project_id FK
    BOOLEAN is_read
    TIMESTAMPTZ created_at
  }

  sla_config {
    VARCHAR role_key PK
    VARCHAR role_name
    INTEGER sla_working_days
    INTEGER reminder_hours
    INTEGER escalation_hours
    VARCHAR escalate_to_role
  }

  sla_events {
    UUID id PK
    UUID project_id FK
    VARCHAR role_key
    VARCHAR event_type
    TIMESTAMPTZ due_at
    TIMESTAMPTZ created_at
  }

  assumptions_master {
    INTEGER id PK
    JSONB data
    TIMESTAMPTZ updated_at
    UUID updated_by FK
  }

  assumptions_history {
    INTEGER id PK
    JSONB data
    TIMESTAMPTZ updated_at
    VARCHAR updated_by_name
  }

  duration_presets {
    VARCHAR id PK
    VARCHAR preset_name
    INTEGER duration_months
    VARCHAR category
    NUMERIC bcr_mandatory
    NUMERIC bcr_minimum
    BOOLEAN is_active
  }

  categories {
    INTEGER id PK
    VARCHAR type
    VARCHAR code
  }

  system_config {
    VARCHAR config_key PK
    TEXT config_val
    VARCHAR category
    VARCHAR data_type
    TEXT description
  }

  users ||--o{ projects : created_by
  projects ||--o{ calculation_versions : has_versions
  users ||--o{ calculation_versions : created_by
  users ||--o{ audit_logs : writes
  projects ||--o{ audit_logs : has
  users ||--o{ notifications : receives
  projects ||--o{ notifications : relates_to
  projects ||--o{ sla_events : sla_dedup
  sla_config ||--o{ sla_events : by_role
```

---

## Instalasi & Menjalankan (kondisi sekarang)

### Prasyarat

- Node.js (disarankan versi LTS modern)
- PostgreSQL (local atau via Docker Compose)
- (Opsional) Redis jika ingin mengaktifkan BullMQ async jobs

### 1) Jalankan database PostgreSQL

Jika memakai Docker:

```bash
docker compose up -d postgres
```

Atau PostgreSQL lokal (Homebrew) — buat role & database jika belum ada:

```bash
# Ganti YOUR_DB_PASSWORD dengan secret lokal Anda
psql -d postgres -c "CREATE ROLE navpro WITH LOGIN PASSWORD 'YOUR_DB_PASSWORD' CREATEDB;"
psql -d postgres -c "CREATE DATABASE navpro_db OWNER navpro;"
```

Salin `backend/.env.example` → `backend/.env` dan set `DATABASE_URL` (serta `SEED_DEMO_PASSWORD`, `JWT_SECRET`). Lihat [SECURITY.md](./SECURITY.md).

Smoke test API (setelah `npm start`):

```bash
cd backend && npm run smoke
```

### 2) Setup & jalankan Backend API

```bash
cd backend
cp .env.example .env # jika belum ada
npm install
npm run seed          # seed awal (users, assumptions, sla_config, dll)
npm run seed:demo     # tambah demo project (optional)
npm start
```

Backend berjalan di `http://localhost:4000`, health check `GET /health`.

#### Mengaktifkan BullMQ async jobs (opsional)

Jalankan Redis, lalu set env:

```bash
export REDIS_URL="redis://localhost:6379"
cd backend
npm start
```

Endpoint kalkulasi async:
- `POST /api/v1/projects/:id/calculate-async` → enqueue job (HTTP 202)

### 3) Jalankan Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Buka `http://localhost:3000`.

---

## Akun development (setelah seed)

Kredensial **tidak** disimpan di repo. Set `SEED_DEMO_PASSWORD` di `backend/.env`, jalankan `npm run seed`, lalu login dengan email user yang dibuat seed dan password dari env Anda.

Detail: [SECURITY.md](./SECURITY.md)

---

## Endpoint penting (ringkas)

- `GET /health` — health check
- `POST /api/v1/auth/login` — login (JWT)
- `GET|POST|PUT|DELETE /api/v1/projects` — CRUD proyek
- `POST /api/v1/projects/:id/calculate` — kalkulasi sinkron + snapshot versi
- `POST /api/v1/projects/:id/calculate-async` — kalkulasi async (butuh `REDIS_URL`)
- `POST /api/v1/projects/:id/submit|approve|reject` — workflow approval (reject wajib comment)
- `GET /api/v1/dashboard/portfolio` — KPI dashboard
- `GET /api/v1/dashboard/approval-queue` — data approvals page (SLA start/due)
- `GET /api/v1/notifications` — notifikasi
- `GET /api/v1/admin/*` — CMS (asumsi, preset, SLA, user, audit)

---

## Dump database

Jika butuh dump SQL untuk backup/dev:
- file dump ada di folder `db/` (contoh: `db/navpro_db_YYYYMMDD_HHMMSS.sql`)

