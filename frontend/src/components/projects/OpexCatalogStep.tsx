"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Search } from "lucide-react";
import type { WizardOpexRow } from "@/lib/project-mappers";
import {
  catalogToOpexDefaults,
  filterOpexCatalog,
  opexIconChar,
  type OpexCatalogItem,
  unitLabel,
} from "@/lib/opex-service-catalog";

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

const uid = () => Math.random().toString(36).slice(2, 11);

export function OpexCatalogStep({
  durationMonths,
  catalog,
  catalogLoading,
  opexRows,
  setOpexRows,
  onDirty,
  formatRpTotal,
}: {
  durationMonths: number;
  catalog: OpexCatalogItem[];
  catalogLoading: boolean;
  opexRows: WizardOpexRow[];
  setOpexRows: React.Dispatch<React.SetStateAction<WizardOpexRow[]>>;
  onDirty: () => void;
  formatRpTotal: (n: number) => string;
}) {
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [opexInput, setOpexInput] = useState({
    name: "",
    category: "LABOR",
    catalogCode: "",
    iconKey: "box",
    unit: "per_month",
    type: "NOMINAL" as "NOMINAL" | "PERCENT",
    amount: 0,
    currency: "IDR" as "IDR" | "USD",
    startPeriod: 1,
    endPeriod: durationMonths,
  });

  const filtered = useMemo(() => filterOpexCatalog(catalog, search), [catalog, search]);
  const selected = catalog.find((c) => c.code === selectedCode);

  const selectCatalogItem = (item: OpexCatalogItem) => {
    const d = catalogToOpexDefaults(item);
    setSelectedCode(item.code);
    setOpexInput((p) => ({
      ...p,
      catalogCode: d.catalogCode,
      name: d.name,
      category: d.category,
      iconKey: d.iconKey,
      unit: d.unit,
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      endPeriod: durationMonths,
    }));
  };

  const addOpex = () => {
    if (!opexInput.name.trim()) return;
    setOpexRows((p) => [
      ...p,
      {
        id: uid(),
        name: opexInput.name,
        category: opexInput.category,
        catalogCode: opexInput.catalogCode || undefined,
        iconKey: opexInput.iconKey,
        unit: opexInput.unit,
        type: opexInput.type,
        amount: opexInput.amount,
        currency: opexInput.currency,
        startPeriod: opexInput.startPeriod,
        endPeriod: opexInput.endPeriod,
      },
    ]);
    setSelectedCode("");
    setSearch("");
    setOpexInput({
      name: "",
      category: "LABOR",
      catalogCode: "",
      iconKey: "box",
      unit: "per_month",
      type: "NOMINAL",
      amount: 0,
      currency: "IDR",
      startPeriod: 1,
      endPeriod: durationMonths,
    });
    onDirty();
  };

  const totalOpex = opexRows
    .filter((r) => r.type === "NOMINAL")
    .reduce((s, r) => s + (r.currency === "IDR" ? r.amount : r.amount * 16500), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Langkah 4: OPEX — Katalog Layanan Icon+</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pilih layanan/produk dari <strong>katalog Icon+</strong>. Nominal dan kategori terisi otomatis; Anda bisa
          menyesuaikan nilai sebelum menambah ke proyek.
        </p>
      </div>

      <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
        <p className="text-xs font-semibold text-primary">Cari &amp; pilih layanan katalog</p>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kode, kategori… (mis. NOC, bandwidth)"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="max-h-36 overflow-auto rounded border border-border bg-background">
          {catalogLoading ? (
            <p className="p-3 text-xs text-muted-foreground">Memuat katalog…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Tidak ada layanan cocok.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    onClick={() => selectCatalogItem(item)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-accent/50 flex gap-2 items-start ${
                      selectedCode === item.code ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5">{opexIconChar(item.icon_key)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-foreground block truncate">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.code} · {item.category} · {unitLabel(item.unit)}
                      </span>
                    </span>
                    <span className="font-mono text-foreground shrink-0">
                      {item.default_type === "PERCENT"
                        ? `${item.default_amount}%`
                        : formatRp(item.default_amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selected && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <p className="font-semibold text-foreground">
            {opexIconChar(selected.icon_key)} {selected.name}
          </p>
          <p className="text-muted-foreground mt-0.5">{selected.description}</p>
        </div>
      )}

      <div className="bg-muted/30 border border-border rounded-lg p-3 flex flex-wrap gap-2 items-end">
        <div className="flex-[2] min-w-[140px] space-y-1">
          <Label className="text-xs">Nama biaya</Label>
          <Input
            value={opexInput.name}
            onChange={(e) => setOpexInput((p) => ({ ...p, name: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-xs">Kode katalog</Label>
          <Input value={opexInput.catalogCode} readOnly className="h-8 text-sm bg-muted/50" />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">Cara hitung</Label>
          <select
            value={opexInput.type}
            onChange={(e) =>
              setOpexInput((p) => ({ ...p, type: e.target.value as "NOMINAL" | "PERCENT" }))
            }
            className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background"
          >
            <option value="NOMINAL">Nominal</option>
            <option value="PERCENT">% Pendapatan</option>
          </select>
        </div>
        <div className="flex-1 min-w-[100px] space-y-1">
          <Label className="text-xs">{opexInput.type === "PERCENT" ? "Koef (%)" : "Nilai/bln"}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min={0}
              value={opexInput.amount}
              onChange={(e) => setOpexInput((p) => ({ ...p, amount: Number(e.target.value) }))}
              className="h-8 text-sm"
            />
            {opexInput.type === "NOMINAL" && (
              <select
                value={opexInput.currency}
                onChange={(e) =>
                  setOpexInput((p) => ({ ...p, currency: e.target.value as "IDR" | "USD" }))
                }
                className="h-8 px-1 border border-input rounded-md text-xs bg-background w-16"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
              </select>
            )}
          </div>
        </div>
        <div className="w-32 space-y-1">
          <Label className="text-xs">Periode (bln)</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min={1}
              max={durationMonths}
              value={opexInput.startPeriod}
              onChange={(e) => setOpexInput((p) => ({ ...p, startPeriod: Number(e.target.value) }))}
              className="h-8 text-sm w-14"
            />
            <Input
              type="number"
              min={1}
              max={durationMonths}
              value={opexInput.endPeriod}
              onChange={(e) => setOpexInput((p) => ({ ...p, endPeriod: Number(e.target.value) }))}
              className="h-8 text-sm w-14"
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={addOpex}
          disabled={!opexInput.name.trim()}
          className="h-8 bg-secondary text-secondary-foreground"
        >
          Tambah OPEX
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-border max-h-56">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2">Layanan Icon+</th>
              <th className="px-3 py-2">Kategori</th>
              <th className="px-3 py-2">Hitung</th>
              <th className="px-3 py-2 text-right">Baseline</th>
              <th className="px-3 py-2 text-center">Periode</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {opexRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Belum ada OPEX. Pilih layanan dari katalog di atas.
                </td>
              </tr>
            ) : (
              opexRows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-3 py-2">
                    <span className="mr-1">{opexIconChar(r.iconKey || "box")}</span>
                    {r.name}
                    {r.catalogCode && (
                      <span className="block text-muted-foreground font-mono text-[10px]">{r.catalogCode}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                  <td className="px-3 py-2">{r.type === "PERCENT" ? "% Rev" : "Nominal"}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.type === "PERCENT" ? `${r.amount}%` : r.amount.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.startPeriod}–{r.endPeriod}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpexRows((p) => p.filter((x) => x.id !== r.id));
                        onDirty();
                      }}
                      className="text-destructive p-1 rounded hover:bg-destructive/10"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-right text-sm font-bold">Total OPEX Baseline (nominal): {formatRpTotal(totalOpex)}/bln</p>
    </div>
  );
}
