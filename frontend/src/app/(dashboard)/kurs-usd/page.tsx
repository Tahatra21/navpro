"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Download, RefreshCw } from "lucide-react";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { UsdRateHistoryTable, exportHistoryCsv } from "@/components/kurs/UsdRateHistoryTable";
import { UsdRateChart } from "@/components/kurs/UsdRateChart";
import { FX_CURRENCIES, type FxCurrency } from "@/lib/exchange-rate";
import { cn } from "@/lib/utils";
import { wibDateOffsetDays } from "@/lib/wib-date";

function fmtIdr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
}

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2).replace(".", ",")}%`;
}

const PRESETS = [
  { label: "30 hari", days: 30 },
  { label: "90 hari", days: 90 },
  { label: "180 hari", days: 180 },
  { label: "365 hari", days: 365 },
];

export default function KursUsdPage() {
  const backendOnline = useAuthStore((s) => s.backendOnline);
  const today = useMemo(() => wibDateOffsetDays(0), []);
  const [from, setFrom] = useState(() => wibDateOffsetDays(-30));
  const [to, setTo] = useState(today);
  const [limit, setLimit] = useState(90);
  const [currency, setCurrency] = useState<FxCurrency>("USD");

  const current = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => navproApi.getExchangeRate(),
    enabled: backendOnline === true,
    staleTime: 5 * 60 * 1000,
  });

  const history = useQuery({
    queryKey: ["exchange-rate-history", from, to, limit, currency],
    queryFn: () => navproApi.getExchangeRateHistory({ from, to, limit, order: "desc", currency }),
    enabled: backendOnline === true,
  });

  const rate = current.data;
  const items = history.data?.items || [];

  const applyPreset = (days: number) => {
    setFrom(wibDateOffsetDays(-days));
    setTo(today);
    setLimit(Math.min(days + 5, 365));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Kurs Valas / IDR</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Historis kurs harian USD, EUR, dan SGD untuk seluruh pengguna NAVPRO.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FX_CURRENCIES.map((c) => (
          <Button
            key={c}
            variant={currency === c ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrency(c)}
          >
            {c}/IDR
          </Button>
        ))}
      </div>

      <Card className="p-5">
        {current.isLoading ? (
          <div className="animate-pulse h-16 bg-muted/50 rounded" />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kurs hari ini</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{fmtIdr(rate?.rate)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {rate?.change_amount != null && (
                  <span
                    className={cn(
                      "font-medium mr-2",
                      rate.change_amount > 0 ? "text-emerald-600" : rate.change_amount < 0 ? "text-red-600" : ""
                    )}
                  >
                    {rate.change_amount > 0 ? "+" : ""}
                    {new Intl.NumberFormat("id-ID").format(rate.change_amount)} ({fmtPct(rate.change_percent)})
                  </span>
                )}
                {rate?.source && <span>· {rate.source}</span>}
                {rate?.rate_date && <span> · {rate.rate_date}</span>}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                current.refetch();
                history.refetch();
              }}
              disabled={current.isFetching || history.isFetching}
            >
              <RefreshCw
                className={cn("w-4 h-4 mr-1.5", (current.isFetching || history.isFetching) && "animate-spin")}
              />
              Muat ulang
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.days} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 lg:ml-auto">
            <div className="space-y-1">
              <Label className="text-xs">Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="self-end"
              disabled={items.length === 0}
              onClick={() => exportHistoryCsv(items)}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>

        <UsdRateChart items={items} loading={history.isLoading} />

        {history.isError && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            Gagal memuat historis.{" "}
            <button type="button" className="underline" onClick={() => history.refetch()}>
              Coba lagi
            </button>
          </p>
        )}

        <UsdRateHistoryTable items={items} loading={history.isLoading} />

        {history.data?.summary && history.data.summary.count > 0 && (
          <p className="text-xs text-muted-foreground">
            {history.data.summary.count} baris · min {fmtIdr(history.data.summary.min_rate)} · max{" "}
            {fmtIdr(history.data.summary.max_rate)}
          </p>
        )}
      </Card>
    </div>
  );
}
