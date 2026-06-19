import {
  LayoutDashboard,
  FolderKanban,
  CheckCircle2,
  Settings,
  DollarSign,
  FileSpreadsheet,
  ClipboardCheck,
  PlusCircle,
  Calculator,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  canCreateProject,
  canViewAdmin,
  canViewApprovals,
  canViewHjtApprovals,
  canViewHjtQuotations,
} from "@/lib/rbac";

export type NavChildItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: (role?: string) => boolean;
};

export type NavLinkItem = {
  type: "link";
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  roles?: (role?: string) => boolean;
};

export type NavMenuItem = {
  type: "menu";
  id: "kkf" | "hjt";
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  children: NavChildItem[];
};

export type NavEntry = NavLinkItem | NavMenuItem;

export const NAV_ENTRIES: NavEntry[] = [
  {
    type: "link",
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard",
  },
  {
    type: "menu",
    id: "kkf",
    label: "KKF",
    shortLabel: "KKF",
    icon: FolderKanban,
    match: (p) => p.startsWith("/projects") || p.startsWith("/approvals"),
    children: [
      {
        href: "/projects/new",
        label: "Create KKF",
        icon: PlusCircle,
        roles: canCreateProject,
      },
      {
        href: "/approvals",
        label: "Approval KKF",
        icon: CheckCircle2,
        roles: canViewApprovals,
      },
    ],
  },
  {
    type: "menu",
    id: "hjt",
    label: "HJT",
    shortLabel: "HJT",
    icon: FileSpreadsheet,
    match: (p) => p.startsWith("/hjt"),
    children: [
      {
        href: "/hjt/quotations",
        label: "Calc HJT",
        icon: Calculator,
        roles: canViewHjtQuotations,
      },
      {
        href: "/hjt/approvals",
        label: "Approval HJT",
        icon: ClipboardCheck,
        roles: canViewHjtApprovals,
      },
    ],
  },
  {
    type: "link",
    href: "/kurs-usd",
    label: "Kurs USD",
    shortLabel: "Kurs",
    icon: DollarSign,
    match: (p) => p.startsWith("/kurs-usd"),
  },
  {
    type: "link",
    href: "/admin",
    label: "Admin",
    shortLabel: "Admin",
    icon: Settings,
    match: (p) => p.startsWith("/admin"),
    roles: canViewAdmin,
  },
];

function filterChildren(children: NavChildItem[], role?: string): NavChildItem[] {
  return children.filter((c) => !c.roles || c.roles(role));
}

export function filterNavEntries(role?: string): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => {
    if (entry.type === "link") {
      return !entry.roles || entry.roles(role);
    }
    return filterChildren(entry.children, role).length > 0;
  }).map((entry) => {
    if (entry.type === "menu") {
      return { ...entry, children: filterChildren(entry.children, role) };
    }
    return entry;
  });
}
