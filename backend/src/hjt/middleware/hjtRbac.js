import { requireRoles } from '../../middleware/auth.js';

export const HJT_TARIFF_ADMIN_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN'];
export const HJT_QUOTATION_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'SA', 'STAFF'];
export const HJT_READ_ROLES = [
  'SUPER_ADMIN',
  'FINANCE_ADMIN',
  'VP_SA',
  'SA',
  'STAFF',
  'MANAGER',
  'ASMAN',
  'GM_SRM',
];

export function requireHjtTariffAdmin(req, res, next) {
  return requireRoles(...HJT_TARIFF_ADMIN_ROLES)(req, res, next);
}

export function requireHjtQuotation(req, res, next) {
  return requireRoles(...HJT_QUOTATION_ROLES)(req, res, next);
}

export function requireHjtRead(req, res, next) {
  return requireRoles(...HJT_READ_ROLES)(req, res, next);
}
