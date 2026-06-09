"use client";

import { cn } from "@/lib/utils";

const VARIANTS = {
  success: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-900 border-amber-500/30",
  muted: "bg-muted text-muted-foreground border-border",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  info: "bg-primary/10 text-primary border-primary/25",
} as const;

type Variant = keyof typeof VARIANTS;

type Props = {
  label: string;
  variant?: Variant;
  className?: string;
};

export function AdminStatusBadge({ label, variant = "muted", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        VARIANTS[variant],
        className
      )}
    >
      {label}
    </span>
  );
}

export function activeBadge(isActive: boolean) {
  return isActive ? (
    <AdminStatusBadge label="Aktif" variant="success" />
  ) : (
    <AdminStatusBadge label="Nonaktif" variant="muted" />
  );
}
