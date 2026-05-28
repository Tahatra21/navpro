# NAVPRO

Navigate Project — platform kajian kelayakan finansial (KKF).

## Quick start

1. [docs/README.md](docs/README.md) — arsitektur & menjalankan stack
2. [docs/SECURITY.md](docs/SECURITY.md) — kredensial, seed, smoke test (wajib baca sebelum dev)

```bash
cp backend/.env.example backend/.env   # isi DATABASE_URL, JWT_SECRET, SEED_DEMO_PASSWORD
cd backend && npm install && npm run seed && npm run dev
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

## Security

- Jangan commit `.env`, dump SQL (`db/*.sql`), atau password di kode.
- `npm run check:secrets` (di folder `backend`) memindai pola rahasia yang dilarang.
