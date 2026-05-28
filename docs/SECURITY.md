# NAVPRO — Keamanan kredensial

## Prinsip

- **Tidak ada password, JWT secret, atau connection string** di kode sumber, UI login, atau dokumentasi publik repo.
- Kredensial hanya lewat **environment variables** (file `.env` lokal, tidak di-commit).
- Produksi wajib `NODE_ENV=production`, `JWT_SECRET` kuat (≥32 karakter acak), dan `DATABASE_URL` dari secret manager.

## Setup development

1. Salin contoh env:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
2. Isi `backend/.env` (jangan commit):
   - `DATABASE_URL` — koneksi PostgreSQL lokal Anda
   - `JWT_SECRET` — string acak panjang (mis. `openssl rand -base64 48`)
   - `SEED_DEMO_PASSWORD` — password sementara untuk user demo **hanya di mesin dev**
3. Jalankan seed:
   ```bash
   cd backend && node src/seed.js
   ```
4. Login dengan email user yang dibuat seed + password dari `SEED_DEMO_PASSWORD`.

## Smoke test

Set di environment (jangan tulis di skrip):

```bash
export SMOKE_EMAIL=your-test-user@company.com
export SMOKE_PASSWORD=your-test-password
node scripts/smoke-test.mjs
```

## Admin — buat / reset user

- **Buat user:** password wajib (min. 8 karakter), tidak ada default di backend.
- **Reset password:** SUPER_ADMIN harus mengisi password baru di UI; tidak ada reset ke password baku.

## Docker Compose (lokal)

```bash
cp .env.docker.example .env   # repo root — isi POSTGRES_PASSWORD, JWT_SECRET, MINIO_ROOT_PASSWORD
docker compose up -d postgres
```

## Reset password demo (development)

Secara default, `npm run seed` **tidak** menimpa password user yang sudah ada. Untuk menyamakan ke `SEED_DEMO_PASSWORD`:

```bash
SEED_RESET_DEMO_PASSWORDS=true node src/seed.js
```

(Hanya jika `NODE_ENV` bukan `production`.)

## Pemeriksaan otomatis

```bash
cd backend && npm run check:secrets
```

Gagal jika pola rahasia terlarang (password demo baku, JWT dev default, connection string dengan password baku) muncul di kode aplikasi.

## File yang tidak boleh di-commit

- `backend/.env`, `frontend/.env.local`, `.env` (root, untuk Docker)
- Dump database berisi hash (`db/*.sql`) — jika pernah ter-commit: `git rm --cached db/*.sql`
- `.seed-credentials.local` (jika ada)

## Legacy

Folder `legacy/` adalah arsip prototipe; login offline dan akun demo cepat dinonaktifkan. Gunakan Next.js + API.
