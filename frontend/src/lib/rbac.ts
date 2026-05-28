import type { UserRole } from "@/types/navpro";

export function hasRole(userRole: UserRole | string | undefined, allowed: UserRole[]): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole as UserRole);
}

export function canCreateProject(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "FINANCE_ADMIN", "SA", "STAFF"]);
}

export function canViewApprovals(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "FINANCE_ADMIN", "MANAGER", "GM_SRM", "ASMAN"]);
}

export function canViewAdmin(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "FINANCE_ADMIN"]);
}

export function canApprove(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "MANAGER", "GM_SRM", "ASMAN"]);
}

/** V2 + legacy status gates for approve/reject actions */
export function canApproveAtStatus(role: string | undefined, status: string): boolean {
  if (!role) return false;

  if (role === "ASMAN") {
    return status === "IN_REVIEW_ASMAN";
  }
  if (role === "MANAGER") {
    return status === "IN_REVIEW_MANAGER" || ["SUBMITTED", "UNDER_REVIEW"].includes(status);
  }
  if (role === "GM_SRM") {
    return status === "APPROVED_L1";
  }
  // Admins should not bypass v2 steps via UI
  return false;
}

export function canRejectAtStatus(role: string | undefined, status: string): boolean {
  return canApproveAtStatus(role, status);
}

export function canEditProject(role: string | undefined, status: string): boolean {
  if (!canCreateProject(role)) return false;
  return ["DRAFT", "COMPUTED", "REJECTED"].includes(status);
}

export function canSubmitProject(role: string | undefined, status: string): boolean {
  if (!canCreateProject(role)) return false;
  return ["DRAFT", "COMPUTED", "REJECTED"].includes(status);
}

/** Prefer v2 approvals queue API for these roles */
export function usesV2ApprovalsQueue(role?: string): boolean {
  return hasRole(role, ["ASMAN", "MANAGER"]);
}
