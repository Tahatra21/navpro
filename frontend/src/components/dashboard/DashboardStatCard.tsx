import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardStatCard({
  label,
  value,
  sub,
  icon: Icon,
  cardClass,
  iconClass,
  isText,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  cardClass?: string;
  iconClass?: string;
  isText?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm flex gap-3 min-h-[88px]", cardClass)}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
        <p className={cn("font-bold text-foreground mt-0.5 tabular-nums", isText ? "text-lg" : "text-2xl")}>
          {value}
        </p>
        {sub ? <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sub}</p> : null}
      </div>
    </div>
  );
}
