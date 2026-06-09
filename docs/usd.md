# Auto-Update Kurs USD/IDR — Penjelasan & Rencana Implementasi

Dokumen ini merencanakan fitur **pembaruan otomatis kurs dolar (USD → IDR)** untuk NAVPRO, selaras dengan BRD KKF dan asumsi keuangan perusahaan.

**Status:** Rencana (belum diimplementasi)  
**Referensi:** `docs/exsum.md` §2.1, `docs/PLAN_PENYEMPURNAAN.md` P5-04

---

## 1. Latar belakang

### 1.1 Kebutuhan bisnis

Kajian Kelayakan Finansial (KKF) NAVPRO mengonversi komponen **USD** (CAPEX, OPEX, revenue) ke **IDR** menggunakan kurs asumsi. BRD menetapkan referensi **Kurs USD/IDR = BI Tengah** (contoh seed: **Rp 16.500**).

Saat ini kurs:

- Disimpan di **Asumsi Master** (`assumptions_master.data.kurs_usd`)
- Diedit manual oleh **Finance Admin** lewat halaman Admin
- Dipakai engine perhitungan (`calculationEngine.js`) kecuali proyek punya **override** (`kurs_usd_override`)
- Tercatat di KPI proyek sebagai `kurs_usd_used` (snapshot saat kalkulasi)

**Masalah:** kurs tidak mengikuti pergerakan pasar; admin harus update manual.

### 1.2 Tujuan fitur

1. Mengambil kurs USD/IDR dari sumber resmi/terpercaya secara terjadwal atau on-demand
2. Memperbarui `kurs_usd` di Asumsi Master dengan audit trail
3. **Tidak** mengubah retroaktif proyek yang sudah dihitung (kecuali user recalculate dengan override kosong)
4. Transparansi: tampilkan sumber, waktu update, dan nilai sebelum/sesudah
5. **Historis harian:** simpan **satu baris kurs per hari kalender (WIB)** di database, dan tampilkan di frontend agar **semua user login** dapat melihat pergerakan kurs dari waktu ke waktu

---

## 2. Kondisi sistem saat ini

| Komponen | Lokasi | Peran |
|----------|--------|-------|
| Asumsi global | `assumptions_master` (JSONB `data`) | `kurs_usd`, WACC, inflasi, BCR, dll. |
| Riwayat asumsi | `assumptions_history` | Log perubahan manual CMS |
| API baca asumsi | `GET /api/v1/config/assumptions` | Wizard, dashboard |
| API admin asumsi | `GET/PUT /api/v1/admin/assumptions` | Finance Admin |
| Engine | `backend/src/services/calculationEngine.js` | `kurs_usd` global vs override proyek |
| Frontend master | `frontend/src/lib/global-assumptions.ts` | Pre-fill wizard Langkah 2 |
| Admin UI | `frontend/src/app/(dashboard)/admin/page.tsx` | Panel Asumsi |

**Prioritas kurs di engine:**

```
kurs_usd_override (proyek)  →  jika null  →  assumptions_master.kurs_usd  →  fallback 16500
```

---

## 3. Kebijakan yang harus diputuskan (pre-requisite)

Sebelum coding, Finance / DirKeu perlu konfirmasi:

| # | Keputusan | Opsi | Rekomendasi |
|---|-----------|------|-------------|
| 1 | **Jenis kurs** | BI JISDOR (tengah), spot, kurs internal Icon+ | **BI JISDOR / kurs tengah** (sesuai BRD) |
| 2 | **Frekuensi sync** | Harian, mingguan, manual saja | **Harian 09:00 WIB** (setelah BI publish) |
| 3 | **Trigger manual** | Finance Admin boleh sync sekali | **Ya** — tombol "Sync kurs sekarang" |
| 4 | **Auto vs manual** | Selalu auto / toggle di Admin | **Toggle** `kurs_auto_sync_enabled` |
| 5 | **Batas validasi** | Min/max IDR per USD | Mis. **10.000 – 25.000** (alert jika di luar) |
| 6 | **Perubahan > X%** | Butuh approval jika loncat >5%? | Opsional fase 2 |
| 7 | **Fallback** | Jika API gagal | **Pertahankan kurs terakhir** + notifikasi error |

---

## 4. Arsitektur usulan

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ Sumber eksternal│────▶│ exchangeRateService  │────▶│ assumptions_master  │
│ (BI / provider) │     │ fetch + validate     │     │ data.kurs_usd       │
└─────────────────┘     └──────────┬───────────┘     └─────────────────────┘
                                   │
                    ┌──────────────┼──────────────────────┐
                    ▼              ▼                      ▼
         usd_exchange_rate_daily  exchange_rate_log   assumptions_history
         (1 baris / hari WIB)    (detail setiap sync)   audit_log
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
  GET /config/exchange-rate/history   Halaman /kurs-usd (semua role)
  (semua user login)                  + widget ringkas di Dashboard
         │
         ┌──────────┴──────────┐
         ▼                     ▼
  kursScheduler (cron)    POST /admin/exchange-rate/sync
  (09:00 WIB harian)      (Finance Admin manual)
```

### 4.1 Prinsip desain

- **Single source of truth** tetap `assumptions_master.kurs_usd` — tidak duplikasi di tempat lain
- **Historis harian** (`usd_exchange_rate_daily`) — tabel khusus **satu baris per tanggal (Asia/Jakarta)**; mudah dibaca user dan dipakai grafik/tabel
- **Log detail sync** (`exchange_rate_log`) — setiap percobaan sync (termasuk gagal / unchanged) untuk audit admin
- **Idempotent harian:** beberapa sync dalam hari yang sama → **update baris tanggal itu** (kurs terakhir hari tersebut)
- **Proyek existing:** `kurs_usd_used` di KPI tidak berubah sampai user hitung ulang
- **Akses historis:** baca-only untuk **semua role** yang sudah login (SA, ASMAN, MANAGER, FINANCE_ADMIN, dll.)

---

## 5. Sumber data kurs

### 5.1 Opsi provider

| Provider | Metode | Kelebihan | Kekurangan |
|----------|--------|-----------|------------|
| **Bank Indonesia (JISDOR)** | Scraping/API tidak resmi / data portal BI | Selaras kebijakan BRD | Perlu maintenance parser; cek ToS BI |
| **Frankfurter API** | `GET https://api.frankfurter.app/latest?from=USD&to=IDR` | Gratis, stabil, tanpa API key | Bukan kurs BI resmi |
| **exchangerate.host** | REST gratis | Mudah | Rate limit; bukan BI |
| **Fixer / OXR** | REST berbayar | Historis, SLA | Biaya + API key |

### 5.2 Rekomendasi bertahap

| Fase | Provider | Catatan |
|------|----------|---------|
| **Fase 1 (MVP)** | Frankfurter atau env-configurable URL | Cepat deploy; label sumber jelas di UI |
| **Fase 2** | Parser BI JISDOR | Setelah validasi legal/operasional dengan Keuangan |

Env backend:

```env
EXCHANGE_RATE_PROVIDER=frankfurter   # frankfurter | bi_jisdor | custom
EXCHANGE_RATE_API_URL=               # optional override
EXCHANGE_RATE_AUTO_SYNC=true
EXCHANGE_RATE_SYNC_CRON=0 2 * * *    # 09:00 WIB = 02:00 UTC
EXCHANGE_RATE_MIN=10000
EXCHANGE_RATE_MAX=25000
```

---

## 6. Skema database (baru)

### 6.1 Tabel `usd_exchange_rate_daily` (historis per hari — **utama untuk UI**)

Satu baris per **tanggal kalender WIB**. Semua user melihat data dari tabel ini.

```sql
CREATE TABLE IF NOT EXISTS usd_exchange_rate_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL,                    -- tanggal WIB (Asia/Jakarta)
  currency_from VARCHAR(3) NOT NULL DEFAULT 'USD',
  currency_to VARCHAR(3) NOT NULL DEFAULT 'IDR',
  rate NUMERIC(14, 2) NOT NULL,               -- kurs penutupan / kurs efektif hari itu
  previous_day_rate NUMERIC(14, 2),           -- kurs hari sebelumnya (denormalized untuk UI)
  change_amount NUMERIC(14, 2),               -- rate - previous_day_rate
  change_percent NUMERIC(8, 4),             -- % perubahan vs hari sebelumnya
  source VARCHAR(50) NOT NULL,                -- 'frankfurter', 'bi_jisdor', 'manual'
  sync_mode VARCHAR(20) NOT NULL,             -- 'scheduled', 'manual', 'seed', 'backfill'
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- waktu sync terakhir yang menulis baris ini
  UNIQUE (rate_date, currency_from, currency_to)
);

CREATE INDEX idx_usd_daily_rate_date ON usd_exchange_rate_daily (rate_date DESC);
```

**Aturan penulisan:**

| Event | Perilaku |
|-------|----------|
| Sync pertama hari ini (WIB) | `INSERT` baris `rate_date = today` |
| Sync ulang hari yang sama | `UPDATE` baris yang sama (kurs & `recorded_at` diperbarui) |
| Sync hari baru | `INSERT`; isi `previous_day_rate` dari baris `rate_date - 1` |
| Seed / backfill | Insert baris historis untuk hari-hari lampau (opsional migrasi) |

**Contoh data:**

| rate_date | rate | previous_day_rate | change_amount | change_percent | source |
|-----------|------|-------------------|---------------|----------------|--------|
| 2026-06-07 | 16480 | 16450 | +30 | +0.1824 | frankfurter |
| 2026-06-08 | 16500 | 16480 | +20 | +0.1214 | frankfurter |
| 2026-06-09 | 16520 | 16500 | +20 | +0.1212 | frankfurter |

### 6.2 Tabel `exchange_rate_log` (audit setiap sync)

Log teknis setiap percobaan fetch/sync (termasuk error). **Admin-only** untuk forensik; UI user umum membaca dari `usd_exchange_rate_daily`.

```sql
CREATE TABLE IF NOT EXISTS exchange_rate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_from VARCHAR(3) NOT NULL DEFAULT 'USD',
  currency_to VARCHAR(3) NOT NULL DEFAULT 'IDR',
  rate NUMERIC(14, 2),
  previous_rate NUMERIC(14, 2),
  source VARCHAR(50) NOT NULL,
  sync_mode VARCHAR(20) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rate_date DATE NOT NULL,                   -- tanggal WIB terkait
  applied BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  raw_payload JSONB,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_exchange_rate_log_fetched ON exchange_rate_log (fetched_at DESC);
CREATE INDEX idx_exchange_rate_log_date ON exchange_rate_log (rate_date DESC);
```

### 6.3 Perluasan `assumptions_master.data` (JSON)

Tambah field opsional (backward compatible):

```json
{
  "kurs_usd": 16500,
  "kurs_usd_source": "frankfurter",
  "kurs_usd_updated_at": "2026-06-09T02:00:00.000Z",
  "kurs_auto_sync_enabled": true
}
```

Tidak wajib migrasi terpisah — merge saat sync pertama.

---

## 7. API

### 7.1 Kurs aktif (semua user login)

```
GET /api/v1/config/exchange-rate
```

**Auth:** `authRequired` — **semua role** (SA, ASMAN, MANAGER, FINANCE_ADMIN, SUPER_ADMIN, …)

**Response:**

```json
{
  "currency_pair": "USD/IDR",
  "rate": 16500,
  "source": "frankfurter",
  "updated_at": "2026-06-09T02:00:00.000Z",
  "rate_date": "2026-06-09",
  "auto_sync_enabled": true,
  "previous_day_rate": 16480,
  "change_amount": 20,
  "change_percent": 0.1214
}
```

Implementasi: gabungan `assumptions_master` + baris terakhir `usd_exchange_rate_daily`; tidak hit provider eksternal per page view.

### 7.2 Historis harian (semua user login) — **baru**

```
GET /api/v1/config/exchange-rate/history
```

**Auth:** `authRequired` — **semua role** (bukan admin-only)

**Query params:**

| Param | Default | Keterangan |
|-------|---------|------------|
| `from` | 30 hari lalu | ISO date `YYYY-MM-DD` (WIB) |
| `to` | hari ini | ISO date |
| `limit` | 90 | Max 365 |
| `order` | `desc` | `asc` \| `desc` by `rate_date` |

**Response:**

```json
{
  "currency_pair": "USD/IDR",
  "from": "2026-05-10",
  "to": "2026-06-09",
  "items": [
    {
      "rate_date": "2026-06-09",
      "rate": 16520,
      "previous_day_rate": 16500,
      "change_amount": 20,
      "change_percent": 0.1212,
      "source": "frankfurter",
      "recorded_at": "2026-06-09T02:00:05.000Z"
    },
    {
      "rate_date": "2026-06-08",
      "rate": 16500,
      "previous_day_rate": 16480,
      "change_amount": 20,
      "change_percent": 0.1214,
      "source": "frankfurter",
      "recorded_at": "2026-06-08T02:00:04.000Z"
    }
  ],
  "summary": {
    "count": 30,
    "min_rate": 16450,
    "max_rate": 16520,
    "latest_rate": 16520
  }
}
```

**Catatan akses:**

- Endpoint **read-only**; tidak ada data sensitif — aman untuk semua user internal
- Tidak perlu RLS per org unit (kurs global perusahaan)
- Rate limit: pakai `apiLimiter` global (sama endpoint config lain)

### 7.3 Admin — sync manual

```
POST /api/v1/admin/exchange-rate/sync
```

**Auth:** `FINANCE_ADMIN`, `SUPER_ADMIN`

**Body (opsional):**

```json
{
  "force": false
}
```

**Perilaku:**

1. Fetch dari provider
2. Validasi range min/max
3. Jika berbeda dari `kurs_usd` saat ini → update `assumptions_master`, **upsert `usd_exchange_rate_daily`**, tulis `exchange_rate_log` + `assumptions_history`
4. Return `{ rate, previous_rate, source, applied: true, rate_date }`

**Errors:**

| HTTP | Kondisi |
|------|---------|
| 502 | Provider timeout / unreachable |
| 422 | Rate di luar batas validasi |
| 409 | `force: false` dan auto_sync disabled |

### 7.4 Admin — log sync detail (opsional)

```
GET /api/v1/admin/exchange-rate/sync-log?limit=50
```

**Auth:** `FINANCE_ADMIN`, `SUPER_ADMIN` — isi dari `exchange_rate_log` (termasuk error & unchanged).

### 7.5 Admin — toggle auto sync

```
PATCH /api/v1/admin/exchange-rate/settings
```

```json
{ "kurs_auto_sync_enabled": true }
```

Disimpan di `assumptions_master.data` (sama pola CMS asumsi lain).

---

## 8. Backend — modul baru

| File | Tanggung jawab |
|------|----------------|
| `backend/src/services/exchangeRateProvider.js` | Adapter Frankfurter / BI / custom URL |
| `backend/src/services/exchangeRateService.js` | fetch, validate, apply ke assumptions, **upsert daily** |
| `backend/src/services/kursScheduler.js` | Interval harian; cek `kurs_auto_sync_enabled` |
| `backend/src/routes/exchangeRate.js` | Mount config (semua user) + admin |
| `backend/src/db.js` | `initDb()` — `usd_exchange_rate_daily` + `exchange_rate_log` |
| `backend/src/index.js` | `startKursScheduler()` setelah `startSlaScheduler()` |
| `backend/sql/usd-exchange-rate.sql` | Migrasi idempotent (VPS manual) |

### 8.1 Pseudocode sync (termasuk historis harian)

```javascript
function toWibDate(d = new Date()) {
  // Asia/Jakarta YYYY-MM-DD
  return formatInTimeZone(d, 'Asia/Jakarta', 'yyyy-MM-dd');
}

async function upsertDailyRate({ rate, source, syncMode, userId }) {
  const rateDate = toWibDate();
  const { rows: prev } = await query(
    `SELECT rate FROM usd_exchange_rate_daily
     WHERE rate_date = $1::date - INTERVAL '1 day'
     ORDER BY rate_date DESC LIMIT 1`,
    [rateDate]
  );
  const previousDayRate = prev[0]?.rate ?? null;
  const changeAmount = previousDayRate != null ? rate - previousDayRate : null;
  const changePercent =
    previousDayRate != null && previousDayRate !== 0
      ? ((rate - previousDayRate) / previousDayRate) * 100
      : null;

  await query(
    `INSERT INTO usd_exchange_rate_daily
       (rate_date, rate, previous_day_rate, change_amount, change_percent, source, sync_mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (rate_date, currency_from, currency_to) DO UPDATE SET
       rate = EXCLUDED.rate,
       previous_day_rate = EXCLUDED.previous_day_rate,
       change_amount = EXCLUDED.change_amount,
       change_percent = EXCLUDED.change_percent,
       source = EXCLUDED.source,
       sync_mode = EXCLUDED.sync_mode,
       recorded_at = NOW()`,
    [rateDate, rate, previousDayRate, changeAmount, changePercent, source, syncMode]
  );
}

async function syncExchangeRate({ mode, userId }) {
  const current = await getAssumptions();
  const fetched = await provider.fetchUsdIdr();
  validateRange(fetched.rate, MIN, MAX);

  await logExchangeRateAttempt({ ...fetched, mode, userId }); // exchange_rate_log

  const next = {
    ...current,
    kurs_usd: fetched.rate,
    kurs_usd_source: fetched.source,
    kurs_usd_updated_at: new Date().toISOString(),
  };
  await saveAssumptions(next, { userId, userName: mode === 'scheduled' ? 'System' : userName });
  await upsertDailyRate({ rate: fetched.rate, source: fetched.source, syncMode: mode, userId });
  return { applied: true, rate: fetched.rate, rate_date: toWibDate() };
}
```

---

## 9. Frontend

### 9.1 Halaman **Historis Kurs USD** — semua user login (**baru**)

**Route:** `/kurs-usd`  
**Auth:** layout dashboard (semua role yang bisa login)  
**Nav:** item menu **"Kurs USD"** di `AppShell` — **tanpa** filter `roles` (sama seperti Dashboard)

**Komponen:** `frontend/src/app/(dashboard)/kurs-usd/page.tsx`  
**Shared:** `frontend/src/components/kurs/UsdRateHistoryTable.tsx`

**Layout halaman:**

```
┌─────────────────────────────────────────────────────────────┐
│  Kurs USD / IDR                                              │
│  Kurs hari ini: Rp 16.520  (+20 / +0,12%)  · Frankfurter    │
├─────────────────────────────────────────────────────────────┤
│  [Filter: 30 hari ▼]  [Dari] [Sampai]  [Export CSV]         │
├─────────────────────────────────────────────────────────────┤
│  Grafik garis (opsional Fase 1b) — rate vs tanggal           │
├─────────────────────────────────────────────────────────────┤
│  Tabel historis harian                                       │
│  ┌──────────┬────────────┬──────────┬─────────┬──────────┐  │
│  │ Tanggal  │ Kurs (IDR) │ Perubahan│ %       │ Sumber   │  │
│  ├──────────┼────────────┼──────────┼─────────┼──────────┤  │
│  │ 09/06/26 │ 16.520     │ +20      │ +0,12%  │ frankfur │  │
│  │ 08/06/26 │ 16.500     │ +20      │ +0,12%  │ frankfur │  │
│  └──────────┴────────────┴──────────┴─────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Perilaku UI:**

| Fitur | Detail |
|-------|--------|
| Data source | `GET /api/v1/config/exchange-rate/history` |
| Kurs hari ini | `GET /api/v1/config/exchange-rate` (header card) |
| Perubahan | Warna hijau (+) / merah (−) untuk `change_amount` |
| Pagination | Client-side atau `limit` + load more |
| Export CSV | Generate dari `items` di browser (semua user) |
| Loading / error | Skeleton + pesan retry |

**RBAC:** Tidak ada pembatasan role — SA, ASMAN, MANAGER, dan admin semua melihat historis yang sama.

### 9.2 Widget ringkas di Dashboard (opsional Fase 1)

Di `frontend/src/app/(dashboard)/dashboard/page.tsx`:

- Card kecil: **"Kurs USD: Rp 16.520"** + link **"Lihat historis →"** ke `/kurs-usd`
- Data dari `GET /config/exchange-rate` (React Query, cache 5 menit)

### 9.3 Admin → panel Asumsi (perluasan)

Di grup **"Kurs & Mata Uang"**:

- Badge: **Auto sync ON/OFF**
- Tampilkan: kurs aktif, sumber, terakhir di-update
- Tombol **"Sync kurs sekarang"** (FINANCE_ADMIN / SUPER_ADMIN)
- Toggle **"Perbarui otomatis setiap hari"**
- Link ke `/kurs-usd` untuk historis lengkap
- Tabel **sync log** admin-only (5 terakhir dari `sync-log` endpoint)

### 9.4 Wizard Langkah 2

- Hint: `"Kurs master: Rp X (9 Jun 2026, sumber: Frankfurter)"` — dari `GET /config/exchange-rate`
- Link kecil: **"Riwayat kurs"** → `/kurs-usd`

### 9.5 API client

Tambah di `frontend/src/services/api.ts`:

| Method | Endpoint | Siapa |
|--------|----------|-------|
| `getExchangeRate()` | `GET /config/exchange-rate` | Semua user |
| `getExchangeRateHistory(params)` | `GET /config/exchange-rate/history` | Semua user |
| `syncExchangeRate()` | `POST /admin/exchange-rate/sync` | Admin keuangan |
| `getExchangeRateSyncLog()` | `GET /admin/exchange-rate/sync-log` | Admin keuangan |
| `patchExchangeRateSettings()` | `PATCH /admin/exchange-rate/settings` | Admin keuangan |

**Types:** `frontend/src/types/exchange-rate.ts`

```typescript
export interface UsdDailyRateRow {
  rate_date: string;
  rate: number;
  previous_day_rate: number | null;
  change_amount: number | null;
  change_percent: number | null;
  source: string;
  recorded_at: string;
}
```

---

## 10. Keamanan & operasi

| Aspek | Langkah |
|-------|---------|
| **Secrets** | API key provider (jika ada) hanya di env, tidak di repo |
| **Rate limit** | Sync manual max 10×/jam per user (reuse `apiLimiter` atau limiter khusus) |
| **Audit** | `audit_log` action `EXCHANGE_RATE_SYNC` |
| **Scheduler** | Satu instance saja (PM2 id 0); skip jika `NODE_ENV=test` |
| **Monitoring** | Log `[navpro:kurs] synced USD/IDR 16500 → 16620 (frankfurter)` |
| **Notifikasi** | Opsional: email/in-app ke FINANCE_ADMIN jika sync gagal 3× berturut |

---

## 11. Dampak pada proyek & perhitungan

| Skenario | Perilaku |
|----------|----------|
| Proyek **baru** (wizard) | Pre-fill `kurs_usd` dari master terbaru |
| Proyek **existing** tanpa override | Recalculate pakai kurs master **saat tombol hitung** ditekan |
| Proyek dengan **override** | Tetap pakai override; master sync tidak mengubahnya |
| KPI `kurs_usd_used` | Snapshot per run kalkulasi — historis audit KKF |
| PDF export | Tetap tampilkan `kurs_usd_used` dari KPI |

---

## 12. Rencana implementasi (fase)

### Fase 1 — MVP (estimasi 1,5–2 hari dev)

| # | Task | Owner | Deliverable |
|---|------|-------|-------------|
| 1.1 | Keputusan provider fase 1 (Frankfurter) | Product/Finance | Sign-off di dokumen ini |
| 1.2 | Migration `usd_exchange_rate_daily` + `exchange_rate_log` + initDb | BE | SQL + `db.js` |
| 1.3 | `exchangeRateProvider.js` (Frankfurter) | BE | Unit test fetch mock |
| 1.4 | `exchangeRateService.js` + upsert harian + validasi | BE | Test apply + daily row |
| 1.5 | Routes: `GET /config/exchange-rate` + **`/history` (semua user)** | BE | Postman / smoke |
| 1.6 | Routes admin sync + sync-log | BE | Postman / smoke |
| 1.7 | `kursScheduler.js` + env | BE | Log harian |
| 1.8 | **Halaman `/kurs-usd` + nav semua role** | FE | Manual QA |
| 1.9 | Admin UI: status + sync + toggle | FE | Manual QA |
| 1.10 | Seed baris awal historis (kurs seed 16500) | BE | 1 baris hari ini |
| 1.11 | Dokumentasi env di `.env.example` | DevOps | |

**Definition of done Fase 1:**

- [ ] `POST /admin/exchange-rate/sync` memperbarui `kurs_usd` dan **baris harian**
- [ ] `GET /config/exchange-rate/history` dapat diakses **semua role** login
- [ ] Halaman `/kurs-usd` menampilkan tabel historis per hari
- [ ] Scheduler jalan jika `EXCHANGE_RATE_AUTO_SYNC=true`
- [ ] Wizard Langkah 2 menampilkan kurs master terbaru setelah sync
- [ ] Proyek dengan override tidak terpengaruh

### Fase 2 — BI JISDOR & governance (estimasi 2–3 hari)

| # | Task |
|---|------|
| 2.1 | Parser/provider BI JISDOR resmi |
| 2.2 | Backfill historis BI (import CSV/API ke `usd_exchange_rate_daily`) |
| 2.3 | Grafik tren kurs di `/kurs-usd` (Recharts) |
| 2.4 | Approval workflow jika delta kurs > 5% (opsional) |
| 2.5 | Notifikasi gagal sync ke Finance Admin |

### Fase 3 — Enhancement (opsional)

| # | Task |
|---|------|
| 3.1 | Kurs historis per tanggal efektif proyek (snapshot saat submit KKF) |
| 3.2 | Multi-currency selain USD |
| 3.3 | Integrasi Redis lock untuk multi-instance scheduler |

---

## 13. Testing

### 13.1 Unit test (backend)

- Provider mock: response valid / timeout / malformed
- Validasi min/max
- Sync idempotent (rate sama → `applied: false`)
- Update assumptions + history

### 13.2 Integration / smoke

```bash
# Historis harian (semua user — token SA/manajer/admin)
curl "http://localhost:4000/api/v1/config/exchange-rate/history?limit=30" \
  -H "Authorization: Bearer $TOKEN"

# Kurs aktif
curl http://localhost:4000/api/v1/config/exchange-rate \
  -H "Authorization: Bearer $TOKEN"

# Manual sync (admin)
curl -X POST http://localhost:4000/api/v1/admin/exchange-rate/sync \
  -H "Authorization: Bearer $TOKEN"
```

### 13.3 UAT bisnis

1. Sync manual → cek Admin Asumsi `kurs_usd` berubah + **baris baru di tabel harian**
2. Login sebagai **SA** → buka `/kurs-usd` → tabel historis tampil (bukan 403)
3. Login sebagai **MANAGER** → historis sama dengan SA
4. Buat proyek baru → wizard tampilkan kurs baru
5. Proyek lama dengan override → kurs tidak berubah
6. Matikan auto sync → scheduler tidak update; historis hari lalu tetap ada

---

## 14. Rollout VPS

```bash
cd /var/www/navpro && git pull
# Set env di backend/.env:
# EXCHANGE_RATE_AUTO_SYNC=true
# EXCHANGE_RATE_PROVIDER=frankfurter

cd backend && npm ci
pm2 restart navpro-backend --update-env
```

Verifikasi log: `pm2 logs navpro-backend | grep kurs`

---

## 15. Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Provider down | Fallback kurs lama + alert |
| Kurs loncat ekstrem (data salah) | Validasi min/max; optional approval fase 2 |
| BI scraping break | Abstraksi provider; monitor + fallback Frankfurter |
| Multi-instance scheduler double-write | DB transaction + compare rate; Redis lock fase 3 |
| Perbedaan kurs BI vs pasar | Label sumber jelas di UI & PDF |

---

## 16. Checklist sebelum mulai coding

- [ ] Finance setujui jenis kurs (BI tengah vs spot vs internal)
- [ ] Finance setujui frekuensi & batas validasi
- [ ] DevOps siapkan env production
- [ ] Product setujui UX Admin (toggle + manual sync)
- [ ] Issue/ticket dibuat di backlog dengan label `feature:kurs-usd`

---

## 17. Referensi kode NAVPRO

| Topik | Path |
|-------|------|
| Asumsi master seed | `backend/src/seed.js` |
| Engine kurs | `backend/src/services/calculationEngine.js` |
| Admin assumptions API | `backend/src/routes/admin.js` |
| Config assumptions | `backend/src/routes/config.js` |
| Scheduler pola | `backend/src/services/slaScheduler.js` |
| Wizard pre-fill | `frontend/src/lib/global-assumptions.ts` |
| Nav semua role | `frontend/src/components/layout/AppShell.tsx` |
| Halaman historis (rencana) | `frontend/src/app/(dashboard)/kurs-usd/page.tsx` |
| BRD kurs BI | `docs/exsum.md` §2.1 |

---

*Dokumen ini dapat diperbarui setelah keputusan Finance pada §3 final.*
