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
 * Pastikan akun demo ada dengan role benar.
 * VPS: admin@navpro.app sering dibuat manual dengan role selain SUPER_ADMIN → RLS sembunyikan HJT.
 */
export async function ensureDemoUsers(query, { passwordHash = null } = {}) {
  for (const u of DEMO_USERS) {
    const userId = DEMO_USER_IDS[u.email];
    const { rows } = await query(`SELECT id FROM users WHERE email = $1`, [u.email]);

    if (rows[0]) {
      await query(
        `UPDATE users SET role = $1, full_name = $2, is_active = true WHERE email = $3`,
        [u.role, u.full_name, u.email]
      );
      if (passwordHash) {
        await query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [passwordHash, u.email]);
      }
      continue;
    }

    if (!passwordHash) continue;

    await query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [userId, u.email, passwordHash, u.full_name, u.role]
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
