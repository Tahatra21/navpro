import type { User } from "@/types/navpro";

export const GLOBAL_ORG_CODE = "GLOBAL-ADMIN";

export function isGlobalOrgHome(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.org_unit_type === "GLOBAL") return true;
  if (user.org_unit_code === GLOBAL_ORG_CODE) return true;
  return false;
}

/** Boleh memilih unit operasional tujuan proyek (wizard Langkah 1). */
export function canPickAnyProjectOrg(user: User | null | undefined): boolean {
  if (!user) return false;
  if (["SUPER_ADMIN", "FINANCE_ADMIN", "VP_SA"].includes(user.role)) return true;
  if (isGlobalOrgHome(user)) return true;
  return !user.org_unit_id;
}
