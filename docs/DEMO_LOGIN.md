# Akun demo — sinkron lokal & VPS

Semua user demo memakai **satu password**: nilai `SEED_DEMO_PASSWORD` di environment (bukan hardcode di repo).

## Akun (setelah seed)

| Email | Role |
|-------|------|
| `admin@navpro.app` | SUPER_ADMIN |
| `budi.santoso@navpro.app` | SUPER_ADMIN |
| `ani.lestari@navpro.app` | FINANCE_ADMIN |
| `rian.hidayat@navpro.app` | SA |
| `sari.wulandari@navpro.app` | ASMAN |
| `dewi.sartika@navpro.app` | MANAGER |
| `irwan.setiawan@navpro.app` | GM_SRM |

## Samakan lokal dengan VPS

1. **Password harus identik** di:
   - Lokal: `backend/.env` → `SEED_DEMO_PASSWORD=...`
   - VPS: `.env` / `.env.docker` (repo root) → `SEED_DEMO_PASSWORD=...` (nilai yang sama)

2. **Lokal** — reset cepat (dari root repo):
   ```bash
   npm run reset:local
   ```
   Lalu restart `npm run dev` dan hard-refresh browser.

3. **VPS (Docker)** — setelah `git pull`:
   ```bash
   docker compose exec backend node src/seed.js
   # atau dari host, dengan env yang sama:
   SEED_RESET_DEMO_PASSWORDS=true docker compose run --rm -e SEED_RESET_DEMO_PASSWORDS backend node src/seed.js
   ```

   Atau restore snapshot yang sama:
   ```bash
   docker compose exec -T postgres psql -U navpro -d navpro_db < db/navpro_db_20260529_011809.sql
   ```
   Lalu tetap set `SEED_DEMO_PASSWORD` yang sama dan jalankan reset seed di atas.

## Cek user di database

```bash
# Lokal (embedded, port 5435)
PGPASSWORD=navpro_dev psql -h 127.0.0.1 -p 5435 -U navpro -d navpro_db -c "SELECT email, role FROM users ORDER BY email;"

# VPS
docker compose exec postgres psql -U navpro -d navpro_db -c "SELECT email, role FROM users ORDER BY email;"
```

Jika `admin@navpro.app` hanya ada di VPS (dibuat manual), jalankan seed di VPS agar daftar user sama dengan dokumen ini.
