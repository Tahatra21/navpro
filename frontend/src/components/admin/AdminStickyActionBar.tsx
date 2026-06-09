"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Sticky footer inside admin content panel for primary actions (Simpan, dll.) */
export function AdminStickyActionBar({ children, className }: Props) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-5 mt-8 border-t border-border/60 bg-card px-5 py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
