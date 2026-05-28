"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricHint({
  label,
  help,
  className,
}: {
  label: string;
  help: string;
  className?: string;
}) {
  return (
    <details className={cn("relative inline-block", className)}>
      <summary
        className="list-none cursor-pointer rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
        aria-label={`Penjelasan ${label}`}
      >
        <Info className="h-3.5 w-3.5" />
      </summary>
      <div
        role="tooltip"
        className="absolute z-20 right-0 top-full mt-1 w-56 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md leading-relaxed"
      >
        {help}
      </div>
    </details>
  );
}
