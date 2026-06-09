"use client";

import type { ReactNode } from "react";
import { AdminPanelCard } from "@/components/admin/AdminPanelCard";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/** Collapsible admin section — wrapper tipis di atas AdminPanelCard */
export function AdminSection({ title, description, children, defaultOpen = true, className }: Props) {
  return (
    <AdminPanelCard
      title={title}
      description={description}
      collapsible
      defaultOpen={defaultOpen}
      accent="muted"
      className={className}
    >
      {children}
    </AdminPanelCard>
  );
}

type ToolbarProps = {
  children: ReactNode;
  className?: string;
};

/** @deprecated Gunakan AdminFilterBar — dipertahankan untuk kompatibilitas import */
export function AdminToolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={
        className ??
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      }
    >
      {children}
    </div>
  );
}
