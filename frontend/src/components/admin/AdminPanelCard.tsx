"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AdminPanelAccent = "primary" | "amber" | "violet" | "sky" | "emerald" | "muted";

const ACCENT_BORDER: Record<AdminPanelAccent, string> = {
  primary: "border-l-primary",
  amber: "border-l-amber-500",
  violet: "border-l-violet-500",
  sky: "border-l-sky-500",
  emerald: "border-l-emerald-500",
  muted: "border-l-muted-foreground/40",
};

const ACCENT_ICON: Record<AdminPanelAccent, string> = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-700",
  violet: "bg-violet-500/10 text-violet-700",
  sky: "bg-sky-500/10 text-sky-700",
  emerald: "bg-emerald-500/10 text-emerald-700",
  muted: "bg-muted text-muted-foreground",
};

type PanelCardProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  accent?: AdminPanelAccent;
  className?: string;
  contentClassName?: string;
  headerAction?: ReactNode;
};

export function AdminPanelCard({
  title,
  description,
  icon: Icon,
  badge,
  children,
  collapsible = false,
  defaultOpen = true,
  accent = "primary",
  className,
  contentClassName,
  headerAction,
}: PanelCardProps) {
  const headerInner = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {Icon ? (
        <div className={cn("rounded-lg p-2.5 shrink-0", ACCENT_ICON[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? <CardDescription className="mt-0.5">{description}</CardDescription> : null}
      </div>
      {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      {collapsible ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      ) : null}
    </div>
  );

  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={cn(
          "group rounded-xl border border-border/70 bg-card shadow-sm border-l-4 open:shadow-md",
          ACCENT_BORDER[accent],
          className
        )}
      >
        <summary className="flex cursor-pointer list-none items-center px-5 py-4 [&::-webkit-details-marker]:hidden">
          {headerInner}
        </summary>
        <div className={cn("border-t border-border/60 px-5 pb-5 pt-4", contentClassName)}>{children}</div>
      </details>
    );
  }

  return (
    <Card className={cn("border-border/70 shadow-sm border-l-4", ACCENT_BORDER[accent], className)}>
      <CardHeader className="pb-3">
        {headerInner}
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function AdminFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/70 shadow-sm", className)}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {children}
      </CardContent>
    </Card>
  );
}

export function AdminPanelSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
      ))}
    </div>
  );
}

export function AdminPanelAlert({
  variant,
  children,
}: {
  variant: "error" | "success" | "warning";
  children: ReactNode;
}) {
  const styles =
    variant === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : variant === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
        : "border-amber-500/30 bg-amber-500/10 text-amber-900";

  return <p className={cn("rounded-lg border px-3 py-2.5 text-sm", styles)}>{children}</p>;
}

/** Select styling seragam di panel admin */
export const adminSelectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";
