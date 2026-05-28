import { cn } from "@/lib/utils";
import type { Conclusion } from "@/types/navpro";

const CONFIG: Record<string, { label: string; className: string }> = {
  LAYAK: { label: "LAYAK", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
  BERSYARAT: { label: "BERSYARAT", className: "bg-amber-500/15 text-amber-800 border-amber-500/40" },
  TIDAK_LAYAK: { label: "TIDAK LAYAK", className: "bg-destructive/15 text-destructive border-destructive/40" },
};

export function ConclusionBadge({ conclusion }: { conclusion?: Conclusion | string }) {
  if (!conclusion) return <span className="text-muted-foreground text-sm">—</span>;
  const config = CONFIG[conclusion] || CONFIG.TIDAK_LAYAK;
  return (
    <span
      className={cn(
        "inline-flex px-3 py-1 text-xs font-bold tracking-wide rounded-full border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
