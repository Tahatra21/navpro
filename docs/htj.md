# PRD — KKF: Kajian Kelayakan Finansial Web Application
### NAVPRO — Kajian Kelayakan Finansial
> **Versi:** 1.2 | **Status:** Draft Final | **Tanggal:** 2026-05-27 | **Klasifikasi:** CONFIDENTIAL

---

## Daftar Isi

1. [Overview](#1-overview)
2. [Perbandingan dengan AWS Calculator](#2-perbandingan-dengan-aws-calculator)
3. [Requirements](#3-requirements)
4. [Core Features](#4-core-features)
5. [User Flow](#5-user-flow)
6. [ERD Diagram](#6-erd-diagram)
7. [Architecture](#7-architecture)
8. [Database Schema](#8-database-schema)
9. [Tech Stack](#9-tech-stack)
10. [Technology Flow & Arsitektur Sistem](#10-technology-flow--arsitektur-sistem)

---

## 1. Overview

### 1.1 Latar Belakang

**KKF (Kajian Kelayakan Finansial)** adalah proses analisis kelayakan investasi yang wajib dilakukan sebelum menyetujui setiap proyek investasi. Saat ini proses ini dijalankan menggunakan file Microsoft Excel yang tersebar, tidak terstandarisasi, dan sulit diaudit.

### 1.2 Permasalahan Utama

| No | Masalah | Dampak |
|----|---------|--------|
| 1 | File Excel tersebar, tidak terpusat | Versi tidak terkontrol, risiko data loss |
| 2 | Tidak ada standardisasi formula | Hasil kalkulasi berbeda antar tim |
| 3 | Proses approval manual via email | Tidak ada audit trail, SLA tidak terukur |
| 4 | Tidak ada visibilitas real-time | Manajemen tidak bisa pantau pipeline proyek |
| 5 | Durasi proyek hard-coded 12 bulan | Tidak fleksibel untuk proyek multi-tahun |
| 6 | BCR threshold tidak terkelola | Risiko inkonsistensi dengan kebijakan DirKeu |

### 1.3 Solusi

Platform web enterprise untuk menggantikan proses KKF berbasis Excel menjadi sistem digital terintegrasi dengan:

- **Kalkulasi otomatis**: XIRR, XNPV, BCR/PI, Payback Period
- **Workflow approval digital**: Manager (SLA 2 hari) → GM/SRM (SLA 1 hari)
- **Durasi fleksibel**: 1–120 bulan (Short Term s/d Extended)
- **Dashboard eksekutif**: Single pane of glass untuk seluruh pipeline proyek
- **Audit trail lengkap**: Setiap aksi tercatat dengan user, timestamp, dan delta nilai

### 1.4 Batasan Sistem

| Parameter | Nilai |
|-----------|-------|
| Durasi proyek | 1 – 120 bulan |
| WACC default | 9,72% p.a. (VP Keuangan April 2026) |
| BCR Mandatory | ≥ 1,23 (Memo DirKeu 16 Sep 2025) |
| BCR Minimum | ≥ 1,08 (Memo DirKeu 16 Sep 2025) |
| Inflasi bulanan default | 0,3% per bulan |
| Formula XIRR | Newton-Raphson (max 1000 iter, toleransi 1e-7) |
| Formula XNPV | Exact-date discounting |

### 1.5 Target Pengguna

| Level | Peran | Tanggung Jawab Utama |
|-------|-------|----------------------|
| L1 | Direktur / Eksekutif | Dashboard portofolio, visibilitas strategis |
| L2 | GM / SRM | Persetujuan final, review kelayakan |
| L3 | Manager | Review & approval level 1 |
| L4 | Solution Architect / Finance Admin | Input data, trigger kalkulasi |
| L4 | Sales / PIC Proyek | Buat proyek, input parameter |

---

## 2. Perbandingan dengan AWS Calculator

> Sistem KKF dirancang mengadopsi konsep dan UX dari AWS Pricing Calculator — sebuah tool kalkulasi finansial berbasis web yang dikenal dengan kemudahan konfigurasi, transparansi formula, dan kemampuan versioning.

### 2.1 Matriks Perbandingan Fitur

| Dimensi | AWS Pricing Calculator | KKF Web Application |
|---------|----------------------|---------------------|
| **Platform** | Web-based, cloud | Web-based, on-premise Docker |
| **Input Model** | Service-based parameter input | Project-based CAPEX/OPEX/Revenue input |
| **Kalkulasi** | Cost estimate (pricing) | Feasibility analysis (XIRR, XNPV, BCR, PP) |
| **Duration Config** | Per-service, flexible | Per-project, 1–120 bulan, preset + custom |
| **Versioning** | Save & share estimates | Snapshot per kalkulasi, multi-version per proyek |
| **Sharing** | Public link, export JSON | Export PDF/Excel, role-based access |
| **Approval Flow** | ❌ Tidak ada | ✅ Multi-level: Manager → GM/SRM |
| **Audit Trail** | ❌ Tidak ada | ✅ Immutable audit log di PostgreSQL |
| **Conclusion Engine** | Manual interpretation | ✅ Auto: LAYAK / BERSYARAT / TIDAK LAYAK |
| **BCR Threshold** | ❌ Tidak ada | ✅ Configurable per kategori durasi |
| **Preset Templates** | Service presets | ✅ Duration presets (12/24/36/60/120 bulan) |
| **RBAC** | IAM-based | ✅ 6 role: Super Admin, Finance Admin, SA, Manager, GM/SRM, Viewer |
| **Notifikasi** | Email billing alerts | ✅ In-app + email untuk approval workflow |
| **Dashboard Eksekutif** | Cost explorer | ✅ Portfolio KPI dashboard |
| **Storage** | S3 | MinIO (S3-compatible, on-premise) |

### 2.2 Fitur Adopsi dari AWS Calculator

| Konsep AWS | Implementasi di KKF |
|------------|---------------------|
| **Estimate** → buat kalkulasi baru | **Project** → buat KKF baru |
| **Service Config** → atur parameter per service | **Project Config** → atur CAPEX/OPEX/Revenue + duration |
| **Save Estimate** → simpan snapshot | **Calculate** → simpan cashflow + KPI snapshot |
| **Version History** | **Calculation Versions** → JSONB snapshot per versi |
| **Export** → PDF/CSV | **Export** → PDF/Excel dengan full cashflow table |
| **Share Link** | **Approval Submission** → kirim ke Manager |
| **Cost Breakdown** | **Cashflow Table** → breakdown per bulan, per kategori |

---

## 3. Requirements

### 3.1 Kebutuhan Fungsional Utama

#### Modul Manajemen Proyek

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-PROJ-01 | Buat proyek KKF baru dengan wizard 6 langkah | CRITICAL |
| FR-PROJ-02 | Edit proyek berstatus DRAFT | HIGH |
| FR-PROJ-03 | Duplikasi proyek sebagai template | MEDIUM |
| FR-PROJ-04 | Soft-delete (cancel) proyek | HIGH |
| FR-PROJ-05 | Filter & pencarian proyek berdasarkan status, durasi, kategori | HIGH |

#### Modul Konfigurasi Durasi

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-CONFIG-01 | Konfigurasi durasi proyek 1–120 bulan | CRITICAL |
| FR-CONFIG-02 | Override WACC & inflasi per proyek | HIGH |
| FR-CONFIG-03 | Versioning perubahan durasi setelah submitted | CRITICAL |
| FR-CONFIG-04 | Dynamic cashflow array generation (N bulan) | CRITICAL |
| FR-CONFIG-05 | BCR threshold configurable per kategori durasi | HIGH |
| FR-CONFIG-06 | Preset durasi (12/24/36/60/120 bulan + custom) | MEDIUM |
| FR-CONFIG-07 | Validasi input durasi (1–120, integer positif) | HIGH |
| FR-CONFIG-08 | Recalculation otomatis saat durasi berubah di DRAFT | HIGH |

#### Modul Engine Kalkulasi

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-CALC-01 | Hitung XIRR via Newton-Raphson (max 1000 iter, tol 1e-7) | CRITICAL |
| FR-CALC-02 | Hitung XNPV dengan exact-date discounting | CRITICAL |
| FR-CALC-03 | Hitung BCR/PI dan bandingkan dengan threshold berlaku | CRITICAL |
| FR-CALC-04 | Hitung Payback Period dari cumulative cashflow | CRITICAL |
| FR-CALC-05 | Auto-conclusion: LAYAK / BERSYARAT / TIDAK LAYAK | CRITICAL |
| FR-CALC-06 | Kalkulasi berjalan async via job queue | HIGH |
| FR-CALC-07 | OPEX inflation compounding: `OPEX[m] = baseline × (1+r)^(m-1)` | CRITICAL |
| FR-CALC-08 | Active Flag: `period > duration → 0` | CRITICAL |

#### Modul Approval Workflow

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-APR-01 | Submit proyek (COMPUTED → SUBMITTED) | CRITICAL |
| FR-APR-02 | Review & approve level Manager (SLA 2 hari kerja) | CRITICAL |
| FR-APR-03 | Review & approve level GM/SRM (SLA 1 hari kerja) | CRITICAL |
| FR-APR-04 | Reject dengan catatan wajib di semua level | CRITICAL |
| FR-APR-05 | Notifikasi email + in-app untuk setiap transisi status | HIGH |
| FR-APR-06 | Audit trail immutable per transisi | HIGH |

#### Modul Pelaporan

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-RPT-01 | Export laporan kelayakan ke PDF | HIGH |
| FR-RPT-02 | Export cashflow table ke Excel (.xlsx) | HIGH |
| FR-RPT-03 | Dashboard eksekutif portofolio proyek | HIGH |
| FR-RPT-04 | Riwayat export per proyek | MEDIUM |

### 3.2 Kebutuhan Non-Fungsional

| Kategori | Kebutuhan | Target |
|----------|-----------|--------|
| **Performa** | Response time API | ≤ 200ms (p95) |
| **Performa** | Waktu kalkulasi (12 bulan) | ≤ 3 detik |
| **Performa** | Waktu kalkulasi (120 bulan) | ≤ 10 detik |
| **Ketersediaan** | Uptime sistem | ≥ 99,5% |
| **Keamanan** | Enkripsi data transit | TLS 1.3 |
| **Keamanan** | Enkripsi data istirahat | AES-256 |
| **Keamanan** | Autentikasi | JWT RS256, expire 1 jam |
| **Skalabilitas** | Concurrent users | ≥ 50 pengguna simultan |
| **Audit** | Retensi log audit | Minimum 5 tahun |
| **Backup** | Frekuensi backup DB | Harian, retensi 30 hari |

---

## 4. Core Features

### 4.1 Peta Fitur Utama

```
KKF Web Application
├── 🏗️  Manajemen Proyek
│   ├── Buat / Edit / Duplikasi proyek
│   ├── Konfigurasi durasi (1–120 bulan)
│   ├── Input CAPEX (multi-item, multi-periode)
│   ├── Input OPEX baseline + inflasi per item
│   └── Input Revenue stream + eskalasi
│
├── 🧮  Engine Kalkulasi (Async)
│   ├── XIRR (Newton-Raphson)
│   ├── XNPV (exact-date discounting)
│   ├── BCR / Profitability Index
│   ├── Payback Period
│   ├── Auto-conclusion (LAYAK / BERSYARAT / TIDAK LAYAK)
│   └── Versioning snapshot per kalkulasi
│
├── ✅  Approval Workflow
│   ├── Submit → Manager (SLA 2 hari)
│   ├── Manager Approve → GM/SRM (SLA 1 hari)
│   ├── Reject + mandatory comment
│   └── Notifikasi email + in-app
│
├── 📊  Dashboard & Visualisasi
│   ├── KPI Cards (XIRR, XNPV, BCR, PP)
│   ├── Conclusion Badge (color-coded)
│   ├── Dynamic Cashflow Table (N kolom)
│   ├── XNPV Trend Chart
│   ├── Cashflow Waterfall Chart
│   └── Portfolio Heatmap (Eksekutif)
│
├── 📋  Pelaporan & Ekspor
│   ├── PDF Laporan Kelayakan (Puppeteer)
│   ├── Excel Cashflow Table (ExcelJS)
│   └── Pre-signed download URL (MinIO)
│
└── 🔐  Keamanan & Administrasi
    ├── RBAC (6 peran)
    ├── Audit Trail (PostgreSQL)
    ├── Manajemen User
    ├── Konfigurasi Assumption Master
    └── Konfigurasi Duration Presets
```

### 4.2 Matriks RBAC — Akses per Modul

| Modul | Super Admin | Finance Admin | SA | Manager | GM/SRM | Viewer |
|-------|:-----------:|:-------------:|:--:|:-------:|:------:|:------:|
| Buat Proyek | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Proyek (DRAFT) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Trigger Kalkulasi | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Submit Approval | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve (Manager) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve (GM/SRM) | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Lihat Proyek Sendiri | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lihat Semua Proyek | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Export PDF/Excel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Konfigurasi Asumsi | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manajemen User | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Konfigurasi Preset | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dashboard Eksekutif | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

---

## 5. User Flow

### 5.1 Alur Pembuatan & Kalkulasi Proyek

```
[Sales / PIC]                [System]               [SA / Finance Admin]
     │                          │                            │
     ├─ Login ─────────────────►│                            │
     │◄─ Dashboard ─────────────┤                            │
     │                          │                            │
     ├─ Buat Proyek Baru ──────►│                            │
     │  (Wizard 6 Langkah)      │                            │
     │  Step 1: Info Dasar      │                            │
     │  Step 2: Konfigurasi     │                            │
     │          Durasi ─────────┼─ Pilih preset / custom ──►│
     │  Step 3: Input CAPEX     │                            │
     │  Step 4: Input OPEX      │                            │
     │  Step 5: Input Revenue   │                            │
     │  Step 6: Review & Simpan │                            │
     │◄─ Proyek DRAFT dibuat ───┤                            │
     │                          │                            │
     ├─ Trigger Kalkulasi ─────►│                            │
     │◄─ 202 Accepted (jobId) ──┤                            │
     │                          │                            │
     │  [Polling setiap 2 dtk]  ├─ BullMQ Worker aktif      │
     │                          │  ├─ Load CAPEX/OPEX/Rev    │
     │                          │  ├─ Generate N periods     │
     │                          │  ├─ Hitung Active Flag     │
     │                          │  ├─ XNPV, XIRR, BCR, PP   │
     │                          │  ├─ Auto-conclusion        │
     │                          │  └─ Simpan ke DB           │
     │◄─ Status: COMPUTED ──────┤                            │
     │◄─ KPI Cards ditampilkan ─┤                            │
```

### 5.2 Alur Approval

```
[SA / PIC]          [Manager]              [GM/SRM]           [System]
     │                   │                     │                   │
     ├─ Submit ─────────────────────────────────────────────────►│
     │                   │                     │  INSERT approval  │
     │                   │◄── Notifikasi Email ──────────────────┤
     │                   │    "KKF Baru: [Nama Proyek]"          │
     │                   │                     │                   │
     │                   ├─ Buka & Review ─────────────────────►│
     │                   │  (SLA: 2 hari kerja)│   IN_REVIEW      │
     │                   │                     │                   │
     │                   ├─ APPROVE ──────────────────────────►│
     │                   │                     │  APPROVED_L1      │
     │                   │                     │◄─ Notifikasi ────┤
     │                   │                     │                   │
     │                   │                     ├─ Review Final ──►│
     │                   │                     │  (SLA: 1 hari)   │
     │                   │                     │                   │
     │                   │                     ├─ APPROVE ───────►│
     │◄─ Notif: APPROVED ─────────────────────────────────────┤
     │   FINAL            │                     │  APPROVED_FINAL  │
     │                    │                     │  (Frozen)        │
```

### 5.3 State Machine Proyek

```
DRAFT ──[Kalkulasi Sukses]──► COMPUTED ──[Submit]──► SUBMITTED
  ▲                               │                      │
  │                               │                  [Manager Review]
  │ [Revisi]                  [Edit]                     │
  │                               │                  UNDER_REVIEW
  │                               ▼                      │
REJECTED ◄──[Reject]──────────────────────[Approve L1]──► APPROVED_L1
  │                                                       │
  │                                                  [GM/SRM]
  │                                                       │
  │                                              [Approve Final]
  │                                                       │
  └──────────────────────────────────────────► APPROVED_FINAL
                                                          │
                                                     [Archive]
                                                          │
                                                       ARCHIVED
```

---

## 6. ERD Diagram

```mermaid
erDiagram
    USERS {
        uuid   id PK
        string email
        string full_name
        string role
        bool   is_active
        ts     created_at
    }
    PROJECTS {
        uuid    id PK
        uuid    created_by FK
        string  project_code
        string  project_name
        string  status
        int     project_duration_months
        string  duration_category
        decimal wacc_override
        decimal inflation_rate_override
        jsonb   bcr_threshold_override
        bool    duration_locked
        int     calculation_version
        date    contract_start_date
        ts      created_at
    }
    ASSUMPTIONS_MASTER {
        uuid    id PK
        decimal wacc_annual
        decimal inflation_monthly
        decimal bcr_mandatory
        decimal bcr_minimum
        bool    is_active
        date    effective_date
    }
    DURATION_PRESETS {
        uuid    id PK
        string  preset_name
        int     duration_months
        string  category
        decimal bcr_mandatory
        decimal bcr_minimum
        bool    is_active
    }
    CAPEX_ITEMS {
        uuid    id PK
        uuid    project_id FK
        string  item_name
        string  category
        decimal amount
        int     capex_period
    }
    OPEX_MONTHLY {
        uuid    id PK
        uuid    project_id FK
        string  cost_name
        decimal baseline_amount
        decimal inflation_rate
        int     start_period
        int     end_period
    }
    REVENUE_MONTHLY {
        uuid    id PK
        uuid    project_id FK
        string  revenue_stream
        decimal monthly_amount
        decimal escalation_rate
        int     start_period
        int     end_period
    }
    CASHFLOW_MONTHLY {
        uuid    id PK
        uuid    project_id FK
        int     period_number
        date    period_date
        decimal revenue
        decimal opex
        decimal capex
        decimal net_cashflow
        decimal cumulative_cashflow
        int     active_flag
    }
    PROJECT_KPI {
        uuid    id PK
        uuid    project_id FK
        decimal xirr
        decimal xnpv
        decimal bcr
        decimal payback_months
        string  conclusion
        ts      calculated_at
    }
    CALCULATION_VERSIONS {
        uuid    id PK
        uuid    project_id FK
        int     version_number
        int     duration_months
        jsonb   input_snapshot
        jsonb   result_snapshot
        ts      created_at
    }
    APPROVAL_REQUESTS {
        uuid    id PK
        uuid    project_id FK
        uuid    requested_by FK
        string  approval_level
        string  status
        uuid    approved_by FK
        text    comments
        ts      requested_at
        ts      decided_at
    }
    AUDIT_LOGS {
        uuid    id PK
        uuid    user_id FK
        uuid    project_id FK
        string  action
        jsonb   old_value
        jsonb   new_value
        ts      created_at
    }
    NOTIFICATIONS {
        uuid    id PK
        uuid    user_id FK
        uuid    project_id FK
        string  type
        string  title
        bool    is_read
        ts      created_at
    }
    REPORT_EXPORTS {
        uuid    id PK
        uuid    project_id FK
        uuid    exported_by FK
        string  format
        string  file_path
        ts      created_at
    }

    USERS          ||--o{ PROJECTS             : "membuat"
    USERS          ||--o{ APPROVAL_REQUESTS    : "meminta/memutuskan"
    USERS          ||--o{ AUDIT_LOGS           : "menghasilkan"
    USERS          ||--o{ NOTIFICATIONS        : "menerima"
    PROJECTS       ||--|| PROJECT_KPI          : "memiliki satu"
    PROJECTS       ||--o{ CAPEX_ITEMS          : "memiliki"
    PROJECTS       ||--o{ OPEX_MONTHLY         : "memiliki"
    PROJECTS       ||--o{ REVENUE_MONTHLY      : "memiliki"
    PROJECTS       ||--o{ CASHFLOW_MONTHLY     : "menghasilkan"
    PROJECTS       ||--o{ APPROVAL_REQUESTS    : "melalui"
    PROJECTS       ||--o{ CALCULATION_VERSIONS : "memiliki versi"
    PROJECTS       ||--o{ AUDIT_LOGS           : "dilacak"
    PROJECTS       ||--o{ NOTIFICATIONS        : "memicu"
    PROJECTS       ||--o{ REPORT_EXPORTS       : "diekspor"
```

### 6.1 Relasi Antar Tabel

| Tabel Asal | Tabel Tujuan | Relasi | FK Constraint |
|------------|--------------|--------|---------------|
| `users` | `projects` | 1 : N | `SET NULL on delete` |
| `projects` | `capex_items` | 1 : N | `CASCADE DELETE` |
| `projects` | `opex_monthly` | 1 : N | `CASCADE DELETE` |
| `projects` | `revenue_monthly` | 1 : N | `CASCADE DELETE` |
| `projects` | `cashflow_monthly` | 1 : N | `CASCADE DELETE` |
| `projects` | `project_kpi` | 1 : 1 | `CASCADE DELETE` |
| `projects` | `approval_requests` | 1 : N | `CASCADE DELETE` |
| `projects` | `calculation_versions` | 1 : N | `CASCADE DELETE` |
| `projects` | `audit_logs` | 1 : N | `SET NULL on delete` |
| `projects` | `report_exports` | 1 : N | `CASCADE DELETE` |
| `users` | `approval_requests` | 1 : N | `SET NULL on delete` |
| `assumptions_master` | *(standalone)* | — | Global config |
| `duration_presets` | *(standalone)* | — | Lookup table |

---

## 7. Architecture

### 7.1 Gambaran Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: PRESENTATION                                              │
│  Next.js 14 + TypeScript + Tailwind CSS                            │
│  Browser / Mobile                                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│  LAYER 2: API GATEWAY                                               │
│  Nginx — SSL Termination + Rate Limiting + Reverse Proxy           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Internal HTTP
┌──────────────────────────▼──────────────────────────────────────────┐
│  LAYER 3: APPLICATION SERVICES                                      │
│  Fastify 4 + Node.js 20 LTS + TypeScript                          │
│                                                                     │
│  ┌───────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Auth Svc  │ │ Project Svc │ │  Calc Engine │ │ Approval Svc │ │
│  └───────────┘ └─────────────┘ └──────────────┘ └──────────────┘ │
│  ┌───────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Report Svc│ │ Notif Svc   │ │  Audit Svc   │ │  Preset Svc  │ │
│  └───────────┘ └─────────────┘ └──────────────┘ └──────────────┘ │
└──────────┬──────────────┬──────────────────┬────────────────────────┘
           │              │                  │
  ┌────────▼─────┐ ┌──────▼─────┐ ┌─────────▼──────┐
  │  PostgreSQL  │ │   Redis    │ │  BullMQ Queue  │
  │  (Database)  │ │  (Cache)   │ │  (Async Jobs)  │
  └──────────────┘ └────────────┘ └────────────────┘
           │
  ┌────────▼─────┐
  │    MinIO     │
  │ (File Store) │
  └──────────────┘
```

### 7.2 Arsitektur Frontend (Next.js 14)

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login / Logout
│   └── (dashboard)/            # Protected routes
│       ├── page.tsx            # Dashboard eksekutif
│       ├── projects/
│       │   ├── page.tsx        # Daftar proyek
│       │   ├── new/page.tsx    # Wizard 6 langkah
│       │   └── [id]/
│       │       ├── cashflow/   # Tabel cashflow dinamis
│       │       ├── kpi/        # KPI cards + charts
│       │       ├── approval/   # Approval chain
│       │       └── export/     # Ekspor laporan
│       ├── approvals/          # Antrian persetujuan
│       ├── admin/              # User, preset, asumsi
│       └── reports/            # Dashboard portofolio
├── components/
│   ├── project/
│   │   ├── ProjectWizard/      # 6 step wizard
│   │   └── DurationPresetSelector.tsx  ← NEW
│   ├── cashflow/
│   │   └── CashflowTable.tsx   # Render N kolom dinamis
│   ├── kpi/
│   │   ├── KPICard.tsx         # XIRR / XNPV / BCR / PP
│   │   └── ConclusionBadge.tsx # LAYAK / BERSYARAT / TIDAK LAYAK
│   └── approval/
│       └── ApprovalChain.tsx   # Timeline visual
├── hooks/
│   ├── useCalculation.ts       # Poll job status
│   └── usePresets.ts
├── stores/                     # Zustand state
├── services/                   # Axios API client
└── types/                      # TypeScript interfaces
```

### 7.3 Arsitektur Backend (Fastify + Node.js)

```
src/
├── modules/
│   ├── auth/                   # JWT RS256 auth
│   ├── project/                # CRUD + state machine
│   ├── calculation/
│   │   └── engine/
│   │       ├── cashflow.engine.ts   # Active flag, net cashflow
│   │       ├── xnpv.engine.ts       # XNPV exact-date
│   │       ├── xirr.engine.ts       # Newton-Raphson
│   │       ├── bcr.engine.ts        # BCR + threshold check
│   │       ├── payback.engine.ts    # Payback period
│   │       └── conclusion.engine.ts # Auto-conclusion
│   ├── preset/                 # Duration presets CRUD
│   ├── approval/               # Workflow state machine
│   ├── report/                 # PDF + Excel generator
│   ├── notification/           # Email + in-app push
│   └── audit/                  # Audit middleware
├── workers/                    # BullMQ background jobs
│   ├── calculation.worker.ts
│   ├── report.worker.ts
│   └── notification.worker.ts
└── prisma/
    └── schema.prisma           # Full schema definition
```

---

## 8. Database Schema

### 8.1 Ringkasan Tabel

| Tabel | Deskripsi | Baris Estimasi |
|-------|-----------|----------------|
| `users` | Akun pengguna + RBAC role | ~100 |
| `projects` | Master proyek KKF | ~500/tahun |
| `capex_items` | Item CAPEX per proyek | ~5–20 per proyek |
| `opex_monthly` | OPEX baseline per proyek | ~10–30 per proyek |
| `revenue_monthly` | Revenue stream per proyek | ~3–10 per proyek |
| `cashflow_monthly` | Arus kas per bulan per proyek | 12–120 per proyek |
| `project_kpi` | KPI hasil kalkulasi | 1 per proyek |
| `calculation_versions` | Snapshot per recalculation | ~3–10 per proyek |
| `approval_requests` | Permintaan approval | ~2 per proyek |
| `audit_logs` | Jejak semua aksi | ~50–100 per proyek |
| `notifications` | Notifikasi in-app | ~10–20 per proyek |
| `report_exports` | Riwayat ekspor file | ~5 per proyek |
| `assumptions_master` | Konfigurasi global WACC/BCR | ~5–10 record |
| `duration_presets` | Preset durasi | 5–10 record |

### 8.2 SQL DDL — Tabel Utama

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN', 'FINANCE_ADMIN', 'SA', 'MANAGER', 'GM_SRM', 'VIEWER'
);
CREATE TYPE project_status AS ENUM (
  'DRAFT', 'COMPUTED', 'SUBMITTED', 'UNDER_REVIEW',
  'APPROVED_L1', 'APPROVED_FINAL', 'REJECTED', 'ARCHIVED', 'CANCELLED'
);
CREATE TYPE duration_category AS ENUM (
  'SHORT_TERM', 'MID_TERM', 'LONG_TERM', 'EXTENDED', 'CUSTOM'
);
CREATE TYPE conclusion_type AS ENUM (
  'LAYAK', 'BERSYARAT', 'TIDAK_LAYAK'
);

-- Tabel Utama: projects
CREATE TABLE projects (
  id                       UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by               UUID              REFERENCES users(id) ON DELETE SET NULL,
  project_code             VARCHAR(50)       NOT NULL UNIQUE, -- Auto: KKF-YYYY-NNNN
  project_name             VARCHAR(255)      NOT NULL,
  status                   project_status    NOT NULL DEFAULT 'DRAFT',
  project_duration_months  INTEGER           NOT NULL DEFAULT 12
                                             CHECK (project_duration_months BETWEEN 1 AND 120),
  duration_category        duration_category NOT NULL DEFAULT 'SHORT_TERM',
  contract_start_date      DATE              NOT NULL,
  wacc_override            NUMERIC(8,4),     -- NULL = gunakan global
  inflation_rate_override  NUMERIC(8,6),     -- NULL = gunakan global
  bcr_threshold_override   JSONB,            -- {"mandatory": 1.23, "minimum": 1.08}
  duration_locked          BOOLEAN           NOT NULL DEFAULT FALSE,
  calculation_version      INTEGER           NOT NULL DEFAULT 1,
  created_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Tabel: cashflow_monthly (row-based, N rows per proyek)
CREATE TABLE cashflow_monthly (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_number        INTEGER       NOT NULL CHECK (period_number >= 1),
  period_date          DATE          NOT NULL,
  revenue              NUMERIC(18,2) NOT NULL DEFAULT 0,
  opex                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  capex                NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_cashflow         NUMERIC(18,2) NOT NULL,
  cumulative_cashflow  NUMERIC(18,2) NOT NULL,
  active_flag          SMALLINT      NOT NULL DEFAULT 1 CHECK (active_flag IN (0,1)),
  UNIQUE (project_id, period_number)
);

-- Tabel: project_kpi (1:1 dengan projects)
CREATE TABLE project_kpi (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID            NOT NULL REFERENCES projects(id)
                                     ON DELETE CASCADE UNIQUE,
  xirr               NUMERIC(12,6),  -- % per annum
  xnpv               NUMERIC(20,2),  -- IDR
  bcr                NUMERIC(10,4),  -- Rasio
  payback_months     NUMERIC(8,2),   -- Bulan
  conclusion         conclusion_type,
  bcr_threshold_used JSONB,
  wacc_used          NUMERIC(8,4),
  calculated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Trigger: auto set duration_category
CREATE OR REPLACE FUNCTION trigger_set_duration_category()
RETURNS TRIGGER AS $$
BEGIN
  NEW.duration_category = CASE
    WHEN NEW.project_duration_months <= 12  THEN 'SHORT_TERM'::duration_category
    WHEN NEW.project_duration_months <= 36  THEN 'MID_TERM'::duration_category
    WHEN NEW.project_duration_months <= 60  THEN 'LONG_TERM'::duration_category
    WHEN NEW.project_duration_months <= 120 THEN 'EXTENDED'::duration_category
    ELSE 'CUSTOM'::duration_category
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_duration_category
  BEFORE INSERT OR UPDATE OF project_duration_months ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_duration_category();
```

### 8.3 Formula Kalkulasi Utama

| Formula | Implementasi |
|---------|-------------|
| **Active Flag** | `active_flag[m] = (m ≤ N) ? 1 : 0` |
| **OPEX Inflation** | `OPEX[m] = baseline × (1 + r_monthly)^(m-1) × active_flag[m]` |
| **XNPV** | `XNPV = Σ CF[m] / (1 + WACC_annual)^((date[m] - date[0]) / 365)` |
| **XIRR** | Newton-Raphson: `f(r) = XNPV(r) = 0`, max 1000 iter, tol 1e-7 |
| **BCR** | `BCR = PV(Inflows) / \|PV(Outflows)\|` |
| **Payback Period** | `PP = m pertama di mana cumulative_cashflow[m] ≥ 0` |
| **Kesimpulan** | `LAYAK: BCR ≥ 1.23 AND XIRR ≥ WACC` · `BERSYARAT: BCR ≥ 1.08` · `TIDAK LAYAK: BCR < 1.08` |

---

## 9. Tech Stack

### 9.1 Stack Final (Docker + JavaScript)

```
┌─────────────────────────────────────────────────┐
│                TECH STACK KKF                   │
├──────────────┬──────────────────────────────────┤
│  FRONTEND    │  Next.js 14 + TypeScript         │
│              │  Tailwind CSS + shadcn/ui         │
│              │  Chart.js (visualisasi)           │
│              │  React Query + Zustand (state)    │
│              │  React Hook Form + Zod            │
│              │  Socket.io-client (realtime)      │
├──────────────┼──────────────────────────────────┤
│  BACKEND     │  Fastify 4 + Node.js 20 LTS      │
│              │  TypeScript + Prisma ORM          │
│              │  BullMQ (job queue)               │
│              │  Pino (structured logging)        │
│              │  Nodemailer (email)               │
│              │  ExcelJS (xlsx export)            │
│              │  Puppeteer (pdf export)           │
├──────────────┼──────────────────────────────────┤
│  DATABASE    │  PostgreSQL 15                    │
│              │  Redis 7 (cache + queue)          │
│              │  MinIO (file storage / S3-compat) │
├──────────────┼──────────────────────────────────┤
│  GATEWAY     │  Nginx 1.25-alpine               │
│              │  SSL/TLS termination              │
│              │  Rate limiting                    │
├──────────────┼──────────────────────────────────┤
│  INFRA       │  Docker + Docker Compose          │
│              │  Docker Secrets (JWT keys)        │
└──────────────┴──────────────────────────────────┘
```

### 9.2 Keputusan Stack

| Komponen | Pilihan | Alasan |
|----------|---------|--------|
| Framework Frontend | Next.js 14 App Router | SSR + static hybrid, DX terbaik |
| Framework Backend | Fastify | 2–3× lebih cepat dari Express, schema-first |
| ORM | Prisma | Type-safe queries, migration management |
| Database | PostgreSQL 15 | NUMERIC precision untuk finansial, JSONB untuk snapshot |
| Cache & Queue | Redis + BullMQ | Battle-tested untuk job queue, retry, backoff |
| File Storage | MinIO | S3-compatible, on-premise, gratis |
| Auth | JWT RS256 | Asymmetric key — stateless, secure |
| Logging | Pino (stdout JSON) | Built-in Fastify, zero overhead, `docker logs` |
| Error Tracking | Sentry (optional) | Free tier 5K errors/bulan, SDK ringan |

> **Tidak digunakan:** Elasticsearch, Kibana, Prometheus, Grafana — digantikan oleh Pino stdout logging + `/health` endpoint + audit_logs table di PostgreSQL.

---

## 10. Technology Flow & Arsitektur Sistem

### 10.1 Request Flow — Login & Autentikasi

```
Browser → POST /api/v1/auth/login {email, password}
  → Nginx (rate limit 10/menit per IP)
  → Fastify: Zod validation
  → AuthService:
      1. Query users WHERE email = $1 AND is_active = true
      2. bcrypt.compare(password, hash)
      3. Generate JWT RS256 (expire: 1 jam)
      4. Store refresh token di Redis (TTL: 7 hari)
      5. Update last_login_at
      6. Audit log: action='LOGIN'
  → Response 200: { token, refreshToken, user }
```

### 10.2 Request Flow — Kalkulasi (Async)

```
Browser → POST /api/v1/projects/:id/calculate
  → Fastify: JWT verify + RBAC check
  → Enqueue BullMQ job → Response 202 { jobId }

[Background Worker]
  1. Load project config (duration, WACC, inflasi)
  2. Resolve BCR threshold (project > preset > global)
  3. Load CAPEX / OPEX / Revenue dari DB
  4. Generate periods[1..N]: { period_number, date }
  5. active_flag[m] = m ≤ N ? 1 : 0
  6. OPEX[m] = baseline × (1+r)^(m-1) × flag
  7. Revenue[m] = base × (1+esc)^(m-1) × flag
  8. CAPEX[m] = Σ items where capex_period = m
  9. net_cf[m] = Revenue - OPEX - CAPEX
  10. XNPV = Σ cf[m] / (1+wacc)^((date[m]-date[0])/365)
  11. XIRR via Newton-Raphson
  12. BCR = PV(positif) / |PV(negatif)|
  13. PP = pertama cumulative ≥ 0
  14. Conclusion = LAYAK / BERSYARAT / TIDAK LAYAK
  15. Upsert cashflow_monthly (N rows)
  16. Upsert project_kpi
  17. Insert calculation_versions (snapshot)
  18. Update projects.status = 'COMPUTED'
  19. Emit WebSocket: { event: 'calc:done', kpi }

Browser polling GET /status/:jobId → terima KPI
```

### 10.3 Deployment Architecture — Final Stack

```
NETWORK: kkf-public
  └── nginx:1.25-alpine  (Port 80 → 443)
         ↓ proxy
NETWORK: kkf-app (internal)
  ├── frontend   Next.js 14     :3000
  ├── backend    Fastify 4      :4000
  └── worker     BullMQ ×2      (no port)
         ↓
NETWORK: kkf-data (isolated)
  ├── postgres:15    :5432  (Vol: pgdata)
  ├── redis:7        :6379  (Vol: redisdata)
  └── minio:latest   :9000  (Vol: miniodata, Console: 9001 localhost only)

Total: 7 container | 3 named volumes | 2 internal networks
Resource: ~2.4 GB RAM | ~3.6 CPU | Min server: 4 CPU / 8 GB / 50 GB SSD
```

### 10.4 Docker Compose — Simplified Final

```yaml
version: "3.9"

networks:
  kkf-public:
    driver: bridge
  kkf-app:
    driver: bridge
    internal: true
  kkf-data:
    driver: bridge
    internal: true

volumes:
  pgdata:
  redisdata:
  miniodata:

secrets:
  jwt_private_key:
    file: ./secrets/jwt_private.pem
  jwt_public_key:
    file: ./secrets/jwt_public.pem

services:
  nginx:
    image: nginx:1.25-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks: [kkf-public, kkf-app]
    depends_on: [frontend, backend]
    restart: unless-stopped

  frontend:
    build: { context: ./frontend, target: production }
    expose: ["3000"]
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.navpro.example.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    networks: [kkf-app]
    restart: unless-stopped

  backend:
    build: { context: ./backend, target: production }
    expose: ["4000"]
    environment:
      - DATABASE_URL=postgresql://kkf_user:${DB_PASSWORD}@postgres:5432/kkf_db
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - MINIO_ENDPOINT=minio
      - LOG_LEVEL=info
    secrets: [jwt_private_key, jwt_public_key]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [kkf-app, kkf-data]
    restart: unless-stopped

  worker:
    build: { context: ./backend, dockerfile: Dockerfile.worker }
    command: ["node", "dist/workers/index.js"]
    environment:
      - DATABASE_URL=postgresql://kkf_user:${DB_PASSWORD}@postgres:5432/kkf_db
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [kkf-app, kkf-data]
    restart: unless-stopped
    deploy:
      replicas: 2

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kkf_db
      POSTGRES_USER: kkf_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    networks: [kkf-data]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kkf_user -d kkf_db"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb
    volumes: [redisdata:/data]
    networks: [kkf-data]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      retries: 3

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes: [miniodata:/data]
    ports: ["127.0.0.1:9001:9001"]
    networks: [kkf-data]
    restart: unless-stopped
```

### 10.5 Quick Start

```bash
# 1. Clone & setup env
git clone https://github.com/your-org/navpro-app.git && cd navpro-app
cp .env.example .env.local   # isi semua credentials

# 2. Generate JWT key pair (RS256)
mkdir -p secrets
openssl genrsa -out secrets/jwt_private.pem 2048
openssl rsa -in secrets/jwt_private.pem -pubout -out secrets/jwt_public.pem

# 3. Jalankan semua service
docker compose up --build -d

# 4. Migrasi database
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# 5. Buat bucket MinIO
docker compose exec minio mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker compose exec minio mc mb local/kkf-exports

# 6. Akses aplikasi
# https://localhost          → Aplikasi KKF
# https://localhost/api/docs → Swagger UI (API Docs)
# http://localhost:9001      → MinIO Console (localhost only)

# 7. Scale workers (untuk load tinggi)
docker compose up --scale worker=3 -d

# 8. Lihat log realtime
docker compose logs -f backend worker
```

---

*PRD ini merupakan ringkasan dari BRD KKF v1.2 — untuk detail lengkap, rujuk ke dokumen:*
*`BRD_KKF_ProyekInvestasi_1Tahun_v1.0_ID.docx`*

---
> **NAVPRO** | Dokumen Internal — CONFIDENTIAL


---

## 11. CMS Admin Panel — Modul Konfigurasi Sistem {#cms-admin-panel}

> **Tujuan:** Seluruh variabel operasional yang sebelumnya hardcoded kini dapat dikelola melalui antarmuka CMS tanpa perlu deployment ulang.

### 11.1 Ringkasan Modul CMS

| ID | Modul | Deskripsi Singkat | Role Akses |
|----|-------|-------------------|------------|
| CMS-01 | Assumption Master | WACC, inflasi, threshold BCR, mata uang, tanggal efektif | Super Admin, Finance Admin |
| CMS-02 | Duration Preset | Preset durasi proyek 1–120 bulan (SHORT/MID/LONG/EXTENDED/CUSTOM) | Super Admin |
| CMS-03 | SLA Approval Config | Batas waktu approval per role, reminder, eskalasi | Super Admin |
| CMS-04 | CAPEX Category | Kategori belanja modal (HARDWARE, SOFTWARE, CIVIL, dll.) | Super Admin, Finance Admin |
| CMS-05 | OPEX Category | Kategori biaya operasional (LABOR, MAINTENANCE, ELECTRICITY, dll.) | Super Admin, Finance Admin |
| CMS-06 | Notification Template | Template email/in-app per event sistem (12 template) | Super Admin |
| CMS-07 | Currency & Format | Format angka, mata uang, locale, desimal | Super Admin |
| CMS-08 | Audit Retention | Kebijakan retensi log audit dan data lama | Super Admin |
| CMS-09 | System Parameter | Key-value store 29 parameter sistem (formula, security, fitur flag) | Super Admin |
| CMS-10 | User Management | CRUD user, reset password, force logout, bulk role | Super Admin |
| CMS-11 | Audit Log Viewer | Filter & export audit trail seluruh aktivitas sistem | Super Admin, Finance Admin |
| CMS-12 | System Health | Status 6 container, statistik harian, toggle maintenance mode | Super Admin |

---

### 11.2 CMS-01 — Assumption Master

**Variabel yang dikelola:**

| Kunci | Nilai Default | Keterangan |
|-------|--------------|------------|
| `wacc_annual` | 9.72% | VP Keuangan April 2026 |
| `inflation_monthly` | 0.3% | Asumsi baseline bulanan |
| `bcr_mandatory` | 1.23 | Memo DirKeu 16 Sep 2025 |
| `bcr_minimum` | 1.08 | Ambang batas minimum BCR |
| `currency` | IDR | Mata uang default |
| `effective_date` | 2026-04-01 | Tanggal berlaku asumsi |
| `notes` | — | Catatan/referensi memo |

**Alur Kerja:**
- Finance Admin mengubah nilai → sistem mencatat versi lama ke `assumptions_master_history`
- Perubahan berlaku untuk proyek baru; proyek aktif tidak terpengaruh
- Audit trail otomatis: user, timestamp, nilai lama vs baru

---

### 11.3 CMS-02 — Duration Preset

**Kategori Durasi:**

| Kategori | Rentang (bulan) | Contoh Preset |
|----------|----------------|---------------|
| SHORT_TERM | 1–12 | 3 bulan, 6 bulan, 12 bulan |
| MID_TERM | 13–36 | 18 bulan, 24 bulan, 36 bulan |
| LONG_TERM | 37–60 | 48 bulan, 60 bulan |
| EXTENDED | 61–120 | 84 bulan, 120 bulan |
| CUSTOM | 1–120 | Input bebas oleh SA |

**Fitur:** Tambah/edit/nonaktifkan preset, urutan tampilan di dropdown, label multi-bahasa.

---

### 11.4 CMS-03 — SLA Approval Config

**Tabel `sla_config`:**

| role_key | sla_working_days | reminder_hours | escalation_hours | escalate_to_role |
|----------|-----------------|----------------|-----------------|-----------------|
| manager | 2 | 24 | 48 | gm_srm |
| gm_srm | 1 | 12 | 24 | finance_admin |

**Logika:** Sistem BullMQ menjalankan job `check-sla` setiap jam. Jika deadline terlampaui → kirim notifikasi escalation ke role di atas.

---

### 11.5 CMS-04 & CMS-05 — Kategori CAPEX & OPEX

**Default CAPEX (8 kategori):**
`HARDWARE`, `SOFTWARE`, `CIVIL`, `NETWORK`, `POWER`, `VEHICLE`, `INTEGRATION`, `OTHER`

**Default OPEX (10 kategori):**
`LABOR`, `MAINTENANCE`, `ELECTRICITY`, `BANDWIDTH`, `RENT`, `INSURANCE`, `ADMIN`, `TRANSPORT`, `OVERHEAD`, `OTHER`

Setiap kategori: nama, kode, deskripsi, urutan, status aktif. Custom kategori dapat ditambahkan oleh Super Admin.

---

### 11.6 CMS-06 — Notification Template

**12 Template Event:**

| ID | Event | Channel |
|----|-------|---------|
| NOTIF-01 | Project submitted for review | Email + In-App |
| NOTIF-02 | Project approved (Manager) | Email + In-App |
| NOTIF-03 | Project rejected | Email + In-App |
| NOTIF-04 | SLA reminder (H-24) | Email + In-App |
| NOTIF-05 | SLA escalation | Email + In-App |
| NOTIF-06 | Project approved (GM/SRM) | Email + In-App |
| NOTIF-07 | New user created | Email |
| NOTIF-08 | Password reset | Email |
| NOTIF-09 | Calculation completed | In-App |
| NOTIF-10 | Export report ready | In-App |
| NOTIF-11 | Maintenance mode ON | Email + In-App |
| NOTIF-12 | System alert (health) | Email |

**Variabel Template:** `{{project_name}}`, `{{project_code}}`, `{{requester_name}}`, `{{approver_name}}`, `{{deadline_date}}`, `{{reason}}`, `{{login_url}}`

**Fitur Editor:** Rich text editor + preview render + test send ke email dummy.

---

### 11.7 CMS-09 — System Parameter (29 Konfigurasi)

```
Kategori FORMULA (4 parameter):
  xirr_max_iterations = 1000
  xirr_tolerance      = 1e-7
  npv_precision       = 2
  cashflow_rounding   = 0

Kategori SECURITY (6 parameter):
  jwt_expiry_minutes         = 60
  refresh_token_days         = 7
  max_login_attempts         = 5
  lockout_minutes            = 30
  password_min_length        = 8
  session_idle_timeout_mins  = 30

Kategori FORMAT (5 parameter):
  date_format          = DD/MM/YYYY
  datetime_format      = DD/MM/YYYY HH:mm
  number_locale        = id-ID
  currency_symbol      = Rp
  decimal_places       = 2

Kategori FEATURE_FLAG (8 parameter):
  enable_pdf_export      = true
  enable_excel_export    = true
  enable_email_notif     = true
  enable_inapp_notif     = true
  enable_audit_log       = true
  enable_2fa             = false
  enable_api_docs        = true
  maintenance_mode       = false

Kategori SYSTEM (6 parameter):
  app_version            = 1.0.0
  max_file_upload_mb     = 10
  max_projects_per_user  = 50
  default_pagination     = 20
  audit_retention_days   = 365
  report_cache_minutes   = 60
```

---

### 11.8 CMS-12 — System Health Dashboard

**6 Service Tiles yang Dipantau:**

| Service | Port | Health Check |
|---------|------|-------------|
| nginx | 80/443 | HTTP 200 / |
| backend | 3001 | GET /health |
| worker | — | BullMQ queue depth |
| postgres | 5432 | pg_isready |
| redis | 6379 | PING → PONG |
| minio | 9000 | GET /minio/health/live |

**Statistik Harian:** Total proyek aktif, kalkulasi hari ini, export hari ini, user login hari ini, error rate, avg response time.

**Maintenance Mode Toggle:** Satu klik → semua endpoint kecuali `/health` mengembalikan `503 Service Unavailable` dengan pesan custom.

---

### 11.9 Database Schema — Tabel Baru CMS

```sql
-- SLA Configuration
CREATE TABLE sla_config (
  id               SERIAL PRIMARY KEY,
  role_key         VARCHAR(50) UNIQUE NOT NULL,
  sla_working_days INTEGER NOT NULL DEFAULT 2,
  reminder_hours   INTEGER NOT NULL DEFAULT 24,
  escalation_hours INTEGER NOT NULL DEFAULT 48,
  escalate_to_role VARCHAR(50),
  is_active        BOOLEAN DEFAULT true,
  updated_by       INTEGER REFERENCES users(id),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- CAPEX Categories
CREATE TABLE capex_categories (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- OPEX Categories
CREATE TABLE opex_categories (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Notification Templates
CREATE TABLE notification_templates (
  id             SERIAL PRIMARY KEY,
  event_key      VARCHAR(50) UNIQUE NOT NULL,  -- NOTIF-01 s/d NOTIF-12
  channel        VARCHAR(20) NOT NULL,          -- EMAIL, INAPP, BOTH
  subject        TEXT,
  body_html      TEXT,
  inapp_title    VARCHAR(200),
  inapp_body     TEXT,
  available_vars JSONB,                         -- daftar variabel yang tersedia
  is_active      BOOLEAN DEFAULT true,
  updated_by     INTEGER REFERENCES users(id),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- System Config (Key-Value Store)
CREATE TABLE system_config (
  id          SERIAL PRIMARY KEY,
  config_key  VARCHAR(100) UNIQUE NOT NULL,
  config_val  TEXT NOT NULL,
  category    VARCHAR(50) NOT NULL,  -- FORMULA, SECURITY, FORMAT, FEATURE_FLAG, SYSTEM
  data_type   VARCHAR(20) DEFAULT 'string',  -- string, integer, float, boolean, json
  description TEXT,
  is_editable BOOLEAN DEFAULT true,
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### 11.10 API Endpoints Admin CMS

**Base path:** `/api/v1/admin/` — semua endpoint memerlukan role `super_admin` atau `finance_admin`

```
# Assumption Master
GET    /api/v1/admin/assumptions              → Daftar asumsi aktif
PUT    /api/v1/admin/assumptions/:key         → Update nilai asumsi
GET    /api/v1/admin/assumptions/history      → Riwayat perubahan

# Duration Preset
GET    /api/v1/admin/duration-presets         → Daftar preset aktif
POST   /api/v1/admin/duration-presets         → Tambah preset baru
PUT    /api/v1/admin/duration-presets/:id     → Update preset
DELETE /api/v1/admin/duration-presets/:id     → Nonaktifkan preset

# SLA Config
GET    /api/v1/admin/sla-config               → Konfigurasi SLA per role
PUT    /api/v1/admin/sla-config/:role_key     → Update SLA role tertentu

# CAPEX / OPEX Categories
GET    /api/v1/admin/capex-categories         → Daftar kategori CAPEX
POST   /api/v1/admin/capex-categories         → Tambah kategori
PUT    /api/v1/admin/capex-categories/:id     → Update kategori
GET    /api/v1/admin/opex-categories          → Daftar kategori OPEX
POST   /api/v1/admin/opex-categories          → Tambah kategori
PUT    /api/v1/admin/opex-categories/:id      → Update kategori

# Notification Templates
GET    /api/v1/admin/notification-templates           → Semua template
GET    /api/v1/admin/notification-templates/:event_key → Detail template
PUT    /api/v1/admin/notification-templates/:event_key → Update template
POST   /api/v1/admin/notification-templates/:event_key/test → Test kirim

# System Config
GET    /api/v1/admin/system-config            → Semua parameter (grouped by category)
PUT    /api/v1/admin/system-config/:key       → Update satu parameter
POST   /api/v1/admin/system-config/bulk       → Update banyak parameter sekaligus

# User Management
GET    /api/v1/admin/users                    → Daftar user + filter
POST   /api/v1/admin/users                    → Buat user baru
PUT    /api/v1/admin/users/:id                → Edit user
POST   /api/v1/admin/users/:id/reset-password → Reset password
POST   /api/v1/admin/users/:id/force-logout   → Paksa logout
POST   /api/v1/admin/users/bulk-role          → Ubah role massal

# Audit Log
GET    /api/v1/admin/audit-logs               → Filter + paginasi
GET    /api/v1/admin/audit-logs/export        → Export CSV/Excel

# System Health
GET    /api/v1/admin/system-health            → Status semua service
POST   /api/v1/admin/system-health/maintenance → Toggle maintenance mode
```

---

### 11.11 Frontend Route Structure (Admin CMS)

```
src/app/(dashboard)/admin/
├── page.tsx                        ← Admin overview (CMS-12 health tiles)
├── assumptions/
│   ├── page.tsx                    ← CMS-01 Assumption Master
│   └── history/page.tsx            ← Riwayat perubahan asumsi
├── duration-presets/
│   └── page.tsx                    ← CMS-02 Duration Preset manager
├── sla-config/
│   └── page.tsx                    ← CMS-03 SLA Approval Config
├── categories/
│   ├── capex/page.tsx              ← CMS-04 CAPEX Categories
│   └── opex/page.tsx               ← CMS-05 OPEX Categories
├── notification-templates/
│   ├── page.tsx                    ← CMS-06 Template list
│   └── [event_key]/page.tsx        ← Editor template individual
├── system-config/
│   └── page.tsx                    ← CMS-07, CMS-08, CMS-09 (tabbed)
├── users/
│   └── page.tsx                    ← CMS-10 User Management
├── audit-logs/
│   └── page.tsx                    ← CMS-11 Audit Log Viewer
└── system-health/
    └── page.tsx                    ← CMS-12 Health Dashboard
```

---

### 11.12 RBAC Matrix — Admin CMS

| Modul | Super Admin | Finance Admin | Manager | GM/SRM | SA | Viewer |
|-------|:-----------:|:-------------:|:-------:|:------:|:--:|:------:|
| CMS-01 Assumption Master | ✅ Edit | ✅ Edit | 👁 View | 👁 View | — | — |
| CMS-02 Duration Preset | ✅ Edit | — | — | — | — | — |
| CMS-03 SLA Config | ✅ Edit | — | — | — | — | — |
| CMS-04 CAPEX Category | ✅ Edit | ✅ Edit | — | — | — | — |
| CMS-05 OPEX Category | ✅ Edit | ✅ Edit | — | — | — | — |
| CMS-06 Notif Template | ✅ Edit | — | — | — | — | — |
| CMS-07/08/09 Sys Config | ✅ Edit | — | — | — | — | — |
| CMS-10 User Management | ✅ Full | — | — | — | — | — |
| CMS-11 Audit Log | ✅ Full | 👁 View | — | — | — | — |
| CMS-12 System Health | ✅ Full | 👁 View | — | — | — | — |

---

*Untuk spesifikasi lengkap CMS Admin Panel, rujuk ke: **Appendix G — BRD KKF v1.2***
