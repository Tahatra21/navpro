# NAVPRO — API Reference

| Field | Value |
|-------|-------|
| **Base URL (dev)** | `http://localhost:4000` |
| **Base URL (prod)** | `https://maharyuda.my.id` (via nginx reverse proxy) |
| **API prefix** | `/api/v1` |
| **Format** | JSON (`Content-Type: application/json`) |
| **Auth** | JWT Bearer token (`Authorization: Bearer <token>`) |
| **Versi dokumen** | 1.0 — 2026-06-10 |

---

## Daftar Isi

1. [Ringkasan](#1-ringkasan)
2. [Autentikasi & Keamanan](#2-autentikasi--keamanan)
3. [Health Check](#3-health-check)
4. [Auth — `/api/v1/auth`](#4-auth--apiv1auth)
5. [Projects — `/api/v1/projects`](#5-projects--apiv1projects)
6. [Dashboard — `/api/v1/dashboard`](#6-dashboard--apiv1dashboard)
7. [Approvals — `/api/v1/approvals`](#7-approvals--apiv1approvals)
8. [Notifications — `/api/v1/notifications`](#8-notifications--apiv1notifications)
9. [Config (read) — `/api/v1/config`](#9-config-read--apiv1config)
10. [Admin CMS — `/api/v1/admin`](#10-admin-cms--apiv1admin)
11. [Exchange Rate — `/api/v1/config` & `/api/v1/admin`](#11-exchange-rate--apiv1config--apiv1admin)
12. [Jobs (async) — `/api/v1/jobs`](#12-jobs-async--apiv1jobs)
13. [Kode Error Umum](#13-kode-error-umum)
14. [Role RBAC](#14-role-rbac)

---

## 1. Ringkasan

NAVPRO backend adalah REST API Express.js untuk aplikasi **Kajian Kelayakan Finansial (KKF)**.

**Total endpoint:** 78 route handlers (termasuk health).

| Modul | Prefix | Auth | Deskripsi |
|-------|--------|------|-----------|
| Health | `/health` | Tidak | Cek koneksi DB |
| Auth | `/api/v1/auth` | Mixed | Login, profil, password |
| Projects | `/api/v1/projects` | JWT | CRUD proyek, kalkulasi, workflow |
| Dashboard | `/api/v1/dashboard` | JWT | Portofolio & approval queue |
| Approvals | `/api/v1/approvals` | JWT | Queue v2, delegasi |
| Notifications | `/api/v1/notifications` | JWT | Notifikasi in-app |
| Config | `/api/v1/config` | JWT | Asumsi, preset, katalog (read) |
| Admin | `/api/v1/admin` | JWT + Admin role | CMS panel admin |
| Jobs | `/api/v1/jobs` | JWT + SA/Admin | Status job BullMQ |

---

## 2. Autentikasi & Keamanan

### Login → token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@navpro.app",
  "password": "<SEED_DEMO_PASSWORD>"
}
```

Response `200`:

```json
{
  "token": "<JWT>",
  "user": { "id": "...", "email": "...", "full_name": "...", "role": "SUPER_ADMIN", ... }
}
```

Gunakan token di semua request berikutnya:

```http
Authorization: Bearer <JWT>
```

### JWT payload

| Claim | Isi |
|-------|-----|
| `sub` | User UUID |
| `email` | Email user |
| `role` | Role RBAC |
| `name` | Nama lengkap |
| Expiry | 1 jam |

### Rate limiting

| Limiter | Batas | Scope |
|---------|-------|-------|
| Login | 5 gagal / 15 menit (prod); 100 (dev) | Per IP |
| API global | 200 req / menit | Per IP atau user |
| Export | 10 req / menit | Per user |

Env opsional: `LOGIN_RATE_LIMIT_MAX`, `E2E_BYPASS_SECRET` + header `X-Navpro-E2E`.

### Maintenance mode

Jika `maintenance_mode=true` di `system_config`, semua route (kecuali `/health` dan login) mengembalikan `503`.

---

## 3. Health Check

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| `GET` | `/health` | Tidak | Cek API + PostgreSQL |

**Response 200:** `{ "status": "ok" }`  
**Response 503:** `{ "status": "degraded" }` (DB down)

---

## 4. Auth — `/api/v1/auth`

| # | Method | Path | Auth | Deskripsi |
|---|--------|------|------|-----------|
| 1 | `POST` | `/login` | Tidak | Login email + password → JWT |
| 2 | `POST` | `/logout` | JWT | Logout (audit log) |
| 3 | `GET` | `/me` | JWT | Profil user saat ini |
| 4 | `PATCH` | `/me` | JWT | Update `full_name` |
| 5 | `PATCH` | `/password` | JWT | Ganti password |

### POST `/login`

| Body | Tipe | Wajib |
|------|------|-------|
| `email` | string | Ya |
| `password` | string | Ya |

| Status | Arti |
|--------|------|
| `200` | Sukses + token |
| `400` | Email/password kosong |
| `401` | Kredensial salah |
| `429` | Rate limit login |

### PATCH `/me`

| Body | Tipe | Wajib |
|------|------|-------|
| `full_name` | string (max 200) | Ya |

### PATCH `/password`

| Body | Tipe | Wajib |
|------|------|-------|
| `current_password` | string | Ya |
| `new_password` | string (min 12, policy) | Ya |

---

## 5. Projects — `/api/v1/projects`

Semua route memerlukan **JWT** + **RLS** (Row Level Security) jika `NAVPRO_RLS_ENABLED=true`.

| # | Method | Path | Role | Deskripsi |
|---|--------|------|------|-----------|
| 1 | `GET` | `/` | Semua | Daftar proyek (scoped) |
| 2 | `GET` | `/:id` | Scoped | Detail proyek + versi ringkas |
| 3 | `GET` | `/:id/versions` | Scoped | Daftar versi kalkulasi |
| 4 | `GET` | `/:id/versions/:ver` | Scoped | Snapshot versi tertentu |
| 5 | `GET` | `/:id/export.xlsx` | Scoped | Export Excel |
| 6 | `GET` | `/:id/export.pdf` | Scoped | Export PDF |
| 7 | `POST` | `/` | SA, FINANCE_ADMIN, SUPER_ADMIN | Buat proyek baru |
| 8 | `PUT` | `/:id` | SA, FINANCE_ADMIN, SUPER_ADMIN | Update proyek |
| 9 | `DELETE` | `/:id` | SA, FINANCE_ADMIN, SUPER_ADMIN | Hapus proyek |
| 10 | `POST` | `/:id/calculate` | SA, MANAGER, FINANCE_ADMIN, SUPER_ADMIN | Kalkulasi sinkron |
| 11 | `POST` | `/:id/calculate-async` | SA, MANAGER, FINANCE_ADMIN, SUPER_ADMIN | Kalkulasi async (Redis) |
| 12 | `POST` | `/:id/submit` | SA, FINANCE_ADMIN, SUPER_ADMIN | Submit approval |
| 13 | `POST` | `/:id/approve` | Role + status | Approve step |
| 14 | `POST` | `/:id/reject` | Role + status | Reject (wajib komentar) |
| 15 | `GET` | `/:id/audit-logs` | Scoped | Audit log proyek |
| 16 | `POST` | `/:id/duplicate` | SA, FINANCE_ADMIN, SUPER_ADMIN | Duplikasi proyek |
| 17 | `POST` | `/:id/archive` | SA, FINANCE_ADMIN, SUPER_ADMIN | Arsip proyek |

### GET `/` — Query parameters

| Param | Tipe | Deskripsi |
|-------|------|-----------|
| `status` | string | Filter status (`DRAFT`, `COMPUTED`, `SUBMITTED`, …) |
| `search` | string | Cari `project_name` / `project_code` (ILIKE) |
| `duration_category` | string | `SHORT_TERM`, `MID_TERM`, `LONG_TERM`, `EXTENDED` |
| `duration_months` | number | 1–120 |
| `page` | number | Default `1` |
| `limit` | number | Default `100` |

**Response:** `{ "projects": [ ... ] }`

### POST `/` — Body (ringkas)

| Field | Tipe | Wajib |
|-------|------|-------|
| `project_name` | string | Ya |
| `contract_start_date` | date (YYYY-MM-DD) | Ya |
| `project_duration_months` | number (1–120) | Ya |
| `org_unit_id` | UUID | Ya (kecuali admin global) |
| `capex` | array | Tidak |
| `opex` | array | Tidak |
| `revenue` | array | Tidak |
| `wacc_override` | number | Tidak |
| `inflation_rate_override` | number | Tidak |
| `bcr_threshold_override` | object | Tidak |
| `kurs_usd_override` | number | Tidak |

### POST `/:id/submit`

Mengubah status proyek `COMPUTED` → workflow review (v2: `IN_REVIEW_ASMAN`).

### POST `/:id/approve` / `/:id/reject`

| Body | Tipe | Wajib |
|------|------|-------|
| `comment` | string | Wajib untuk reject |

Role yang boleh approve/reject tergantung status proyek (ASMAN → MANAGER → GM_SRM).

### POST `/:id/calculate-async`

**Response 202:** `{ "job_id": "...", "status": "queued" }`  
Memerlukan `REDIS_URL` di environment.

---

## 6. Dashboard — `/api/v1/dashboard`

| # | Method | Path | Role | Deskripsi |
|---|--------|------|------|-----------|
| 1 | `GET` | `/portfolio` | Semua (scoped) | KPI portofolio, heatmap, chart data |
| 2 | `GET` | `/approval-queue` | MANAGER, GM_SRM, SUPER_ADMIN, FINANCE_ADMIN | Queue approval legacy |

### GET `/portfolio`

**Response (ringkas):**

```json
{
  "summary": { "total_projects", "active_projects", "pending_approvals", ... },
  "by_status": [ ... ],
  "by_risk": [ ... ],
  "org_financial": [ ... ],
  "projects": [ ... ]
}
```

### GET `/approval-queue`

Filter otomatis berdasarkan role:

| Role | Status yang ditampilkan |
|------|-------------------------|
| MANAGER | `SUBMITTED`, `UNDER_REVIEW` |
| GM_SRM | `APPROVED_L1` |
| SUPER_ADMIN, FINANCE_ADMIN | Semua pending di atas |

**Response:** `{ "items": [ { project, sla_due_at, sla_status, ... } ] }`

---

## 7. Approvals — `/api/v1/approvals`

Workflow approval v2 (tabel `approval_steps`).

| # | Method | Path | Role | Deskripsi |
|---|--------|------|------|-----------|
| 1 | `GET` | `/queue` | SUPER_ADMIN, FINANCE_ADMIN, ASMAN, MANAGER | Step pending user saat ini |
| 2 | `GET` | `/queue/summary` | ↑ | Ringkasan jumlah pending |
| 3 | `GET` | `/projects/:projectId/my-step` | ASMAN, MANAGER, Admin | Step pending untuk proyek |
| 4 | `GET` | `/steps/:stepId/delegate-candidates` | ASMAN, MANAGER, Admin | Kandidat delegasi |
| 5 | `POST` | `/steps/:stepId/delegate` | ASMAN, MANAGER, Admin | Delegasi step ke user lain |

### POST `/steps/:stepId/delegate`

| Body | Tipe | Wajib |
|------|------|-------|
| `to_user_id` | UUID | Ya |
| `reason` | string (min 10 char) | Ya |

---

## 8. Notifications — `/api/v1/notifications`

| # | Method | Path | Auth | Deskripsi |
|---|--------|------|------|-----------|
| 1 | `GET` | `/` | JWT | 50 notifikasi terakhir user |
| 2 | `PATCH` | `/:id/read` | JWT | Tandai satu notifikasi dibaca |
| 3 | `POST` | `/read-all` | JWT | Tandai semua dibaca |

### GET `/`

**Response:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "title": "...",
      "body": "...",
      "project_id": "uuid",
      "is_read": false,
      "created_at": "2026-06-10T..."
    }
  ]
}
```

---

## 9. Config (read) — `/api/v1/config`

Read-only config untuk wizard & UI. Semua memerlukan **JWT**.

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 1 | `GET` | `/assumptions` | Asumsi master (WACC, inflasi, BCR, …) |
| 2 | `GET` | `/presets` | Duration presets aktif |
| 3 | `GET` | `/opex-catalog` | Katalog layanan OPEX (Icon+) |
| 4 | `GET` | `/categories` | Kode kategori CAPEX & OPEX |
| 5 | `GET` | `/org-units` | Unit organisasi untuk wizard |
| 6 | `GET` | `/exchange-rate` | Kurs USD/EUR/SGD saat ini |
| 7 | `GET` | `/exchange-rate/history` | Historis kurs harian |

### GET `/opex-catalog`

| Query | Deskripsi |
|-------|-----------|
| `q` | Pencarian code/name/category (max 100 hasil) |

### GET `/org-units`

Scoped: user non-admin hanya melihat unit sendiri.

### GET `/exchange-rate/history`

| Query | Deskripsi |
|-------|-----------|
| `from` | Tanggal mulai (YYYY-MM-DD) |
| `to` | Tanggal akhir |
| `limit` | Max baris |
| `order` | `asc` / `desc` |
| `currency` | `USD`, `EUR`, `SGD` |

---

## 10. Admin CMS — `/api/v1/admin`

Semua route memerlukan **JWT** + role **`SUPER_ADMIN`** atau **`FINANCE_ADMIN`**.

### Organisasi

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 1 | `GET` | `/org-units` | Daftar semua unit org |
| 2 | `POST` | `/org-units` | Buat unit org |
| 3 | `PUT` | `/org-units/:id` | Update unit org |
| 4 | `DELETE` | `/org-units/:id` | Nonaktifkan unit org |
| 5 | `POST` | `/projects/backfill-org` | Backfill org_unit ke proyek lama |

### Asumsi Master

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 6 | `GET` | `/assumptions` | Baca asumsi + metadata |
| 7 | `PUT` | `/assumptions` | Update bulk asumsi |
| 8 | `PUT` | `/assumptions/:key` | Update satu key |
| 9 | `GET` | `/assumptions/history` | Riwayat perubahan |

### Duration Presets

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 10 | `GET` | `/duration-presets` | Daftar preset |
| 11 | `POST` | `/duration-presets` | Buat preset |
| 12 | `PUT` | `/duration-presets/:id` | Update preset |
| 13 | `DELETE` | `/duration-presets/:id` | Hapus/nonaktifkan preset |

### SLA Config

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 14 | `GET` | `/sla-config` | Konfigurasi SLA per role |
| 15 | `GET` | `/sla-config/preview-due` | Preview due date |
| 16 | `PUT` | `/sla-config/:role_key` | Update SLA role |
| 17 | `DELETE` | `/sla-config/:role_key` | Hapus SLA role |

**Query `/sla-config/preview-due`:** `role_key=ASMAN` (+ optional `from=ISO date`)

### Kategori & Katalog

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 18 | `GET` | `/capex-categories` | Daftar kategori CAPEX |
| 19 | `GET` | `/opex-categories` | Daftar kategori OPEX |
| 20 | `POST` | `/capex-categories` | Tambah kategori CAPEX |
| 21 | `POST` | `/opex-categories` | Tambah kategori OPEX |
| 22 | `GET` | `/opex-service-catalog` | Katalog layanan OPEX (admin) |
| 23 | `POST` | `/opex-service-catalog` | Tambah/update item katalog |

### System Config

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 24 | `GET` | `/system-config` | Semua config (grouped by category) |
| 25 | `PUT` | `/system-config/:key` | Update satu config key |

Kategori config: `FEATURE_FLAG`, `FORMULA`, `SECURITY`, `NOTIFICATION_TEMPLATE`, dll.

### Users

| # | Method | Path | Role | Deskripsi |
|---|--------|------|------|-----------|
| 26 | `GET` | `/users` | Admin | Daftar user (paginated) |
| 27 | `POST` | `/users` | Admin | Buat user |
| 28 | `PUT` | `/users/:id` | Admin | Update user |
| 29 | `POST` | `/users/:id/reset-password` | **SUPER_ADMIN** | Reset password user |

**GET `/users` — Query:**

| Param | Deskripsi |
|-------|-----------|
| `page` | Halaman (default 1) |
| `pageSize` / `limit` | Ukuran halaman (default 10, max 100) |
| `search` / `q` | Cari nama, email, unit |
| `role` | Filter role |
| `active` | `true` / `false` / `active` / `inactive` |

**Response:** `{ "users": [...], "total", "page", "pageSize" }`

### Audit & Health

| # | Method | Path | Role | Deskripsi |
|---|--------|------|------|-----------|
| 30 | `GET` | `/audit-logs` | Admin | Audit log sistem (paginated) |
| 31 | `GET` | `/system-health` | Admin | Status DB, KPI, FX, aktivitas |
| 32 | `POST` | `/system-health/maintenance` | **SUPER_ADMIN** | Toggle maintenance mode |

**GET `/audit-logs` — Query:**

| Param | Deskripsi |
|-------|-----------|
| `page`, `pageSize` | Pagination |
| `search` / `q` | Cari user, action, project |
| `action` | Filter action exact |

**Response:** `{ "logs", "total", "page", "pageSize", "actions": [...] }`

**POST `/system-health/maintenance` — Body:** `{ "enabled": true | false }`

---

## 11. Exchange Rate — `/api/v1/config` & `/api/v1/admin`

### Public (authenticated read) — prefix `/api/v1/config`

| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/exchange-rate` | Kurs aktif + pending + auto-sync status |
| `GET` | `/exchange-rate/history` | Historis kurs harian |

### Admin — prefix `/api/v1/admin`

Role: **SUPER_ADMIN**, **FINANCE_ADMIN**

| # | Method | Path | Deskripsi |
|---|--------|------|-----------|
| 1 | `POST` | `/exchange-rate/sync` | Sync manual dari provider |
| 2 | `POST` | `/exchange-rate/approve-pending` | Setujui kurs pending |
| 3 | `POST` | `/exchange-rate/reject-pending` | Tolak kurs pending |
| 4 | `POST` | `/exchange-rate/backfill` | Backfill historis BI JISDOR |
| 5 | `GET` | `/exchange-rate/sync-log` | Log sync terakhir |
| 6 | `PATCH` | `/exchange-rate/settings` | Toggle auto-sync |

### POST `/exchange-rate/sync`

| Body | Deskripsi |
|------|-----------|
| `force` | boolean — paksa sync meski auto-sync off |

### POST `/exchange-rate/backfill`

| Body | Deskripsi |
|------|-----------|
| `from` | YYYY-MM-DD |
| `to` | YYYY-MM-DD |

### PATCH `/exchange-rate/settings`

| Body | Deskripsi |
|------|-----------|
| `kurs_auto_sync_enabled` | boolean (wajib) |

---

## 12. Jobs (async) — `/api/v1/jobs`

Memerlukan **Redis** (`REDIS_URL`).

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| `GET` | `/:id` | SUPER_ADMIN, FINANCE_ADMIN, SA | Status job kalkulasi async |

**Response:**

```json
{
  "job_id": "...",
  "state": "completed | active | failed | waiting",
  "project_id": "uuid",
  "failed_reason": null
}
```

Job dibuat oleh `POST /api/v1/projects/:id/calculate-async`.

---

## 13. Kode Error Umum

| HTTP | Error | Penyebab umum |
|------|-------|---------------|
| `400` | Bad Request | Validasi input gagal |
| `401` | Unauthorized | Token missing/invalid/expired |
| `403` | Forbidden | Role tidak cukup / RLS / CORS |
| `404` | Not Found | Resource tidak ada atau di luar scope |
| `429` | Too Many Requests | Rate limit |
| `503` | Service Unavailable | Maintenance mode / DB down |

Format error:

```json
{
  "error": "Unauthorized",
  "message": "Token tidak valid atau kedaluwarsa"
}
```

---

## 14. Role RBAC

| Role | Akses API utama |
|------|-----------------|
| `SUPER_ADMIN` | Semua + maintenance mode + reset password |
| `FINANCE_ADMIN` | Admin CMS + approve kurs |
| `SA` / `STAFF` | Buat/edit proyek, submit, kalkulasi |
| `ASMAN` | Approval queue v2 (step ASMAN) |
| `MANAGER` | Approval queue v2 + legacy queue |
| `GM_SRM` | Approval final |
| `VIEWER` | Read-only (scoped RLS) |

### Data visibility (RLS)

| Role | Scope proyek |
|------|--------------|
| SUPER_ADMIN, FINANCE_ADMIN, VP_SA | Semua proyek |
| SA, STAFF | Proyek sendiri (`created_by`) |
| ASMAN | Proyek unit org sama |
| MANAGER, GM_SRM | Proyek segment sama |

---

## Lampiran — Quick Reference (semua endpoint)

```
GET    /health
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
PATCH  /api/v1/auth/me
PATCH  /api/v1/auth/password

GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET    /api/v1/projects/:id/versions
GET    /api/v1/projects/:id/versions/:ver
GET    /api/v1/projects/:id/export.xlsx
GET    /api/v1/projects/:id/export.pdf
POST   /api/v1/projects/:id/calculate
POST   /api/v1/projects/:id/calculate-async
POST   /api/v1/projects/:id/submit
POST   /api/v1/projects/:id/approve
POST   /api/v1/projects/:id/reject
GET    /api/v1/projects/:id/audit-logs
POST   /api/v1/projects/:id/duplicate
POST   /api/v1/projects/:id/archive

GET    /api/v1/dashboard/portfolio
GET    /api/v1/dashboard/approval-queue

GET    /api/v1/approvals/queue
GET    /api/v1/approvals/queue/summary
GET    /api/v1/approvals/projects/:projectId/my-step
GET    /api/v1/approvals/steps/:stepId/delegate-candidates
POST   /api/v1/approvals/steps/:stepId/delegate

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all

GET    /api/v1/config/assumptions
GET    /api/v1/config/presets
GET    /api/v1/config/opex-catalog
GET    /api/v1/config/categories
GET    /api/v1/config/org-units
GET    /api/v1/config/exchange-rate
GET    /api/v1/config/exchange-rate/history

GET    /api/v1/admin/org-units
POST   /api/v1/admin/org-units
PUT    /api/v1/admin/org-units/:id
DELETE /api/v1/admin/org-units/:id
POST   /api/v1/admin/projects/backfill-org
GET    /api/v1/admin/assumptions
PUT    /api/v1/admin/assumptions
PUT    /api/v1/admin/assumptions/:key
GET    /api/v1/admin/assumptions/history
GET    /api/v1/admin/duration-presets
POST   /api/v1/admin/duration-presets
PUT    /api/v1/admin/duration-presets/:id
DELETE /api/v1/admin/duration-presets/:id
GET    /api/v1/admin/sla-config
GET    /api/v1/admin/sla-config/preview-due
PUT    /api/v1/admin/sla-config/:role_key
DELETE /api/v1/admin/sla-config/:role_key
GET    /api/v1/admin/capex-categories
GET    /api/v1/admin/opex-categories
POST   /api/v1/admin/capex-categories
POST   /api/v1/admin/opex-categories
GET    /api/v1/admin/opex-service-catalog
POST   /api/v1/admin/opex-service-catalog
GET    /api/v1/admin/system-config
PUT    /api/v1/admin/system-config/:key
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PUT    /api/v1/admin/users/:id
POST   /api/v1/admin/users/:id/reset-password
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/system-health
POST   /api/v1/admin/system-health/maintenance
POST   /api/v1/admin/exchange-rate/sync
POST   /api/v1/admin/exchange-rate/approve-pending
POST   /api/v1/admin/exchange-rate/reject-pending
POST   /api/v1/admin/exchange-rate/backfill
GET    /api/v1/admin/exchange-rate/sync-log
PATCH  /api/v1/admin/exchange-rate/settings

GET    /api/v1/jobs/:id
```

---

*Sumber: `backend/src/routes/*.js`, `backend/src/index.js` — per commit `main` Juni 2026.*
