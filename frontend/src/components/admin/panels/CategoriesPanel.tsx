"use client";

import { useMemo, useState } from "react";
import { Layers, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminFilterBar,
  AdminPanelAlert,
  AdminPanelCard,
  AdminPanelSkeleton,
} from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { navproApi } from "@/services/api";
import type { CategoryRow } from "./types";

type Props = {
  capex: unknown;
  opex: unknown;
  loading: boolean;
  onRefresh: () => void;
};

export function CategoriesPanel({ capex, opex, loading, onRefresh }: Props) {
  const capexList = (capex as { categories?: string[] })?.categories || [];
  const opexList = (opex as { categories?: string[] })?.categories || [];
  const [capexCode, setCapexCode] = useState("");
  const [opexCode, setOpexCode] = useState("");
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const allRows: CategoryRow[] = useMemo(
    () => [
      ...capexList.map((code) => ({ type: "CAPEX" as const, code })),
      ...opexList.map((code) => ({ type: "OPEX" as const, code })),
    ],
    [capexList, opexList]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => r.code.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  }, [allRows, filter]);

  if (loading) return <AdminPanelSkeleton cards={2} />;

  const add = async (type: "capex" | "opex") => {
    setErr("");
    setOk("");
    setBusy(true);
    try {
      const code = (type === "capex" ? capexCode : opexCode).trim().toUpperCase();
      if (!code) throw new Error("Kode kategori wajib diisi.");
      if (type === "capex") await navproApi.adminAddCapexCategory(code);
      else await navproApi.adminAddOpexCategory(code);
      if (type === "capex") setCapexCode("");
      else setOpexCode("");
      setOk("Kategori ditambahkan.");
      onRefresh();
      setTimeout(() => setOk(""), 2000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menambah kategori.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <div className="relative sm:max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari kode kategori…"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
          Refresh
        </Button>
      </AdminFilterBar>

      {err ? <AdminPanelAlert variant="error">{err}</AdminPanelAlert> : null}
      {ok ? <AdminPanelAlert variant="success">{ok}</AdminPanelAlert> : null}

      <AdminPanelCard
        title="Tambah kategori"
        description="Kode CAPEX atau OPEX untuk wizard proyek"
        icon={Plus}
        accent="emerald"
        collapsible
        defaultOpen={false}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-2">
            <Input
              value={capexCode}
              onChange={(e) => setCapexCode(e.target.value.toUpperCase())}
              placeholder="Kode CAPEX"
            />
            <Button onClick={() => add("capex")} disabled={busy}>
              + CAPEX
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              value={opexCode}
              onChange={(e) => setOpexCode(e.target.value.toUpperCase())}
              placeholder="Kode OPEX"
            />
            <Button onClick={() => add("opex")} disabled={busy}>
              + OPEX
            </Button>
          </div>
        </div>
      </AdminPanelCard>

      <AdminPanelCard
        title="Daftar kategori"
        description="Semua kode CAPEX & OPEX terdaftar"
        icon={Layers}
        accent="primary"
        badge={`${filtered.length} kategori`}
      >
        <AdminDataTable
          columns={[
            {
              id: "type",
              header: "Tipe",
              cell: (r) => (
                <AdminStatusBadge label={r.type} variant={r.type === "CAPEX" ? "info" : "success"} />
              ),
            },
            {
              id: "code",
              header: "Kode",
              cell: (r) => <span className="font-mono font-medium">{r.code}</span>,
            },
          ]}
          data={filtered}
          getRowKey={(r) => `${r.type}-${r.code}`}
          pageSize={12}
          resetKey={filter}
          emptyTitle="Belum ada kategori"
          emptyDescription="Tambah kode CAPEX atau OPEX di atas."
        />
      </AdminPanelCard>
    </div>
  );
}
