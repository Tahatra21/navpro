import type { CashflowPeriod } from "@/types/navpro";
import { cn } from "@/lib/utils";

type Props = {
  periods: CashflowPeriod[];
  maxPeriods?: number;
  className?: string;
  /** lebar viewBox */
  width?: number;
  height?: number;
};

/** Mini cumulative cashflow line — untuk Executive Summary */
export function CashflowSparkline({
  periods,
  maxPeriods = 24,
  className,
  width = 140,
  height = 40,
}: Props) {
  const sorted = [...(periods || [])]
    .sort((a, b) => a.period_number - b.period_number)
    .slice(0, maxPeriods);

  if (sorted.length < 2) return null;

  const values = sorted.map((p) => p.cumulative_cashflow ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = values[values.length - 1];
  const positive = last >= 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full max-w-[140px] h-10", className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={positive ? "hsl(var(--chart-1))" : "hsl(var(--destructive))"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
