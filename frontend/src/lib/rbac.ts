import type { UserRole } from "@/types/navpro";

export function hasRole(userRole: UserRole | string | undefined, allowed: UserRole[]): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole as UserRole);
}

export function canCreateProject(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "FINANCE_ADMIN", "SA"]);
}

export function canViewApprovals(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "FINANCE_ADMIN", "MANAGER", "GM_SRM"]);
}

export function canViewAdmin(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "FINANCE_ADMIN"]);
}

export function canApprove(role?: string): boolean {
  return hasRole(role, ["SUPER_ADMIN", "MANAGER", "GM_SRM"]);
}

export function canApproveAtStatus(role: string | undefined, status: string): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") {
    return ["SUBMITTED", "UNDER_REVIEW", "APPROVED_L1"].includes(status);
  }
  if (role === "MANAGER") {
    return ["SUBMITTED", "UNDER_REVIEW"].includes(status);
  }
  if (role === "GM_SRM") {
    return status === "APPROVED_L1";
  }
  return false;
}

export function canEditProject(role: string | undefined, status: string): boolean {
  if (!canCreateProject(role)) return false;
  return ["DRAFT", "COMPUTED", "REJECTED"].includes(status);
}
