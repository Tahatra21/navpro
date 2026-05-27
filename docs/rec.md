# Rekomendasi Pengembangan NAVPRO (KKF Web App)
> Basis review: `htj.md` (PRD), `exsum.md` (kecocokan vs Excel), `README.md` (operasional MVP saat ini).  
> Fokus: **fungsionalitas** dan **tampilan/UX**, disusun **fase demi fase** dari yang paling mudah hingga paling sulit.

---

## Update Kondisi Saat Ini (per 2026-05-27)

### Checklist Implementasi (Tabel)

<table>
  <thead>
    <tr>
      <th>Fase/Area</th>
      <th>Item</th>
      <th>Status</th>
      <th>Catatan</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Phase 0 (Login)</td>
      <td>Login UI polish (bg, logo/tagline, password row, remember me, Internal Use Only)</td>
      <td>✅ Done</td>
      <td><code>img/bg.png</code>, layout tidak overlap</td>
    </tr>
    <tr>
      <td>Phase 1 (Wizard)</td>
      <td>Wizard 6 langkah + validasi input kuat (FE+BE)</td>
      <td>✅ Done</td>
      <td>durasi 1–120, non-negatif, required fields, validasi CAPEX/OPEX/Revenue</td>
    </tr>
    <tr>
      <td>Phase 2 (Versioning)</td>
      <td>Versioning kalkulasi + snapshot per calculate</td>
      <td>✅ Done</td>
      <td>tabel <code>calculation_versions</code> + endpoint versi</td>
    </tr>
    <tr>
      <td>Phase 2 (UI)</td>
      <td>Version History + Load Snapshot (online/API)</td>
      <td>✅ Done</td>
      <td>tombol aktif saat API tersedia</td>
    </tr>
    <tr>
      <td>Phase 2 (Export)</td>
      <td>Export PDF rapi (print stylesheet)</td>
      <td>✅ Done</td>
      <td>termasuk audit log</td>
    </tr>
    <tr>
      <td>Phase 2 (Export)</td>
      <td>Export Excel <code>.xlsx</code> (SheetJS)</td>
      <td>✅ Done</td>
      <td>Summary + Cashflow + audit log</td>
    </tr>
    <tr>
      <td>Phase 3 (Approval UI)</td>
      <td>Approval queue + SLA badge (due/overdue)</td>
      <td>✅ Done</td>
      <td>termasuk limit ~5 baris + scroll</td>
    </tr>
    <tr>
      <td>Phase 3 (Approval role)</td>
      <td>Approval action visible untuk admin role</td>
      <td>✅ Done</td>
      <td>Super Admin &amp; Finance Admin</td>
    </tr>
    <tr>
      <td>Admin UX</td>
      <td>Admin panel UI/UX (sidebar sticky, header sticky, spacing)</td>
      <td>✅ Done</td>
      <td></td>
    </tr>
    <tr>
      <td>Projects UX</td>
      <td>Spacing kolom Kemungkinan vs Status</td>
      <td>✅ Done</td>
      <td>padding kolom diperlebar</td>
    </tr>
    <tr>
      <td>Demo data</td>
      <td>Tambah ~20 project status mix</td>
      <td>✅ Done</td>
      <td>untuk testing UI</td>
    </tr>
    <tr>
      <td>Nav UX</td>
      <td>Klik logo header kembali ke home</td>
      <td>✅ Done</td>
      <td></td>
    </tr>
    <tr>
      <td>Phase 3 (SLA)</td>
      <td>SLA reminder server-side + escalation + notif</td>
      <td>✅ Done</td>
      <td>scheduler backend + dedup <code>sla_events</code> + audit log + notif per role</td>
    </tr>
    <tr>
      <td>Phase 3 (Approval)</td>
      <td>Reject comment wajib + approval queue page khusus</td>
      <td>✅ Done</td>
      <td>Approvals page + aksi Approve/Reject dari tabel + kolom Pengusul &amp; SLA start</td>
    </tr>
    <tr>
      <td>Phase 4 (Quality)</td>
      <td>Refactor calc engine + regression tests (fixtures)</td>
      <td>✅ Done</td>
      <td>engine modular + <code>node --test</code> fixtures regression</td>
    </tr>
    <tr>
      <td>Phase 4 (Infra)</td>
      <td>Async jobs (Redis/BullMQ) untuk kalkulasi/export</td>
      <td>🟡 Ready</td>
      <td>BullMQ scaffold + endpoint calculate-async (aktif setelah set <code>REDIS_URL</code>)</td>
    </tr>
  </tbody>
</table>

## Ringkasan Temuan Utama (Gap vs PRD)

- **Frontend/stack tidak mengikuti PRD**: PRD menargetkan Next.js + TS + Tailwind + shadcn, namun implementasi saat ini adalah **static HTML/CSS/JS**. Ini bukan masalah untuk MVP, tapi akan membatasi skalabilitas UI (wizard kompleks, state management, aksesibilitas, komponen reusable).
- **Async job queue (BullMQ/Redis/worker) belum ada**: PRD mengharuskan kalkulasi async + SLA checker + export job. Saat ini backend MVP (Express) cenderung sinkron.
- **Export (sebagian gap sudah tertutup di MVP)**: saat ini sudah ada **print-ready PDF** dan export **Excel `.xlsx`** di frontend. PRD masih menargetkan job-based export (Puppeteer/ExcelJS) untuk skala/templating enterprise.
- **CMS Admin Panel di PRD sangat kaya**: PRD menguraikan modul asumsi/preset/SLA/template-notif/health/user mgmt. MVP saat ini umumnya baru baseline.
- **Kualitas data & audit**: sebagian sudah ada audit log dan snapshot versi kalkulasi; PRD menuntut audit trail “immutable” yang lebih lengkap (standar event + delta konsisten + metadata).

---

## Prinsip Arah Pengembangan (Supaya tidak “bongkar ulang”)

- **Pertahankan MVP berjalan**: lakukan refactor bertahap (strangler pattern). Jangan migrasi besar-besaran sebelum modul paling kritikal stabil.
- **Kunci akurasi kalkulasi**: `exsum.md` menunjukkan kecocokan finansial tinggi; pertahankan dengan regresi test berbasis fixture (input→output).
- **Pisahkan “domain” dari “delivery”**: engine kalkulasi dan rule conclusion harus jadi modul murni (testable), terlepas dari Express/Next/UI.
- **UX seperti AWS Pricing Calculator**: PRD jelas meniru UX AWS Calculator: transparansi, versioning, save snapshot, breakdown, export.

---

## Fase 0 — Perbaikan cepat (1–2 hari) ✅ Paling mudah

### Fungsionalitas
- **Standarisasi validasi input** di frontend + backend (durasi 1–120 integer, angka non-negatif, required fields).  
  Output: error message konsisten, tidak ada kalkulasi dengan data kosong/invalid.
- **Perbaiki mode offline**: tampilkan banner yang jelas “Offline mode (localStorage)” + tombol “Coba konek ulang” + indikator status API yang stabil.
- **Hardening login**:
  - disable submit saat loading
  - rate limit minimal di backend (per IP/per email) atau delay exponential sederhana
  - pesan error jangan bocorkan detail (“email tidak ditemukan” vs “password salah”)

### Tampilan/UX
- **Rapikan micro-layout login** (sudah banyak perbaikan): konsistensi tipografi, alignment, spacing, dan responsif mobile.
- **Aksesibilitas minimum**: fokus ring jelas, label input yang bisa dibaca screen reader, kontras warna error/success.

---

## Fase 1 — UX inti proyek & kualitas data (3–7 hari)

### Fungsionalitas
- **Wizard 6 langkah (PRD: CRITICAL)** walau masih di static JS:
  - Step 1: info dasar (project/customer/contract/PIC)
  - Step 2: durasi + override asumsi (WACC/inflasi/BCR)
  - Step 3: CAPEX multi-item + multi-periode
  - Step 4: OPEX (baseline + start/end + inflasi)
  - Step 5: Revenue (recurring + escalation + OTC)
  - Step 6: review + simpan
- **Draft guardrail**: edit konfigurasi hanya untuk status `DRAFT`/`COMPUTED`/`REJECTED` dan role `SA`/`FINANCE_ADMIN`/`SUPER_ADMIN` (status lain read-only).
- **Autosave (draft)** per step:
  - indikator dirty “Perubahan belum disimpan”
  - status “Tersimpan HH:MM”
  - fallback draft lokal `localStorage` bila API belum bisa create (Step 1 belum lengkap).
- **Pencarian & filter proyek**: keyword (kode/nama) + filter status + matrix risk (Dampak/Kemungkinan).

### Checklist Fase 1 (Tabel)

<table>
  <thead>
    <tr>
      <th>Item</th>
      <th>Status</th>
      <th>Catatan</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Wizard 6 langkah (Step 1–6)</td>
      <td>✅ Done</td>
      <td>dialog wizard lengkap</td>
    </tr>
    <tr>
      <td>Draft guardrail (editable statuses + roles)</td>
      <td>✅ Done</td>
      <td>edit hanya <code>DRAFT/COMPUTED/REJECTED</code> untuk <code>SA/FINANCE_ADMIN/SUPER_ADMIN</code></td>
    </tr>
    <tr>
      <td>Autosave draft per step + indikator</td>
      <td>✅ Done</td>
      <td>dirty + “Tersimpan HH:MM” + fallback draft lokal</td>
    </tr>
    <tr>
      <td>Search &amp; filter proyek (status + risk)</td>
      <td>✅ Done</td>
      <td>keyword + status + Dampak/Kemungkinan</td>
    </tr>
    <tr>
      <td>Quick actions daftar proyek</td>
      <td>✅ Done</td>
      <td>Detail/Edit/Hitung/Submit/Hapus sesuai status &amp; role</td>
    </tr>
  </tbody>
</table>

### Tampilan/UX
- **Project list**: table dengan status badge, owner, last updated, quick actions (Edit/Calculate/Submit).
- **Project detail**: KPI cards + conclusion badge yang jelas + CTA yang tepat (Calculate/Submit).

---

## Fase 2 — “PRD compliance” menengah: versioning, audit, export (1–3 minggu)

### Fungsionalitas
- **Versioning kalkulasi (snapshot)**:
  - setiap `calculate` menyimpan `input_snapshot` + `result_snapshot`
  - UI “Version history” (bandingkan versi A vs B)
- **Audit trail immutable**:
  - standar event: `PROJECT_CREATED`, `PROJECT_UPDATED`, `CALC_STARTED`, `CALC_DONE`, `SUBMITTED`, `APPROVED_L1`, `APPROVED_FINAL`, `REJECTED`, `EXPORTED`
  - simpan delta yang ringkas (old/new) dan metadata (actor, timestamp, ip/user-agent jika perlu)
- **Export**:
  - **PDF**: minimal “print-ready template” yang konsisten (header, identitas, KPI, cashflow ringkas + lampiran)
  - **Excel `.xlsx`**: sesuai PRD (ExcelJS) atau SheetJS; minimal satu sheet cashflow + satu sheet summary
- **Config assumptions (MVP CMS-lite)**:
  - endpoint + UI sederhana untuk WACC/inflasi/BCR
  - effective date & history

### Tampilan/UX
- **Cashflow table dinamis** (N bulan): virtual scrolling untuk 120 bulan, sticky columns/headers.
- **Charts**: XNPV trend + cumulative cashflow; pastikan tidak “misleading” (label, satuan, tooltip).

---

## Fase 3 — Workflow approval lengkap + notifikasi + SLA (3–6 minggu)

### Fungsionalitas
- **Approval state machine** sesuai PRD: `COMPUTED → SUBMITTED → UNDER_REVIEW → APPROVED_L1 → APPROVED_FINAL` dan reject path.
- **Role-based queue**: halaman “Approvals” untuk Manager & GM/SRM (filter, sort by SLA due).
- **SLA engine**:
  - reminder H-24 / H-12
  - escalation jika lewat SLA
- **Notifikasi**:
  - In-app (bell + unread)
  - Email template (minimal 3–5 event utama)

### Tampilan/UX
- **Approval timeline**: siapa, kapan, komentar (mirip audit trail yang human friendly).
- **Callout risiko**: bila BCR borderline (mis. 1.08–1.23) beri penanda “BERSYARAT” dengan rekomendasi tindakan.

---

## Fase 4 — Arsitektur penuh PRD (Next.js + TS + async jobs + storage) 🧱 Paling sulit (6–12+ minggu)

### Fungsionalitas & Infrastruktur
- **Migrasi frontend ke Next.js 14 + TS** bertahap:
  - mulai dari halaman dashboard & projects
  - pindahkan komponen wizard sebagai modul terpisah
- **Backend modernization (opsional)**:
  - Express → Fastify (sesuai PRD) + schema validation
  - OpenAPI/Swagger sebagai kontrak
- **Async job queue**:
  - Redis + BullMQ + worker untuk kalkulasi & export
  - polling/WS update status job
- **MinIO untuk export artifacts** + presigned URL + retention policy.
- **Observability & security hardening**:
  - structured logging
  - health endpoint & basic metrics
  - JWT key management (RS256), rotation plan, session TTL, audit retention

### Tampilan/UX
- **Design system** (shadcn/ui atau setara): konsistensi form/table/modal/badge, dark mode optional.
- **Executive dashboard**: portfolio KPI + heatmap + drill-down; performance (p95 API ≤ 200ms) sesuai PRD.

---

## Rekomendasi Prioritas (Jika harus memilih 5 hal duluan)

1. **Wizard 6 langkah + validasi kuat** (mengurangi error input dan mempercepat adopsi).
2. **Versioning kalkulasi + audit trail** (nilai enterprise: traceable, bisa diaudit).
3. **Export PDF & Excel `.xlsx`** (kebutuhan nyata untuk stakeholder & dokumentasi).
4. **Approval queue + SLA reminder** (menghilangkan approval via email manual).
5. **Refactor engine jadi modul testable + regression tests** (agar perubahan UI/fitur tidak merusak akurasi finansial).

---

## Catatan UI spesifik (Login & Branding)

- Login sekarang sudah modern; untuk konsistensi keseluruhan aplikasi, sebaiknya:
  - gunakan token warna/typography yang sama untuk komponen utama (button, input, badge status)
  - pastikan semua badge/status punya kontras yang memadai (AA minimal)
  - hindari teks “Internal Use Only” mengganggu konten—posisi pojok kanan bawah sudah tepat.

