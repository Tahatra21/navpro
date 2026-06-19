"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HjtProduct } from "@/types/hjt";
import { cn } from "@/lib/utils";

type Props = {
  products: HjtProduct[];
  value: number;
  disabled?: boolean;
  onChange: (productId: number) => void;
  onSearch?: (query: string) => Promise<HjtProduct[]>;
};

export function HjtProductCombobox({
  products,
  value,
  disabled,
  onChange,
  onSearch,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remoteProducts, setRemoteProducts] = useState<HjtProduct[] | null>(null);
  const [searching, setSearching] = useState(false);

  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    if (!open) {
      setQ("");
      setRemoteProducts(null);
      return;
    }
    if (!onSearch) return;
    const needle = q.trim();
    if (needle.length < 2) {
      setRemoteProducts(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        setRemoteProducts(await onSearch(needle));
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, open, onSearch]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const source = remoteProducts ?? products;
    if (!needle) return source;
    return source.filter(
      (p) =>
        p.product_name.toLowerCase().includes(needle) ||
        p.product_family.toLowerCase().includes(needle)
    );
  }, [products, q, remoteProducts]);

  const grouped = useMemo(() => {
    const map = new Map<string, HjtProduct[]>();
    for (const p of filtered) {
      const family = p.product_family || "Lainnya";
      const list = map.get(family) ?? [];
      list.push(p);
      map.set(family, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "id"));
  }, [filtered]);

  function pick(productId: number) {
    onChange(productId);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex h-9 w-full min-w-[200px] max-w-[320px] items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-xs transition-colors",
          "hover:border-primary/40 hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-60",
          selected && "border-primary/30 bg-primary/5"
        )}
      >
        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <>
              <span className="font-medium text-foreground">{selected.product_name}</span>
              <span className="text-muted-foreground"> · {selected.product_family}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Pilih produk…</span>
          )}
        </span>
        {!disabled ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Cari
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Pilih Produk HJT</DialogTitle>
            <DialogDescription>
              Katalog kepdir — {products.length} produk. HPP Backbone/Uplink terisi otomatis setelah dipilih.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-3 border-b shrink-0 bg-muted/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ketik nama produk atau family…"
                className="h-10 pl-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {searching
                ? "Mencari…"
                : filtered.length === 0
                  ? "Tidak ada produk cocok."
                  : `${filtered.length} produk ditampilkan`}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
            {grouped.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Tidak ada produk ditemukan.
              </p>
            ) : (
              grouped.map(([family, items]) => (
                <div key={family} className="mb-3 last:mb-0">
                  <p className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/95 backdrop-blur-sm border-b border-border/50">
                    {family}
                    <span className="ml-1 font-normal normal-case">({items.length})</span>
                  </p>
                  <ul className="divide-y divide-border/40">
                    {items.map((p) => {
                      const active = p.id === value;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => pick(p.id)}
                            className={cn(
                              "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors rounded-md",
                              "hover:bg-accent/60",
                              active && "bg-primary/10 ring-1 ring-primary/20"
                            )}
                          >
                            <span className="flex-1 min-w-0">
                              <span className="font-medium text-foreground block leading-snug">
                                {p.product_name}
                              </span>
                              {p.unit_default ? (
                                <span className="text-[11px] text-muted-foreground">
                                  Satuan default: {p.unit_default}
                                </span>
                              ) : null}
                            </span>
                            {active ? (
                              <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="px-5 py-3 border-t shrink-0 flex justify-end bg-muted/10">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
