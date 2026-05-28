/** Shared security helpers — no secrets in source code. */

const INSECURE_JWT_SECRETS = new Set([
  'navpro-dev-jwt-secret-change-in-production',
  'navpro-dev-only-not-for-production',
  'change-me',
  'secret',
  'password',
  'test',
  'dev',
  'development',
  '12345678',
  'qwerty',
]);

/** Minimum length for JWT secret in production. */
const JWT_SECRET_MIN_PROD_LENGTH = 64;
const JWT_SECRET_MIN_DEV_LENGTH = 32;

export function warnInsecureDevSecrets() {
  if (process.env.NODE_ENV === 'production') return;
  const jwt = process.env.JWT_SECRET;
  if (!jwt || jwt.length < JWT_SECRET_MIN_DEV_LENGTH || INSECURE_JWT_SECRETS.has(jwt)) {
    console.warn(
      '[navpro] ⚠ Set a strong JWT_SECRET in backend/.env (openssl rand -base64 64).'
    );
  }
}

export function assertRuntimeSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwt = process.env.JWT_SECRET;
  if (!jwt || jwt.length < JWT_SECRET_MIN_PROD_LENGTH || INSECURE_JWT_SECRETS.has(jwt)) {
    throw new Error(
      `Production requires JWT_SECRET (min ${JWT_SECRET_MIN_PROD_LENGTH} chars, cryptographically random). Run: openssl rand -base64 64`
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('Production requires DATABASE_URL. Set in environment.');
  }

  if (!process.env.CORS_ORIGIN) {
    throw new Error('Production requires CORS_ORIGIN (comma-separated HTTPS origins). Set in environment.');
  }
}

/** Only for local seed scripts — never hardcode passwords in repo. */
export function getSeedDemoPassword() {
  const pwd = process.env.SEED_DEMO_PASSWORD;
  if (!pwd || pwd.length < 12) {
    throw new Error(
      'Set SEED_DEMO_PASSWORD (min 12 characters) in backend/.env before running seed.'
    );
  }
  return pwd;
}

/**
 * Enterprise password policy:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character (recommended, not enforced to avoid lockout)
 */
export function validatePasswordPolicy(password, { fieldName = 'Password' } = {}) {
  const p = String(password || '');

  if (p.length < 12) {
    return { ok: false, message: `${fieldName} minimal 12 karakter.` };
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, message: `${fieldName} harus mengandung minimal 1 huruf kapital.` };
  }
  if (!/[a-z]/.test(p)) {
    return { ok: false, message: `${fieldName} harus mengandung minimal 1 huruf kecil.` };
  }
  if (!/[0-9]/.test(p)) {
    return { ok: false, message: `${fieldName} harus mengandung minimal 1 angka.` };
  }

  return { ok: true };
}

