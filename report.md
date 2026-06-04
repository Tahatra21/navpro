# Laporan Kesesuaian Feedback vs Aplikasi NAVPRO (Berjalan Saat Ini)

**Tanggal penilaian:** 2026-06-02  
**Acuan kode:** branch `main` (Next.js frontend + Express backend + engine `calculationEngine.js`)  
**Metode:** Review wizard proyek, engine kalkulasi, halaman detail/KPI, dan konfigurasi admin.

**Versi HTML:** [docs/report.html](docs/report.html) — buka di browser untuk tampilan lengkap dengan navigasi.

---

## Ringkasan eksekutif

| No | Uraian feedback | Status | Ringkas |
|----|-----------------|--------|---------|
| 1 | Auto-generate field override finansial | **Selesai (P1)** | Pre-fill Asumsi Master + toggle override di Langkah 2 wizard |
| 2 | Durasi layanan > 12 bulan | **Sesuai** | Preset & custom 1–120 bulan |
| 3 | Revenue tahun ke-1 vs ke-2 berbeda (langganan) | **Selesai (P2)** | Mode `step_yearly` + field Y1/Y2 + preview per tahun di wizard |
| 4 | OPEX: dropdown layanan/produk Icon+ | **Selesai (P3)** | Katalog `opex_service_catalog` + dropdown searchable + auto-fill |
| 5 | Menu Revenue sebagai output kalkulator | **Selesai (P2)** | Langkah 5: kalkulator tarif → preview read-only → Terapkan ke proyek |
| 6 | Output NPV, IRR, BCR, Payback, Layak | **Sesuai (P1 label)** | Ringkasan akhir + label NPV (XNPV) / IRR (XIRR) |

**Kesimpulan:** Enam poin feedback sudah **terimplementasi di UX dan engine** (P1–P3). Laporan HTML per baris feedback diselaraskan dengan status terkini; refresh `docs/report.html` di browser jika masih melihat badge lama.

---

## 1. Form override finansial di-generate otomatis

### Permintaan feedback

Field berikut diharapkan **ter-generate otomatis** karena nilainya jarang berubah:

- Nilai override WACC Tahunan (%)
- BCR Minimum
- Override Inflasi Bulanan (%)
- Override BCR Mandatory
- Kurs USD (IDR)

### Kondisi aplikasi saat ini

| Aspek | Implementasi |
|-------|----------------|
| Sumber nilai global | `assumptions_master` (Admin → Asumsi Master), dibaca wizard lewat API config |
| UI Wizard Langkah 2 | Field terisi otomatis dari master (read-only default); badge “Dari Asumsi Master” |
| Toggle override | Checkbox “Ubah parameter untuk proyek ini” — override hanya dikirim jika aktif |
| Auto-fill saat buka form | **Ada** — via `global-assumptions.ts` + `assumptionFieldsForWizard` |
| Engine | Fallback ke global jika override tidak ada di payload |

**Bukti kode:** `frontend/src/lib/global-assumptions.ts`, `ProjectWizard.tsx` Langkah 2, `calculationEngine.js`

### Penilaian: **Selesai (P1)**

- Form menampilkan nilai master terisi; user tidak perlu mengetik ulang WACC, inflasi, kurs, BCR.
- Override per proyek opsional lewat toggle.

### Implementasi (P1)

1. Pre-fill dari `globalAssumptions` (read-only + toggle).
2. Badge “Dari Asumsi Master” + tanggal efektif.
3. Override hanya aktif jika checkbox di centang.

---

## 2. Fitur durasi layanan > 12 bulan

### Permintaan feedback

Tersedia perhitungan untuk durasi layanan **lebih dari 12 bulan**.

### Kondisi aplikasi saat ini

| Fitur | Status |
|-------|--------|
| Preset durasi | 12, 24, 36, 60, 120 bulan (dari `duration_presets` atau fallback di UI) |
| Custom | Input numerik **1–120 bulan** |
| Kategori durasi | `SHORT_TERM` / `MID_TERM` / `LONG_TERM` / `EXTENDED` (derivasi dari jumlah bulan) |
| Cashflow | Dibangun untuk `project_duration_months` = N (bulan 0..N) |

**Bukti kode:** `ProjectWizard.tsx` Langkah 2; `backend/src/seed.js` preset durasi; `calculationEngine.js` loop `m = 0..N`.

### Penilaian: **Sesuai**

Durasi > 12 bulan sudah didukung penuh hingga 120 bulan (10 tahun).

---

## 3. Revenue tahun ke-1 dan tahun ke-2 berlangganan berbeda

### Permintaan feedback

Jika kondisi revenue **tahun pertama** dan **tahun kedua** berlangganan **berbeda nilai**, aplikasi harus mendukungnya.

### Kondisi aplikasi saat ini

| Mekanisme | Ada? | Keterangan |
|-----------|------|------------|
| Field “Harga Tahun 1” / “Harga Tahun 2” | ❌ | Tidak ada di model data |
| Eskalasi bulanan per baris revenue | ✅ | `escalation_rate` — compound per bulan dalam rentang `start_period`–`end_period` |
| Beberapa baris revenue dengan harsat berbeda | ✅ | Bisa menambah 2+ baris dengan periode berbeda (workaround manual) |
| Tarif langganan step-change otomatis di bulan 13 | ❌ | Tidak ada flag “reset tarif di awal tahun 2” |

**Contoh workaround saat ini:**  
Baris A: harsat Rp X, periode bulan 1–12. Baris B: harsat Rp Y, periode bulan 13–N.  
Ini **bukan** UX khusus “tahun ke-1 vs ke-2”, dan mudah salah input.

**Bukti kode:** `calculationEngine.js` baris 160–170 (satu `harsat` × eskalasi dalam rentang periode).

### Penilaian: **Belum / Parsial**

- **Parsial:** secara teknis bisa dimodelkan dengan multi-baris + periode.
- **Belum:** tidak ada fitur dedicated, validasi, atau template untuk skenario langganan Y1 ≠ Y2.

### Rekomendasi

1. Tambah mode revenue: **Flat** | **Eskalasi %** | **Step tahunan (Y1/Y2/…)**.
2. Field `harsat_year_1`, `harsat_year_2` (atau array per tahun) dengan auto-split periode 12 bulan.
3. Tampilkan preview tabel revenue per tahun di wizard.

---

## 4. OPEX: dropdown layanan/produk Icon+

### Permintaan feedback

Pada input OPEX diharapkan **dropdown list layanan/produk jaringan Icon+** (katalog terstruktur).

### Kondisi aplikasi saat ini

| Komponen | Implementasi |
|----------|----------------|
| Nama biaya | Input teks bebas (`opexInput.name`) |
| Kategori | `<select>` dari konstanta `OPEX_CATEGORIES`: LABOR, MAINTENANCE, ELECTRICITY, BANDWIDTH, RENT, … |
| Master kategori (Admin) | API `admin/opex-categories` — menambah **kode** kategori, bukan katalog produk Icon+ |
| Ikon / produk / SKU | ❌ Tidak ada |
| Integrasi katalog eksternal | ❌ Tidak ada |

**Bukti kode:** `ProjectWizard.tsx` Langkah 4; `OPEX_CATEGORIES` hardcoded.

### Penilaian: **Belum**

Hanya dropdown kategori operasional generik, bukan katalog layanan/produk Icon+.

### Rekomendasi

1. Master data `opex_service_catalog` (kode, nama, ikon, unit, default % revenue).
2. Dropdown searchable di wizard + auto-fill nominal/default.
3. Sinkron opsional ke sistem billing/Icon+ jika tersedia API.

---

## 5. Menu Revenue sebagai output kalkulator (bukan input)

### Permintaan feedback

**Revenue** sebaiknya menjadi **output** dari kalkulator, bukan halaman input manual.

### Kondisi aplikasi saat ini

| Alur | Peran Revenue |
|------|----------------|
| Wizard Langkah 5 | **Input utama** — user mengisi layanan, harsat, qty, OTC, eskalasi, periode |
| Engine | Menghitung aliran revenue bulanan **dari input** tersebut |
| Output | `cashflow_monthly[].revenue`, KPI, grafik — ini output **turunan**, bukan “menu revenue = hasil kalkulator tarif” |

Tidak ada modul terpisah “Kalkulator Tarif / Kalkulator Sewa” yang menghasilkan baris revenue secara otomatis.

**Bukti kode:** `ProjectWizard.tsx` Langkah 5 judul “Input Aliran Pendapatan”; `buildProjectPayload` memetakan `revenueRows` ke `project.revenue`.

### Penilaian: **Belum**

Alur masih **input-driven**. Permintaan mengarah ke **model driven calculator** (parameter tarif → revenue terisi otomatis).

### Rekomendasi

1. Pisah “Parameter komersial” (paket, bandwidth, SLA, diskon) di langkah kalkulator.
2. Langkah Revenue menjadi **read-only preview** + tombol “Terapkan ke proyek”.
3. Simpan snapshot parameter kalkulator di `project.detail` untuk audit.

---

## 6. Output tambahan di akhir perhitungan

### Permintaan feedback

Output yang diharapkan:

| Output diminta | Di aplikasi | Label UI | Status |
|----------------|-------------|----------|--------|
| NPV | ✅ | **XNPV** | Sesuai (metode discounted, tanggal irregular) |
| IRR | ✅ | **XIRR (p.a.)** | Sesuai |
| BCR | ✅ | **BCR / PI** | Sesuai |
| Payback period (Balik Modal) | ✅ | **Payback** (`payback_months`, desimal bulan) | Sesuai |
| Layak / Tidak layak | ✅ (lebih granular) | **LAYAK**, **BERSYARAT**, **TIDAK LAYAK** (+ internal `MARGINAL`) | Sesuai / diperkaya |

### Aturan kesimpulan (engine)

Proyek **LAYAK** jika (semua terpenuhi):

- XNPV > 0  
- XIRR ≥ WACC  
- BCR ≥ BCR mandatory  
- Payback > 0 dan < durasi proyek  

**BERSYARAT** jika XNPV > 0, XIRR ≥ WACC, BCR ≥ BCR minimum.  
Selain itu → **TIDAK_LAYAK** (atau **MARGINAL** pada kondisi intermediate).

**Bukti kode:**

- `backend/src/services/calculationEngine.js` — `computeProjectKpi`
- `frontend/src/components/projects/KpiCards.tsx`
- `frontend/src/components/projects/ExecutiveSummary.tsx`
- `frontend/src/components/shared/ConclusionBadge.tsx`

### Penilaian: **Sesuai** (dengan catatan label)

Semua metrik diminta **sudah dihitung dan ditampilkan** setelah kalkulasi (tombol Hitung / calculate API).  
Gap kecil:

- Istilah **NPV/IRR** vs **XNPV/XIRR** — perlu keseragaman label untuk user bisnis Indonesia.
- **Layak/Tidak layak** binar vs 3–4 status — bisa ditambah tampilan “simpel” untuk eksekutif.

### Rekomendasi

1. Alias label: “NPV (XNPV)”, “IRR (XIRR)”.
2. Mode tampilan eksekutif: hanya **Layak** / **Tidak Layak** dengan mapping BERSYARAT → Layak bersyarat.
3. Blok ringkasan PDF/export dengan kelima metrik + kesimpulan (sebagian sudah di Executive Summary).

---

## Matriks lokasi fitur di aplikasi

| Area | Path / komponen |
|------|------------------|
| Wizard input | `frontend/src/components/projects/ProjectWizard.tsx` |
| Validasi wizard | `frontend/src/lib/wizard-validate.ts` |
| Payload proyek | `frontend/src/lib/project-mappers.ts` |
| Engine finansial | `backend/src/services/calculationEngine.js` |
| KPI di detail proyek | `KpiCards.tsx`, `ExecutiveSummary.tsx`, `CashflowTable.tsx` |
| Asumsi global | Admin → Asumsi Master; `assumptions_master` |
| Preset durasi | Admin → Duration Presets; `duration_presets` |

---

## Prioritas pengembangan (disarankan)

| Prioritas | Item | Effort relatif | Dampak bisnis |
|-----------|------|----------------|---------------|
| P1 | Pre-fill / auto-generate override Langkah 2 dari asumsi master | Rendah | Tinggi | **Selesai** |
| P1 | Label NPV/IRR + ringkasan akhir eksplisit | Rendah | Tinggi | **Selesai** |
| P2 | Model revenue Tahun 1 / Tahun 2 (step tariff) | Sedang | Tinggi — feedback #3 | **Selesai** |
| P2 | Revenue sebagai output kalkulator tarif | Sedang–tinggi | Tinggi — feedback #5 | **Selesai** |
| P3 | Katalog OPEX Icon+ (dropdown + master) | Sedang–tinggi | Sedang — feedback #4 | **Selesai** |
| — | Durasi > 12 bulan | — | Sudah selesai (#2) |

---

## Lampiran: status per field override (Feedback #1)

| Field feedback | Field di aplikasi | Auto-fill UI | Dipakai jika kosong (engine) |
|----------------|-------------------|--------------|------------------------------|
| WACC Tahunan (%) | `wacc_override` | ❌ | ✅ `wacc_annual` global |
| BCR Minimum | `bcr_minimum_override` → `bcr_threshold_override.minimum` | ❌ | ✅ global |
| Inflasi Bulanan (%) | `inflation_rate_override` | ❌ | ✅ derivasi dari inflasi tahunan global |
| BCR Mandatory | `bcr_mandatory_override` | ❌ | ✅ global |
| Kurs USD (IDR) | `kurs_usd_override` | ❌ | ✅ `kurs_usd` global |

---

*Dokumen ini dapat diperbarui setelah setiap rilis fitur terkait feedback di atas.*
