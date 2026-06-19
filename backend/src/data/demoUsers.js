/** Akun demo kanonik — lokal & VPS harus selaras. */
export const DEMO_USERS = [
  { email: 'admin@navpro.app', full_name: 'Admin NAVPRO', role: 'SUPER_ADMIN' },
  { email: 'budi.santoso@navpro.app', full_name: 'Budi Santoso', role: 'SUPER_ADMIN' },
  { email: 'ani.lestari@navpro.app', full_name: 'Ani Lestari', role: 'FINANCE_ADMIN' },
  { email: 'rian.hidayat@navpro.app', full_name: 'Rian Hidayat', role: 'SA' },
  { email: 'sari.wulandari@navpro.app', full_name: 'Sari Wulandari', role: 'ASMAN' },
  { email: 'dewi.sartika@navpro.app', full_name: 'Dewi Sartika', role: 'MANAGER' },
  { email: 'irwan.setiawan@navpro.app', full_name: 'Irwan Setiawan', role: 'GM_SRM' },
];

export const DEMO_USER_IDS = {
  'admin@navpro.app': '11111111-1111-1111-1111-111111111100',
  'budi.santoso@navpro.app': '11111111-1111-1111-1111-111111111101',
  'ani.lestari@navpro.app': '11111111-1111-1111-1111-111111111102',
  'rian.hidayat@navpro.app': '11111111-1111-1111-1111-111111111103',
  'sari.wulandari@navpro.app': '11111111-1111-1111-1111-111111111104',
  'dewi.sartika@navpro.app': '11111111-1111-1111-1111-111111111105',
  'irwan.setiawan@navpro.app': '11111111-1111-1111-1111-111111111106',
};

/**
 * Sinkron role akun demo yang sudah ada (aman di VPS — tidak insert user baru).
 */
export async function syncDemoUserRoles(query, { passwordHash = null } = {}) {
  for (const u of DEMO_USERS) {
    const { rowCount } = await query(
      `UPDATE users SET role = $1, full_name = $2, is_active = true WHERE email = $3`,
      [u.role, u.full_name, u.email]
    );
    if (rowCount > 0 && passwordHash) {
      await query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [passwordHash, u.email]);
    }
  }
}

/**
 * Pastikan akun demo ada dengan role benar.
 * VPS: UUID fixed bisa bentrok dengan user manual → insert tanpa id jika perlu.
 */
export async function ensureDemoUsers(query, { passwordHash = null, insertMissing = true } = {}) {
  for (const u of DEMO_USERS) {
    const preferredId = DEMO_USER_IDS[u.email];
    const { rows: byEmail } = await query(`SELECT id FROM users WHERE email = $1`, [u.email]);

    if (byEmail[0]) {
      await query(
        `UPDATE users SET role = $1, full_name = $2, is_active = true WHERE email = $3`,
        [u.role, u.full_name, u.email]
      );
      if (passwordHash) {
        await query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [passwordHash, u.email]);
      }
      continue;
    }

    if (!insertMissing || !passwordHash) continue;

    const { rows: byId } = await query(`SELECT id, email FROM users WHERE id = $1`, [preferredId]);
    if (byId[0]) {
      await query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (email) DO UPDATE SET
           role = EXCLUDED.role,
           full_name = EXCLUDED.full_name,
           is_active = true,
           password_hash = EXCLUDED.password_hash`,
        [u.email, passwordHash, u.full_name, u.role]
      );
      continue;
    }

    await query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (email) DO UPDATE SET
         role = EXCLUDED.role,
         full_name = EXCLUDED.full_name,
         is_active = true,
         password_hash = EXCLUDED.password_hash`,
      [preferredId, u.email, passwordHash, u.full_name, u.role]
    );
  }
}

export async function logDemoUserRoles(query) {
  const emails = DEMO_USERS.map((u) => u.email);
  const { rows } = await query(`SELECT email, role, is_active FROM users WHERE email = ANY($1::text[])`, [
    emails,
  ]);
  const byEmail = Object.fromEntries(rows.map((r) => [r.email, r]));
  for (const u of DEMO_USERS) {
    const row = byEmail[u.email];
    const ok = row?.role === u.role && row?.is_active !== false;
    console.log(`[demo-users] ${u.email} → ${row?.role ?? 'MISSING'}${ok ? '' : ` (expected ${u.role})`}`);
  }
}

export async function resolveDemoUserIdByEmail(query, email) {
  const { rows } = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
  return rows[0]?.id ?? DEMO_USER_IDS[email] ?? null;
}
