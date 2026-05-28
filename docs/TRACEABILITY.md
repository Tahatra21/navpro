# Matriks Traceability — FR → API → Halaman

Ringkasan pemetaan kebutuhan PRD (`docs/htj.md`) ke implementasi NAVPRO (Batch A).

| FR ID | Kebutuhan | Endpoint API | Halaman / Komponen |
|-------|-----------|--------------|-------------------|
| FR-PROJ-01 | Wizard 6 langkah create | `POST /projects`, `POST /projects/:id/calculate` | `/projects/new`, `ProjectWizard` |
| FR-PROJ-02 | Edit proyek DRAFT/COMPUTED/REJECTED | `PUT /projects/:id` | `/projects/[id]/edit` |
| FR-PROJ-03 | Duplikasi proyek | `POST /projects/:id/duplicate` | Detail → Duplikasi |
| FR-PROJ-04 | Archive proyek | `POST /projects/:id/archive` | Detail → Arsip |
| FR-PROJ-05 | Filter proyek | `GET /projects?status&search&duration_*` | `/projects` |
| FR-CONFIG-06 | Preset durasi | `GET /config/presets` | Wizard step 2 |
| FR-CONFIG-05 | BCR threshold override | body `bcr_threshold_override` | Wizard step 2 |
| FR-CALC-06 | Kalkulasi async | `POST /projects/:id/calculate-async`, `GET /jobs/:id` | Wizard step 6, Detail hitung ulang |
| FR-APR-01–04 | Submit / approve / reject | `POST .../submit|approve|reject` | `/projects/[id]` |
| FR-APR-05 | Notifikasi | `GET /notifications` | `NotificationBell` |
| FR-APR-06 | Audit trail | `GET /projects/:id/audit-logs` | `ProjectAuditLog` |
| FR-RPT-03 | Dashboard portofolio | `GET /dashboard/portfolio` | `/dashboard` |
| — | Approval queue | `GET /dashboard/approval-queue` | `/approvals`, dashboard queue |
| — | Version snapshot | `GET /projects/:id/versions/:ver` | `VersionHistory` |

**Batch berikutnya (B–D):** FR-RPT-01/02 (export), CMS §11, offline, Docker — lihat `PLAN_PENYEMPURNAAN.md`.
