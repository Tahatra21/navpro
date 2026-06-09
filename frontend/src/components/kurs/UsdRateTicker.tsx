"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

function formatIdr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type TickerItem = { id: string; node: ReactNode };

export function UsdRateTicker() {
  const backendOnline = useAuthStore((s) => s.backendOnline);

  const { data } = useQuery({
    queryKey: ["exchange-rate-ticker"],
    queryFn: () => navproApi.getExchangeRate(),
    enabled: backendOnline === true,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (backendOnline !== true || data?.rate == null) return null;

  const changePct = data.change_percent;
  const changeUp = changePct != null && changePct > 0;
  const changeDown = changePct != null && changePct < 0;
  const pctLabel = formatPct(changePct);

  const segments: TickerItem[] = [
    {
      id: "rate",
      node: (
        <>
          <DollarSign className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="font-semibold text-foreground">USD/IDR</span>
          <span className="tabular-nums font-bold text-primary">Rp {formatIdr(data.rate)}</span>
        </>
      ),
    },
  ];

  if (pctLabel) {
    segments.push({
      id: "change",
      node: (
        <>
          {changeUp ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          ) : changeDown ? (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
          ) : null}
          <span className={cn(changeUp && "text-emerald-700", changeDown && "text-destructive")}>
            {pctLabel} vs hari sebelumnya
          </span>
        </>
      ),
    });
  }

  if (data.source) {
    segments.push({
      id: "source",
      node: (
        <span>
          Sumber: <span className="font-medium text-foreground">{data.source}</span>
          {data.auto_sync_enabled ? " · auto-sync aktif" : ""}
        </span>
      ),
    });
  }

  const updated = formatRelative(data.updated_at);
  if (updated) {
    segments.push({ id: "updated", node: <span>Diperbarui {updated}</span> });
  }

  if (data.pending_rate != null) {
    segments.push({
      id: "pending",
      node: (
        <span className="text-amber-800 font-medium">
          Pending approval: Rp {formatIdr(data.pending_rate)}
          {data.pending_delta_percent != null ? ` (${formatPct(data.pending_delta_percent)})` : ""}
        </span>
      ),
    });
  }

  const eur = data.master_rates?.EUR;
  const sgd = data.master_rates?.SGD;
  if (eur != null) {
    segments.push({
      id: "eur",
      node: <span>EUR/IDR Rp {formatIdr(eur)}</span>,
    });
  }
  if (sgd != null) {
    segments.push({
      id: "sgd",
      node: <span>SGD/IDR Rp {formatIdr(sgd)}</span>,
    });
  }

  segments.push({
    id: "link",
    node: (
      <Link href="/kurs-usd" className="font-semibold text-primary hover:underline">
        Lihat historis & grafik kurs →
      </Link>
    ),
  });

  const renderTrack = (keyPrefix: string) =>
    segments.map((seg, i) => (
      <span
        key={`${keyPrefix}-${seg.id}`}
        className="inline-flex shrink-0 items-center gap-2 px-6 text-xs text-muted-foreground"
      >
        {seg.node}
        {i < segments.length - 1 ? (
          <span className="text-border select-none" aria-hidden>
            •
          </span>
        ) : null}
      </span>
    ));

  return (
    <div
      className="relative border-b border-primary/15 bg-gradient-to-r from-primary/5 via-background to-primary/5"
      role="region"
      aria-label="Informasi kurs USD"
    >
      <div className="mx-auto flex max-w-[1400px] items-stretch gap-0 px-4 sm:px-6">
        <div className="hidden sm:flex shrink-0 items-center border-r border-primary/15 pr-3 mr-1 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <DollarSign className="h-3 w-3" />
            FX Live
          </span>
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden py-2.5">
          {/* Static fallback when user prefers reduced motion */}
          <div className="motion-reduce:flex hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {segments.map((seg) => (
              <span key={seg.id} className="inline-flex items-center gap-1.5">
                {seg.node}
              </span>
            ))}
          </div>

          {/* Marquee for default motion */}
          <div className="motion-reduce:hidden flex w-max animate-usd-ticker hover:[animation-play-state:paused]">
            {renderTrack("a")}
            {renderTrack("b")}
          </div>
        </div>

        <Link
          href="/kurs-usd"
          className="hidden md:inline-flex shrink-0 items-center self-center py-2 pl-3 text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Detail
        </Link>
      </div>
    </div>
  );
}
