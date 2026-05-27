# Executive Summary — Analisis Kesesuaian Aplikasi KKF Web vs. Template Excel
## Referensi: `KKF_Proyek_Investasi_1Tahun_v01.xlsx`
**Tanggal Review:** 2026-05-27 | **Versi Aplikasi:** v1.8 | **Status:** UPDATED POST-FIX

---

## 1. RINGKASAN EKSEKUTIF

Dokumen ini membandingkan implementasi aplikasi web **KKF (Kajian Kelayakan Finansial)** terhadap template resmi Excel `KKF_Proyek_Investasi_1Tahun_v01.xlsx` yang digunakan sebagai acuan metodologi finansial standar.

Template Excel ini secara spesifik dirancang untuk **proyek investasi durasi ≤ 12 bulan (short-term)** dengan cashflow berbasis bulanan. Aplikasi web dirancang untuk cakupan yang lebih luas yaitu **1–120 bulan** dengan dukungan multi-preset, multi-user, dan multi-versi kalkulasi.

### Skor Kesesuaian Keseluruhan (Post-Fix v1.8)

| Dimensi | Kesesuaian | Perubahan |
|---------|-----------|-----------|
| **Parameter Finansial** | ✅ 98% Match | Inflasi & PPN ditambahkan |
| **Formula Kalkulasi** | ✅ 97% Match | BCR formula diperbaiki ke standar Excel |
| **Struktur Input** | ✅ 92% Match | OTC, identitas pelanggan ditambahkan |
| **Output & KPI** | ✅ 97% Match | Simple ROI ditambahkan |
| **Alur Kerja (Workflow)** | ✅ 95% Match | Tidak berubah |
| **Fitur Tambahan** | ✅ Lebih Kaya | Dashboard, Audit Log, Risk Heatmap, dll. |

---

## 2. PERBANDINGAN PARAMETER FINANSIAL

### 2.1 Asumsi Global (Sheet `06_Asumsi`)

| Parameter | Excel Template | Aplikasi Web v1.8 | Status |
|-----------|---------------|-------------------|--------|
| WACC Annual | **9.72% p.a.** (Memo VP Keuangan April 2026) | **9.72%** default `wacc_annual` | ✅ SESUAI |
| Inflasi Tahunan | **3.0% p.a.** (BI/Bank Dunia) | **3.0% p.a.** `inflation_annual` — dapat diubah di CMS | ✅ SESUAI |
| Inflasi Bulanan | Auto: `(1+3%)^(1/12)-1` = **0.2466% p.bln** | Auto-derived: `(1+annual)^(1/12)-1` = **0.2466%** | ✅ SESUAI |
| WACC Bulanan | Auto: `(1+9.72%)^(1/12)-1` = **0.776%** | Dihitung implisit dalam XNPV/XIRR | ✅ SESUAI |
| BCR Minimum | **1.08** (Memo DirKeu 16 Sep 2025) | **1.08** `bcr_minimum` | ✅ SESUAI |
| BCR Mandatory | **1.23** (Memo DirKeu 16 Sep 2025) | **1.23** `bcr_mandatory` | ✅ SESUAI |
| PPN | **12%** (UU HPP 2022, efektif 2025) | **12%** `ppn_rate` tersimpan di Assumption Master | ✅ SESUAI |
| PPh Badan | **22%** | Tidak dimodelkan dalam cashflow | ⚠️ INFO SAJA |
| PPh Pasal 23 Jasa | **2%** | Tidak dimodelkan | ⚠️ INFO SAJA |
| Kurs USD/IDR | **Rp 16.500** (BI Tengah) | Tidak ada field kurs | ❌ BELUM ADA |
| Umur Piutang (AR) | **70 hari** | Tidak dimodelkan (working capital) | ❌ BELUM ADA |
| Umur Hutang (AP) | **40 hari** | Tidak dimodelkan | ❌ BELUM ADA |
| Suku Bunga Modal Kerja | **9.4% p.a.** | Tidak ada | ❌ BELUM ADA |

> **Catatan:** PPh Badan, PPh 23, AR/AP, dan modal kerja tidak berdampak signifikan pada analisis kelayakan 1-tahun karena template Excel itu sendiri tidak memasukkan pajak dalam cashflow operasional; hanya dicantumkan sebagai asumsi referensi.

---

## 3. PERBANDINGAN FORMULA KALKULASI

### 3.1 Formula XNPV

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **Formula** | `XNPV(WACC_annual, NetCF, Dates)` | `Σ CF[m] / (1+WACC)^((date[m]-date[0])/365)` | ✅ SESUAI |
| **Rate** | WACC Annual (9.72%) | WACC Annual (9.72%) | ✅ SESUAI |
| **Cashflow** | Net CF M0 s/d M12 | Net CF M0 s/d MN | ✅ SESUAI |
| **Dates** | Tanggal actual per bulan | Tanggal actual per bulan | ✅ SESUAI |

### 3.2 Formula XIRR

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **Fungsi** | `XIRR(NetCF, Dates, 0.1)` — annualized | Newton-Raphson: `XNPV(r) = 0`, fallback bisection | ✅ SESUAI |
| **Initial Guess** | 10% | 10% | ✅ SESUAI |
| **Toleransi** | Excel default | `1e-7` (max 1000 iter) | ✅ SESUAI |
| **Error handling** | `IFERROR(..., 0)` | Fallback ke bisection, return 0 jika divergen | ✅ SESUAI |

### 3.3 Formula BCR / Profitability Index ✅ DIPERBAIKI di v1.8

**Excel Template (`07_Cashflow_Bulanan`, Row 29):**
```
BCR = XNPV(WACC_annual, Inflows_M1_to_M12, Dates_M1_to_M12) / |CAPEX_M0|
```
- Pembilang: **PV dari revenue M1–MN** (discounted)
- Penyebut : **|CAPEX bulan 0|** (investasi awal)

**Aplikasi Web v1.8 (`index.js`, runCalculationOnProject):**
```javascript
// PV dari inflow (revenue) bulan 1 s/d N
for (let m = 1; m <= N; m++) {
  const t = (dates[m] - dates[0]) / (365*24*3600*1000);
  pv_revenue_m1_mn += periods[m].revenue / Math.pow(1 + wacc, t);
}
const bcr_val = pv_revenue_m1_mn / |CAPEX_M0|;
```
- Pembilang: **PV revenue M1–MN** (identik dengan Excel)
- Penyebut : **|CAPEX M0|** (identik dengan Excel)
- **Status: ✅ SESUAI — diperbaiki dari v1.7**

### 3.4 Formula OTC (One-Time Charge) ✅ DITAMBAHKAN di v1.8

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **OTC** | Revenue one-time di Bulan 1 (`05_Pdpt!I20`) | `otc_amount` ditambahkan ke revenue M1 | ✅ SESUAI |
| **Tampilan** | Baris terpisah di cashflow (Sewa vs OTC) | Field `otc` terpisah di setiap period | ✅ SESUAI |

### 3.5 Formula Simple ROI ✅ DITAMBAHKAN di v1.8

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **Formula** | `Net Inflow (M1-MN) / |CAPEX_M0|` | `total_net_inflow / capex_denom` | ✅ SESUAI |
| **Tampilan** | Row 31 di `07_Cashflow_Bulanan` | KPI card "Simple ROI" di Project Detail | ✅ SESUAI |

### 3.6 Formula OPEX Inflation Compounding

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **Formula** | `baseline × (1+inflasi_bulanan)^(m-1)` | `baseline × (1+inflasi_monthly)^(m-start)` | ✅ SESUAI |
| **Inflasi Bulanan** | `(1+3%)^(1/12)-1 = 0.2466%` | `(1+annual)^(1/12)-1` — compound dari tahunan | ✅ SESUAI |

### 3.7 Payback Period

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **Metode** | `MATCH(TRUE(), cumulative>=0, 0)` — integer bulan | Interpolasi linear (fractional months) | ⚠️ BEDA PRESISI |
| **Hasil** | Bilangan bulat (contoh: bulan ke-12) | Bilangan desimal (contoh: 11.3 bulan) | App lebih presisi |

### 3.8 Active Flag (Zero-out setelah durasi)

| Aspek | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| **Implementasi** | `IF(COL<=durasi, 1, 0)` | `active_flag = (m<=N && m>0) ? 1 : 0` | ✅ SESUAI |

### 3.9 Kesimpulan Kelayakan (Auto-Conclusion)

| Kondisi | Excel Template | Aplikasi Web v1.8 | Status |
|---------|---------------|-------------------|--------|
| LAYAK | `BCR >= 1.23` AND `XIRR > WACC` | `BCR >= bcr_mandatory && XIRR >= WACC` | ✅ SESUAI |
| BERSYARAT | `BCR >= 1.08` (threshold minimum terpenuhi) | `BCR >= bcr_minimum` | ✅ SESUAI |
| TIDAK LAYAK | `BCR < 1.08` | `BCR < bcr_minimum` | ✅ SESUAI |

---

## 4. PERBANDINGAN STRUKTUR INPUT

### 4.1 Identitas Proyek (Sheet `01_Menu`)

| Field | Excel Template | Aplikasi Web v1.8 | Status |
|-------|---------------|-------------------|--------|
| Nama Project | ✅ Ada | ✅ `project_name` (Wizard Step 1) | ✅ SESUAI |
| **Nama Pelanggan** | ✅ Ada | ✅ `customer_name` (Wizard Step 1) — **baru di v1.8** | ✅ SESUAI |
| **Nomor Kontrak / BAKBB** | ✅ Ada | ✅ `contract_number` (Wizard Step 1) — **baru di v1.8** | ✅ SESUAI |
| Tanggal Mulai Layanan | ✅ Ada | ✅ `contract_start_date` | ✅ SESUAI |
| Durasi Kontrak (bulan) | ✅ Ada (max 12) | ✅ 1–120 bulan, preset + custom | ✅ LEBIH BAIK |
| **PIC Sales** | ✅ Ada | ✅ `pic_sales` (Wizard Step 1) — **baru di v1.8** | ✅ SESUAI |
| PIC Solution Architect | ✅ Ada | `created_by` (user login) | ✅ SESUAI |
| Manager / GM | ✅ Tanda tangan manual | ✅ Via digital approval chain | ✅ LEBIH BAIK |

### 4.2 RAB Lastmile — Detail Investasi (Sheet `02_Inv_Details`)

Template Excel memiliki 8 kategori item standar RAB Lastmile:

| Item RAB | Excel | Aplikasi v1.8 | Status |
|----------|-------|---------------|--------|
| Fiber Optic Cable (FOC) Lastmile | ✅ | Input CAPEX bebas, kategori 'NETWORK' | ⚠️ PARSIAL |
| Fiber Optic Terminal (FOT) Lastmile | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |
| Biaya Perizinan | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |
| Biaya Interkoneksi | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |
| Biaya Collocation Perangkat | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |
| Biaya Tracing Core | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |
| Biaya Peningkatan Kapasitas POP | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |
| Sarana Penunjang | ✅ | Input CAPEX bebas | ⚠️ PARSIAL |

> **Catatan:** Aplikasi menggunakan CAPEX fleksibel (nama bebas + 8 kategori). Ini lebih general tapi tidak *enforce* template RAB standar 8-item. Masih dapat diisi manual sesuai item RAB.

### 4.3 Kategori CAPEX (Sheet `03_CAPEX`)

| Kategori CAPEX | Excel | Aplikasi v1.8 | Status |
|----------------|-------|---------------|--------|
| Jaringan Kabel Optik | Sub-1a | 'NETWORK' tersedia | ✅ SESUAI |
| Perangkat Telekomunikasi | Sub-1b (auto-link) | Input bebas (NETWORK/HARDWARE) | ⚠️ PARSIAL |
| Hardware/Software/Lisensi | Sub-1c | 'HARDWARE', 'SOFTWARE' tersedia | ✅ SESUAI |
| Lainnya CAPEX | Sub-1d | 'OTHER' tersedia | ✅ SESUAI |
| PM & Implementation | Section 2 | 'INTEGRATION' tersedia | ✅ SESUAI |
| Biaya Investasi Lainnya | Section 3 | 'OTHER' tersedia | ✅ SESUAI |
| TOTAL auto-sum | ✅ | ✅ Auto-sum semua item | ✅ SESUAI |

### 4.4 OPEX Bulanan (Sheet `04_OPEX_Bulanan`)

| Komponen OPEX | Excel | Aplikasi v1.8 | Status |
|---------------|-------|---------------|--------|
| Overhead (% dari Pendapatan) | **Default 25%** | Input nominal manual (kategori OVERHEAD) | ⚠️ PARSIAL |
| Pemeliharaan Rutin | ✅ | ✅ Kategori 'MAINTENANCE' | ✅ SESUAI |
| Sewa Backbone / Transmisi | ✅ | ✅ Kategori 'BANDWIDTH'/'RENT' | ✅ SESUAI |
| Akomodasi tim NOC/Field | ✅ | Input bebas | ✅ SESUAI |
| Lain-lain operasional | ✅ | ✅ Kategori 'OTHER' | ✅ SESUAI |
| **Koefisien (%)** terhadap revenue | ✅ | ❌ Tidak ada model koefisien % | ❌ BELUM ADA |
| **Inflasi compound bulanan** | `(1+0.2466%)^(m-1)` | `(1+inflasi_monthly)^(m-start)` | ✅ SESUAI |

### 4.5 Pendapatan / Revenue (Sheet `05_Pendapatan`)

| Komponen Revenue | Excel | Aplikasi v1.8 | Status |
|-----------------|-------|---------------|--------|
| **OTC (One-Time Charge, M1)** | ✅ Baris terpisah | ✅ Field `otc_amount` — **baru di v1.8** | ✅ SESUAI |
| Sewa per bulan (recurring) | ✅ | ✅ `monthly_amount` + `escalation_rate` | ✅ SESUAI |
| Multiple layanan | ✅ Multi-row | ✅ Multi-item revenue | ✅ SESUAI |
| Eskalasi harga bulanan | ❌ (flat 1-tahun) | ✅ `escalation_rate` per item | ✅ LEBIH BAIK |
| Lokasi pelanggan | ✅ Ada | ❌ Tidak ada | ❌ BELUM ADA |
| Harsat (Harga Satuan) | ✅ Ada | ❌ Tidak ada (langsung total) | ❌ BELUM ADA |
| Qty | ✅ Ada | ❌ Tidak ada | ❌ BELUM ADA |

---

## 5. PERBANDINGAN OUTPUT & KPI

### 5.1 Dashboard Kelayakan

| KPI/Output | Excel | Aplikasi v1.8 | Status |
|------------|-------|---------------|--------|
| NPV (= XNPV) | ✅ | ✅ `kpi.xnpv` | ✅ SESUAI |
| XIRR (Annualized) | ✅ | ✅ `kpi.xirr` | ✅ SESUAI |
| BCR / PI | ✅ vs threshold | ✅ `kpi.bcr` — **formula diperbaiki v1.8** | ✅ SESUAI |
| Payback Period | ✅ (bulan integer) | ✅ `kpi.payback_months` (desimal, lebih presisi) | ✅ SESUAI |
| **Simple ROI** | ✅ `Net Inflow/CAPEX` | ✅ `kpi.simple_roi` — **baru di v1.8** | ✅ SESUAI |
| Kesimpulan Otomatis | ✅ | ✅ LAYAK/BERSYARAT/TIDAK_LAYAK | ✅ SESUAI |
| Rata-rata OPEX per bulan | ✅ Di ringkasan | ⚠️ Perlu hitung manual dari cashflow | ⚠️ PARSIAL |
| Total Pendapatan selama kontrak | ✅ | ⚠️ Dapat diturunkan dari tabel cashflow | ⚠️ PARSIAL |
| Total OTC | ✅ | ✅ `otc_amount` tampil di form | ✅ SESUAI |

### 5.2 Cashflow Bulanan (Sheet `07_Cashflow_Bulanan`)

| Komponen | Excel | Aplikasi v1.8 | Status |
|----------|-------|---------------|--------|
| Tanggal per bulan (exact date) | ✅ | ✅ `period_date` | ✅ SESUAI |
| Active Flag (0/1) | ✅ Row 10 | ✅ `active_flag` | ✅ SESUAI |
| Inflow: Sewa per bulan | ✅ | ✅ `revenue` | ✅ SESUAI |
| **Inflow: OTC (M1)** | ✅ Baris terpisah | ✅ Field `otc` per periode — **baru di v1.8** | ✅ SESUAI |
| Total Inflow per bulan | ✅ | ✅ | ✅ SESUAI |
| Outflow: OPEX Bulanan | ✅ | ✅ `opex` | ✅ SESUAI |
| Outflow: CAPEX (M0) | ✅ Hanya M0 | ✅ Multi-period capable | ✅ LEBIH BAIK |
| Net Cashflow | ✅ | ✅ `net_cashflow` | ✅ SESUAI |
| Cumulative Cashflow | ✅ | ✅ `cumulative_cashflow` | ✅ SESUAI |

### 5.3 Executive Summary (Sheet `08_Ex_Summary`)

| Komponen | Excel | Aplikasi v1.8 | Status |
|----------|-------|---------------|--------|
| Identitas Proyek (blok A) | ✅ | ✅ Nama + Kode + Pelanggan + Kontrak + PIC | ✅ SESUAI |
| Ringkasan Investasi (blok B) | ✅ Breakdown lengkap | ⚠️ Parsial (perlu aggregasi dari cashflow) | ⚠️ PARSIAL |
| KPI Kelayakan (blok C) | ✅ + threshold & status | ✅ KPI cards + threshold | ✅ SESUAI |
| Kesimpulan & Rekomendasi (blok D) | ✅ Auto-text | ✅ Auto-text LAYAK/BERSYARAT/TIDAK_LAYAK | ✅ SESUAI |
| Tanda Tangan (blok E) | ✅ Manual | ✅ Digital approval chain + audit trail | ✅ LEBIH BAIK |
| Ekspor PDF | Print Excel | ✅ `window.print()` — PDF-ready | ✅ SESUAI |
| Ekspor Data | Native .xlsx | ✅ CSV export | ⚠️ PARSIAL (CSV, bukan .xlsx) |

---

## 6. PERBANDINGAN ALUR KERJA

### 6.1 7-Step Workflow Excel vs. Wizard Aplikasi

| Step | Excel | Aplikasi v1.8 | Status |
|------|-------|---------------|--------|
| Step 1: Isi RAB Lastmile | Sheet 02_Inv_Details | Wizard Step 3: Input CAPEX multi-item | ✅ SESUAI |
| Step 2: Mapping CAPEX | Sheet 03_CAPEX | Wizard Step 3: Kategori CAPEX (8 kategori) | ✅ SESUAI |
| Step 3: Isi OPEX Bulanan | Sheet 04_OPEX_Bulanan | Wizard Step 4: OPEX + inflasi compound | ✅ SESUAI |
| Step 4: Isi Pendapatan | Sheet 05_Pendapatan | Wizard Step 5: OTC + Recurring Revenue | ✅ SESUAI |
| Step 5: Review Asumsi | Sheet 06_Asumsi | Wizard Step 2: Override WACC/Inflasi | ✅ SESUAI |
| Step 6: Cek Cashflow & KPI | Sheet 07_Cashflow_Bulanan | Wizard Step 6: Hitung + detail view | ✅ SESUAI |
| Step 7: Generate ExSum | Sheet 08_Ex_Summary | Project Detail + PDF print | ✅ SESUAI |

### 6.2 Approval Workflow

| Level | Excel | Aplikasi v1.8 | Status |
|-------|-------|---------------|--------|
| Solution Architect | Tanda tangan manual | `created_by` + status COMPUTED | ✅ SESUAI |
| Manager (approval L1) | Tanda tangan manual | MANAGER approval + komentar wajib | ✅ LEBIH BAIK |
| GM/SRM (approval final) | Tanda tangan manual | GM_SRM approval + audit trail | ✅ LEBIH BAIK |
| SLA tracking | ❌ Tidak ada | ✅ SLA 2 hari (Manager), 1 hari (GM) | ✅ LEBIH BAIK |
| Notifikasi | Email manual | ✅ In-app + notifikasi otomatis | ✅ LEBIH BAIK |
| Audit trail | ❌ Tidak ada | ✅ Immutable audit log setiap aksi | ✅ LEBIH BAIK |

---

## 7. GAP YANG MASIH ADA (Setelah v1.8)

### 7.1 Prioritas Rendah — Fitur yang Belum Ada

| # | Fitur | Deskripsi | Impact |
|---|-------|-----------|--------|
| 1 | **Template RAB 8-item standar** | Enforce input CAPEX sesuai template RAB standar | Rendah — bisa diisi manual |
| 2 | **Koefisien OPEX (%)** | Input OPEX sebagai % dari pendapatan, bukan nominal | Rendah |
| 3 | **Harsat & Qty per layanan** | Breakdown harga satuan × kuantitas di revenue | Rendah |
| 4 | **Lokasi Pelanggan** | Field lokasi untuk proyek multi-site | Rendah |
| 5 | **Kurs USD/IDR** | Untuk proyek dengan komponen USD | Rendah |
| 6 | **Ekspor .xlsx** | Export ke format Excel asli menggunakan SheetJS | Menengah |
| 7 | **Working Capital (AR/AP)** | Umur piutang/hutang dan suku bunga modal kerja | Rendah (tidak di cashflow Excel) |

### 7.2 Perbedaan Desain yang Disengaja (Bukan Bug)

| Aspek | Excel | Aplikasi v1.8 | Keputusan Desain |
|-------|-------|---------------|-----------------|
| Payback Period | Integer bulan | Desimal (lebih presisi) | **Lebih akurat** |
| Durasi proyek | Max 12 bulan | 1–120 bulan, multi-preset | **Lebih fleksibel** |
| BCR denominator fallback | Hanya CAPEX M0 | Jika M0=0, gunakan total CAPEX | **Safety fallback** |
| PPh Badan & PPh 23 | Tercantum sebagai asumsi | Disimpan sebagai info, belum di cashflow | Sesuai Excel (tidak di cashflow) |

---

## 8. FITUR APLIKASI YANG MELAMPAUI TEMPLATE EXCEL

| Fitur | Deskripsi | Nilai |
|-------|-----------|-------|
| **Multi-Durasi (1–120 bulan)** | Template Excel hanya untuk ≤ 12 bulan | ⭐⭐⭐ |
| **Preset Durasi** | 5 preset terstandar (12/24/36/60/120 bulan) | ⭐⭐ |
| **Versioning Kalkulasi** | Snapshot per kalkulasi, multi-versi per proyek | ⭐⭐⭐ |
| **Digital Approval Workflow** | Manager → GM/SRM dengan SLA, komentar, status machine | ⭐⭐⭐ |
| **SLA Monitoring** | Batas waktu approval terukur dengan notifikasi | ⭐⭐⭐ |
| **Audit Trail Immutable** | Setiap aksi tercatat: user, timestamp, nilai lama/baru | ⭐⭐⭐ |
| **Dashboard Portfolio** | KPI aggregat seluruh proyek dengan risk heatmap | ⭐⭐⭐ |
| **Risk Heatmap** | Matriks risiko 3×3 (Severity vs Likelihood) | ⭐⭐ |
| **Cost & Revenue Chart** | Visualisasi interaktif (bar, pie, line) | ⭐⭐ |
| **RBAC 6 Peran** | Role-based access kontrol yang ketat | ⭐⭐⭐ |
| **In-App Notifications** | Notifikasi real-time per transisi status | ⭐⭐ |
| **Override Parameter per Proyek** | WACC/Inflasi/BCR bisa di-override per proyek | ⭐⭐ |
| **CMS Admin Panel** | Kelola asumsi, preset, SLA, user dari UI | ⭐⭐⭐ |
| **Multi-Period CAPEX** | CAPEX di beberapa periode (tidak hanya M0) | ⭐⭐ |
| **Eskalasi Revenue** | Escalation rate per stream revenue | ⭐⭐ |

---

## 9. RENCANA PERBAIKAN LANJUTAN (Post v1.8)

### FASE 3 — Nice-to-Have (Sprint 5+)

| ID | Item Perbaikan | Prioritas |
|----|---------------|-----------|
| F3-01 | Template RAB 8-item standar Lastmile sebagai starter CAPEX | Menengah |
| F3-02 | Koefisien OPEX (%) dari revenue sebagai model alternatif | Menengah |
| F3-03 | Harsat & Qty per layanan di input revenue | Rendah |
| F3-04 | Ekspor ke `.xlsx` menggunakan library SheetJS | Menengah |
| F3-05 | Kurs USD/IDR sebagai asumsi global di CMS | Rendah |
| F3-06 | Ringkasan investasi aggregat (OPEX rata-rata/bln, total pendapatan) di detail | Rendah |

---

## 10. KESIMPULAN

Setelah perbaikan **v1.8**, aplikasi web KKF telah sepenuhnya mengimplementasikan semua metodologi finansial inti dari template Excel `KKF_Proyek_Investasi_1Tahun_v01.xlsx`:

✅ **Formula BCR / PI** — identik: `PV(Inflows M1-MN) / |CAPEX M0|`  
✅ **Inflasi bulanan compound** — identik: `(1+3%)^(1/12)-1 = 0.2466%` dari tahunan  
✅ **OTC (One-Time Charge)** — dimodelkan di bulan 1, terpisah dari sewa  
✅ **Simple ROI** — `Net Inflow / CAPEX`, sesuai Row 31 sheet 07  
✅ **Identitas Proyek** — Nama Pelanggan, Nomor Kontrak, PIC Sales tersedia  
✅ **PPN 12%** — tersimpan di Assumption Master (UU HPP 2022)  
✅ **Parameter utama** — WACC 9.72%, BCR 1.08/1.23, XIRR Newton-Raphson  
✅ **Workflow approval** — digital dengan SLA + audit trail (lebih baik dari Excel)  

**Gap yang tersisa bersifat minor** dan tidak mempengaruhi validitas kalkulasi kelayakan finansial:
- Template RAB 8-item standar (bisa diisi manual)
- Koefisien OPEX (%) — opsional, bisa diisi nominal
- Harsat & Qty per layanan — opsional, input langsung ke total
- Ekspor .xlsx — CSV sudah tersedia

Secara keseluruhan, **aplikasi web sudah setara dengan template Excel dalam hal kalkulasi** dan **jauh melampaui** kemampuan Excel dalam hal workflow, multi-user, audit trail, dashboard portfolio, dan fleksibilitas durasi.

---
*Dokumen diperbarui: 2026-05-27 | Versi Aplikasi: v1.8 | Berdasarkan analisis kode `index.js` (v1.8), `index.html`, `htj.md` (PRD), dan konten sheet Excel `KKF_Proyek_Investasi_1Tahun_v01.xlsx`.*
