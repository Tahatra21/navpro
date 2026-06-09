"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ExternalLink, Coins, History, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navproApi } from "@/services/api";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import { wibDateOffsetDays } from "@/lib/wib-date";
import { useState } from "react";
import {
  AdminPanelAlert,
  AdminPanelCard,
  AdminPanelSkeleton,
} from "@/components/admin/AdminPanelCard";

function fmtIdr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
}

type Props = {
  /** Full-width layout for dedicated admin tab (not embedded in Asumsi Master) */
  standalone?: boolean;
};

export function ExchangeRateAdminPanel({ standalone = false }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [backfillFrom, setBackfillFrom] = useState(() => wibDateOffsetDays(-90));
  const [backfillTo, setBackfillTo] = useState(() => wibDateOffsetDays(0));

  const current = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => navproApi.getExchangeRate(),
  });

  const syncLog = useQuery({
    queryKey: ["exchange-rate-sync-log"],
    queryFn: () => navproApi.getExchangeRateSyncLog(5),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["exchange-rate"] });
    qc.invalidateQueries({ queryKey: ["exchange-rate-history"] });
    qc.invalidateQueries({ queryKey: ["exchange-rate-sync-log"] });
    qc.invalidateQueries({ queryKey: ["admin-assumptions"] });
    qc.invalidateQueries({ queryKey: ["wizard-config"] });
  };

  const syncMut = useMutation({
    mutationFn: (force?: boolean) => navproApi.syncExchangeRate(force),
    onSuccess: (data) => {
      if (data.pending_approval) {
        toast.success(`Kurs menunggu persetujuan (${data.delta_percent?.toFixed(2)}% perubahan).`);
      } else if (data.applied) {
        toast.success(`Kurs diperbarui: ${fmtIdr(data.rate)}`);
      } else {
        toast.info(`Kurs tidak berubah (${fmtIdr(data.rate)}).`);
      }
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message || "Sync gagal."),
  });

  const approveMut = useMutation({
    mutationFn: () => navproApi.approvePendingExchangeRate(),
    onSuccess: (data) => {
      toast.success(`Kurs disetujui: ${fmtIdr(data.rate)}`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message || "Gagal menyetujui."),
  });

  const rejectMut = useMutation({
    mutationFn: () => navproApi.rejectPendingExchangeRate(),
    onSuccess: () => {
      toast.success("Kurs pending ditolak.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message || "Gagal menolak."),
  });

  const backfillMut = useMutation({
    mutationFn: () => navproApi.backfillExchangeRate(backfillFrom, backfillTo),
    onSuccess: (data) => {
      toast.success(`Backfill BI: ${data.inserted} baris (${data.from} – ${data.to}).`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message || "Backfill gagal."),
  });

  const settingsMut = useMutation({
    mutationFn: (enabled: boolean) => navproApi.patchExchangeRateSettings(enabled),
    onSuccess: () => {
      toast.success("Pengaturan auto sync disimpan.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message || "Gagal menyimpan pengaturan."),
  });

  const rate = current.data;
  const autoOn = rate?.auto_sync_enabled !== false;
  const hasPending = rate?.pending_rate != null;

  if (current.isLoading) {
    return standalone ? <AdminPanelSkeleton cards={2} /> : <div className="h-32 animate-pulse rounded-xl bg-muted/40" />;
  }

  const statusGrid = (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Kurs USD aktif</p>
        <p className="mt-1 text-lg font-semibold">{fmtIdr(rate?.rate ?? null)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {rate?.source?.replace(/_/g, " ") || "—"} · {rate?.rate_date || "—"}
        </p>
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Auto sync</p>
        <p className={cn("mt-1 text-lg font-semibold", autoOn ? "text-emerald-700" : "text-muted-foreground")}>
          {autoOn ? "Aktif" : "Nonaktif"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Scheduler 09:00 WIB</p>
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Terakhir update</p>
        <p className="mt-1 text-sm font-medium">
          {rate?.updated_at ? new Date(rate.updated_at).toLocaleString("id-ID") : "—"}
        </p>
        <Link href="/kurs-usd" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Historis lengkap <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      {hasPending ? (
        <>
          <Button size="sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate()}>
            Setujui kurs
          </Button>
          <Button variant="outline" size="sm" disabled={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
            Tolak
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" disabled={syncMut.isPending} onClick={() => syncMut.mutate(!autoOn)}>
          <RefreshCw className={cn("mr-1.5 h-4 w-4", syncMut.isPending && "animate-spin")} />
          Sync sekarang
        </Button>
      )}
      <Button
        variant={autoOn ? "secondary" : "default"}
        size="sm"
        disabled={settingsMut.isPending}
        onClick={() => settingsMut.mutate(!autoOn)}
      >
        {autoOn ? "Matikan auto sync" : "Aktifkan auto sync"}
      </Button>
    </div>
  );

  const pendingBanner = hasPending ? (
    <AdminPanelAlert variant="warning">
      Menunggu persetujuan: <strong>{fmtIdr(rate?.pending_rate)}</strong> ({rate?.pending_delta_percent?.toFixed(2)}%
      perubahan)
    </AdminPanelAlert>
  ) : null;

  const advancedSections = standalone ? (
    <>
      <AdminPanelCard
        title="Backfill BI JISDOR"
        description="Isi historis dari Bank Indonesia"
        icon={Download}
        accent="sky"
        collapsible
        defaultOpen={false}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Dari</Label>
            <Input
              type="date"
              value={backfillFrom}
              onChange={(e) => setBackfillFrom(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai</Label>
            <Input
              type="date"
              value={backfillTo}
              onChange={(e) => setBackfillTo(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <Button variant="outline" size="sm" disabled={backfillMut.isPending} onClick={() => backfillMut.mutate()}>
            {backfillMut.isPending ? "Memuat…" : "Jalankan backfill"}
          </Button>
        </div>
      </AdminPanelCard>

      {syncLog.data?.items && syncLog.data.items.length > 0 ? (
        <AdminPanelCard
          title="Log sync"
          description="5 percobaan terakhir"
          icon={History}
          accent="muted"
          collapsible
          defaultOpen={false}
          badge={`${syncLog.data.items.length} entri`}
        >
          <div className="space-y-2">
            {syncLog.data.items.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border/40 pb-2 text-xs last:border-0 last:pb-0"
              >
                <span className="text-muted-foreground">{new Date(row.fetched_at).toLocaleString("id-ID")}</span>
                <span>{row.sync_mode}</span>
                <span className="font-medium">{row.applied ? fmtIdr(row.rate) : row.error_message || "gagal"}</span>
              </div>
            ))}
          </div>
        </AdminPanelCard>
      ) : null}
    </>
  ) : null;

  const mainCard = (
    <AdminPanelCard
      title="Kurs USD — Auto Sync"
      description="Sinkronisasi kurs dari BI JISDOR dan persetujuan perubahan"
      icon={Coins}
      accent="sky"
      headerAction={standalone ? undefined : actions}
    >
      <div className="space-y-4">
        {statusGrid}
        {pendingBanner}
        {standalone ? actions : null}
      </div>
    </AdminPanelCard>
  );

  if (standalone) {
    return (
      <div className="space-y-4">
        {mainCard}
        {advancedSections}
      </div>
    );
  }

  return <div className="mb-4">{mainCard}</div>;
}
