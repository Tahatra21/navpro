"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatIdNumber, parseIdNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

/** Numeric input with Indonesian thousand separators (format on blur). */
export function IdNumberInput({ value, onChange, className, disabled, placeholder, id }: Props) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    setDisplay(value);
  }, [value]);

  return (
    <Input
      id={id}
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      className={cn("tabular-nums", className)}
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,\s]/g, "");
        setDisplay(raw);
        onChange(raw);
      }}
      onBlur={() => {
        const n = parseIdNumber(display);
        const formatted = n !== 0 || display.replace(/\D/g, "") === "0" ? formatIdNumber(n) : "";
        setDisplay(formatted);
        onChange(formatted);
      }}
    />
  );
}
