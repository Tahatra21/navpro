import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draf", className: "bg-muted text-muted-foreground border-border" },
  COMPUTED: { label: "Terhitung", className: "bg-primary/10 text-primary border-primary/20" },
  SUBMITTED: { label: "Diajukan", className: "bg-secondary/10 text-secondary border-secondary/20" },
  UNDER_REVIEW: { label: "Review", className: "bg-primary/10 text-primary border-primary/20" },
  IN_REVIEW_ASMAN: { label: "Review Asman", className: "bg-amber-500/10 text-amber-800 border-amber-500/30" },
  IN_REVIEW_MANAGER: { label: "Review Manager", className: "bg-primary/10 text-primary border-primary/20" },
  APPROVED: { label: "Disetujui", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  APPROVED_L1: { label: "L1 Disetujui", className: "bg-primary/15 text-primary border-primary/30" },
  APPROVED_FINAL: { label: "Disetujui Final", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  REJECTED: { label: "Ditolak", className: "bg-destructive/10 text-destructive border-destructive/20" },
  ARCHIVED: { label: "Arsip", className: "bg-muted text-muted-foreground border-border" },
  CANCELLED: { label: "Dibatalkan", className: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  return (
    <span
      className={cn(
        "inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
