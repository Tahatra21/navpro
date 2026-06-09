"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { navproApi } from "@/services/api";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";

function fmtIdr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
}

export function ExchangeRateAdminPanel() {
  const toast = useToast();
  const qc = useQueryClient();

  const current = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => navproApi.getExchangeRate(),
  });

  const syncLog = useQuery({
    queryKey: ["exchange-rate-sync-log"],
    queryFn: () => navproApi.getExchangeRateSyncLog(5),
  });

  const syncMut = useMutation({
    mutationFn: (force?: boolean) => navproApi.syncExchangeRate(force),
    onSuccess: (data) => {
      toast.success(`Kurs diperbarui: ${fmtIdr(data.rate)}`);
      qc.invalidateQueries({ queryKey: ["exchange-rate"] });
      qc.invalidateQueries({ queryKey: ["exchange-rate-history"] });
      qc.invalidateQueries({ queryKey: ["exchange-rate-sync-log"] });
      qc.invalidateQueries({ queryKey: ["admin-assumptions"] });
    },
    onError: (e: Error) => toast.error(e.message || "Sync gagal."),
  });

  const settingsMut = useMutation({
    mutationFn: (enabled: boolean) => navproApi.patchExchangeRateSettings(enabled),
    onSuccess: () => {
      toast.success("Pengaturan auto sync disimpan.");
      qc.invalidateQueries({ queryKey: ["exchange-rate"] });
      qc.invalidateQueries({ queryKey: ["admin-assumptions"] });
    },
    onError: (e: Error) => toast.error(e.message || "Gagal menyimpan pengaturan."),
  });

  const rate = current.data;
  const autoOn = rate?.auto_sync_enabled !== false;

  return (
    <Card className="p-4 mb-4 border-primary/20 bg-primary/5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Kurs USD — Auto Sync</p>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                autoOn
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {autoOn ? "Auto ON" : "Auto OFF"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Kurs aktif: <span className="font-semibold text-foreground">{fmtIdr(rate?.rate ?? null)}</span>
            {rate?.source ? ` · ${rate.source}` : ""}
            {rate?.rate_date ? ` · ${rate.rate_date}` : ""}
          </p>
          {rate?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Terakhir di-update: {new Date(rate.updated_at).toLocaleString("id-ID")}
            </p>
          )}
          <Link href="/kurs-usd" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Lihat historis lengkap <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={syncMut.isPending}
            onClick={() => syncMut.mutate(!autoOn)}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1.5", syncMut.isPending && "animate-spin")} />
            Sync sekarang
          </Button>
          <Button
            variant={autoOn ? "secondary" : "default"}
            size="sm"
            disabled={settingsMut.isPending}
            onClick={() => settingsMut.mutate(!autoOn)}
          >
            {autoOn ? "Matikan auto sync" : "Aktifkan auto sync"}
          </Button>
        </div>
      </div>

      {syncLog.data?.items && syncLog.data.items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Sync log (5 terakhir)
          </p>
          <div className="space-y-1">
            {syncLog.data.items.map((row) => (
              <div key={row.id} className="text-xs flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                <span>{new Date(row.fetched_at).toLocaleString("id-ID")}</span>
                <span>{row.sync_mode}</span>
                <span>{row.applied ? fmtIdr(row.rate) : "gagal"}</span>
                {!row.applied && row.error_message && (
                  <span className="text-destructive">{row.error_message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
