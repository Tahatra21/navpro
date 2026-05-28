# Database dumps

**`navpro_db_20260529_011809.sql`** — snapshot baseline (schema + data demo) untuk restore di VPS.

Dump baru dari `npm run db:dump` (pola `navpro_db_YYYYMMDD_*.sql`) tidak di-commit secara default — berisi hash password. Jangan commit dump ad-hoc ke repo publik.

## Export (development / `.pgdata`)

```bash
npm run db:dump --prefix backend
# atau: node backend/scripts/dump-db.mjs
```

Output: `db/navpro_db_YYYYMMDD_HHMMSS.sql` (plain SQL).

## Export (Docker / VPS)

```bash
docker compose exec -T postgres pg_dump -U navpro -d navpro_db --no-owner --no-acl > db/navpro_db_$(date +%Y%m%d_%H%M%S).sql
```

## Restore

```bash
psql -h 127.0.0.1 -p 5435 -U navpro -d navpro_db -f db/navpro_db_YYYYMMDD_HHMMSS.sql
# Docker: docker compose exec -T postgres psql -U navpro -d navpro_db < db/....sql
```

Gunakan `backend/src/seed.js` untuk data development kosong. Lihat [docs/SECURITY.md](../docs/SECURITY.md).
