"use client";

import { useQuery } from "@tanstack/react-query";
import { navproApi } from "@/services/api";
import { cn } from "@/lib/utils";

function fmtIdr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
}

type Props = {
  backendOnline: boolean | null;
  onGoKurs?: () => void;
};

export function AdminSummaryBar({ backendOnline, onGoKurs }: Props) {
  const rate = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => navproApi.getExchangeRate(),
    enabled: backendOnline === true,
    staleTime: 60_000,
  });

  const pending = rate.data?.pending_rate != null;
  const online = backendOnline === true;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
          online
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
            : backendOnline === false
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-background text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            online ? "bg-emerald-500" : backendOnline === false ? "bg-destructive" : "bg-muted-foreground"
          )}
        />
        {online ? "Backend online" : backendOnline === false ? "Backend offline" : "Menghubungkan…"}
      </span>

      {online && (
        <>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={onGoKurs}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted/80 transition-colors"
          >
            <span className="text-muted-foreground">USD/IDR</span>
            <span className="font-semibold text-foreground">{fmtIdr(rate.data?.rate)}</span>
          </button>

          {pending && (
            <>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={onGoKurs}
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-500/20"
              >
                1 kurs menunggu approval
              </button>
            </>
          )}

          {rate.data?.auto_sync_enabled === false && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Auto sync OFF</span>
            </>
          )}
        </>
      )}
    </div>
  );
}
