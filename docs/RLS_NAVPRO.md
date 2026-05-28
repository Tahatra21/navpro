## NAVPRO — Row Level Security (RLS) (V2-A05)

Referensi: `BUSINESS_KKF_NAVPRO_v2.md` §5.3 (Data Visibility Scope) dan §15 (R-05).

### Tujuan

Mengunci *data isolation* di level database (PostgreSQL) agar akses lintas unit/segment tidak mungkin terjadi walaupun ada bug di API.

### Status implementasi

- Policy SQL: `backend/sql/rls-navpro.sql` (referensi manual)
- Policy diterapkan otomatis saat `NAVPRO_RLS_ENABLED=true` lewat `ensureRlsPolicies()` di `backend/src/db.js`
- Backend menyetel GUC per request setelah `loadUser` via `rlsAfterLoadUser` (`backend/src/utils/rls.js`, `middleware/auth.js`)
- Router yang memakai RLS: `projects`, `approvals`, `dashboard`, `jobs`

### Mengaktifkan RLS

```bash
# .env backend
NAVPRO_RLS_ENABLED=true
```

Restart API. Pada `initDb()`, policy dibuat dan `ALTER TABLE projects ENABLE ROW LEVEL SECURITY` dijalankan.

Tanpa env tersebut, RLS tetap **nonaktif** (perilaku default aman untuk dev).

### Konteks yang diset per request

| GUC | Sumber |
|-----|--------|
| `navpro.user_id` | JWT `sub` |
| `navpro.role` | JWT `role` |
| `navpro.org_unit_id` | `users.org_unit_id` |
| `navpro.segment` | `organization_units.segment` (join di `loadUser`) |

Setiap query `query()` di dalam konteks AsyncLocalStorage memakai transaksi singkat: `BEGIN` → `set_config` → SQL → `COMMIT`.

### Mapping scope (policy `projects_select_policy`)

- `SUPER_ADMIN`, `FINANCE_ADMIN`, `VP_SA`: semua proyek
- `STAFF`, `SA`: proyek yang dibuat sendiri (`created_by`)
- `ASMAN`: proyek di unit yang sama (`org_unit_id`)
- `MANAGER`, `GM_SRM`: proyek di segment yang sama (`segment`)
- selain itu: ditolak

### Catatan operasional

- Worker/scheduler (`calcWorker`, `slaScheduler`) berjalan **tanpa** konteks RLS → akses penuh via pool (diperlukan untuk job sistem).
- Login dan `loadUser` tetap bisa membaca `users` tanpa konteks RLS penuh (konteks org diisi setelah `loadUser`).
- Untuk debug: `SELECT * FROM navpro_rls_context;` di dalam transaksi yang sudah set GUC.
