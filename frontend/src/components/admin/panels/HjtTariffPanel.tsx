"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPanelCard, AdminPanelSkeleton } from "@/components/admin/AdminPanelCard";
import { navproApi } from "@/services/api";
import { useToast } from "@/components/shared/toast";
import { formatCurrency } from "@/lib/format";

type TariffRow = {
  id: string;
  product_name: string;
  region_code: string;
  backbone: number;
  uplink: number;
  vas: number;
};

export function HjtTariffPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [search, setSearch] = useState("");
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importId, setImportId] = useState<string | null>(null);
  const [newKepdir, setNewKepdir] = useState("");
  const [newEffective, setNewEffective] = useState(new Date().toISOString().slice(0, 10));

  const versions = useQuery({
    queryKey: ["hjt-admin-versions"],
    queryFn: () => navproApi.hjtListTariffVersions(),
  });

  const versionId = selectedVersion || versions.data?.versions?.[0]?.id || "";

  const tariffGrid = useQuery({
    queryKey: ["hjt-admin-tariff", versionId, search],
    queryFn: () => navproApi.hjtAdminTariffGrid({ version: versionId, q: search, limit: 100 }),
    enabled: !!versionId,
  });

  const ibbc = useQuery({
    queryKey: ["hjt-admin-ibbc", versionId],
    queryFn: () => navproApi.hjtAdminIbbc({ version: versionId }),
    enabled: !!versionId,
  });

  const overhead = useQuery({
    queryKey: ["hjt-admin-overhead", versionId],
    queryFn: () => navproApi.hjtAdminOverhead({ version: versionId }),
    enabled: !!versionId,
  });

  const preview = useQuery({
    queryKey: ["hjt-import-preview", importId],
    queryFn: () => navproApi.hjtImportPreview(importId!),
    enabled: !!importId && importStep >= 2,
  });

  const createVersion = useMutation({
    mutationFn: () =>
      navproApi.hjtAdminCreateVersion({ kepdir_ref: newKepdir, effective_date: newEffective }),
    onSuccess: () => {
      toast.success("Versi draft dibuat.");
      qc.invalidateQueries({ queryKey: ["hjt-admin-versions"] });
      setNewKepdir("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateVersion = useMutation({
    mutationFn: (id: string) => navproApi.hjtAdminActivateVersion(id),
    onSuccess: () => {
      toast.success("Versi diaktifkan.");
      qc.invalidateQueries({ queryKey: ["hjt-admin-versions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commitImport = useMutation({
    mutationFn: () => navproApi.hjtImportCommit(importId!),
    onSuccess: (data) => {
      toast.success(`Import committed: ${(data as { committed?: number }).committed ?? 0} baris.`);
      setImportStep(3);
      qc.invalidateQueries({ queryKey: ["hjt-admin-tariff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (tariffGrid.data?.items || []) as TariffRow[];
  const activeVersion = useMemo(
    () => versions.data?.versions?.find((v) => v.status === "active"),
    [versions.data?.versions]
  );

  if (versions.isLoading) return <AdminPanelSkeleton cards={3} />;

  return (
    <div className="space-y-4">
      <AdminPanelCard title="Versi Tarif Kepdir" accent="primary" icon={CheckCircle2}>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-xs">Pilih versi</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={versionId}
              onChange={(e) => setSelectedVersion(e.target.value)}
            >
              {(versions.data?.versions || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.kepdir_ref} — {v.status}
                </option>
              ))}
            </select>
          </div>
          {activeVersion ? (
            <p className="text-xs text-muted-foreground">
              Aktif: <strong>{activeVersion.kepdir_ref}</strong>
            </p>
          ) : null}
        </div>

        <div className="grid md:grid-cols-3 gap-3 border-t pt-4">
          <Input placeholder="Kepdir ref baru" value={newKepdir} onChange={(e) => setNewKepdir(e.target.value)} />
          <Input type="date" value={newEffective} onChange={(e) => setNewEffective(e.target.value)} />
          <Button
            variant="secondary"
            disabled={!newKepdir.trim() || createVersion.isPending}
            onClick={() => createVersion.mutate()}
          >
            <Plus className="w-4 h-4 mr-1" /> Buat versi draft
          </Button>
        </div>
        {versionId ? (
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            disabled={activateVersion.isPending}
            onClick={() => activateVersion.mutate(versionId)}
          >
            Aktivasi versi terpilih (draft → active)
          </Button>
        ) : null}
      </AdminPanelCard>

      <AdminPanelCard title="Grid Tarif" accent="violet">
        <div className="flex flex-wrap gap-3 mb-3">
          <Input
            placeholder="Cari produk / region…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="ghost" size="sm" onClick={() => tariffGrid.refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Produk</th>
                <th className="px-3 py-2 text-left">Region</th>
                <th className="px-3 py-2 text-right">Backbone</th>
                <th className="px-3 py-2 text-right">Uplink</th>
                <th className="px-3 py-2 text-right">VAS</th>
              </tr>
            </thead>
            <tbody>
              {tariffGrid.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Belum ada baris tarif — import Excel atau seed.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.product_name}</td>
                    <td className="px-3 py-2">{r.region_code}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.backbone)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.uplink)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vas)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanelCard>

      <AdminPanelCard title="Import Excel (3 langkah)" accent="amber" icon={Upload}>
        <ol className="text-xs text-muted-foreground mb-4 list-decimal list-inside space-y-1">
          <li>Upload file .xlsx ke versi draft</li>
          <li>Review preview validasi</li>
          <li>Commit ke master tarif</li>
        </ol>
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="outline" size="sm" onClick={() => navproApi.hjtDownloadImportTemplate()}>
            <Download className="w-4 h-4 mr-1" /> Template
          </Button>
          <Input
            type="file"
            accept=".xlsx,.xls"
            className="max-w-xs"
            disabled={!versionId}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !versionId) return;
              try {
                const res = await navproApi.hjtUploadImport(versionId, file);
                setImportId(res.import.id);
                setImportStep(2);
                toast.success("File diupload — review preview.");
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Upload gagal");
              }
            }}
          />
        </div>
        {importStep >= 2 && preview.data ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm">
              Valid: {preview.data.import?.valid_rows ?? 0} · Error:{" "}
              {preview.data.import?.error_rows ?? 0}
            </p>
            <div className="max-h-48 overflow-auto border rounded text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Produk</th>
                    <th className="px-2 py-1">Region</th>
                    <th className="px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.data.rows || []).slice(0, 30).map((r) => (
                    <tr key={r.row_no} className="border-t">
                      <td className="px-2 py-1">{r.row_no}</td>
                      <td className="px-2 py-1">{r.product_name}</td>
                      <td className="px-2 py-1">{r.region_code}</td>
                      <td className="px-2 py-1">{r.row_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              disabled={commitImport.isPending || !importId}
              onClick={() => commitImport.mutate()}
            >
              Commit import
            </Button>
          </div>
        ) : null}
      </AdminPanelCard>

      <div className="grid md:grid-cols-2 gap-4">
        <AdminPanelCard title="IBBC (read-only)" accent="sky">
          <p className="text-xs text-muted-foreground mb-2">
            {(ibbc.data?.items || []).length} baris · Perdir 0005
          </p>
          <ul className="text-xs max-h-40 overflow-auto space-y-1">
            {(ibbc.data?.items || []).slice(0, 10).map((row) => {
              const r = row as { cir_bw_type: string; price_jawa_bali: number };
              return (
              <li key={r.cir_bw_type}>
                {r.cir_bw_type} — {formatCurrency(r.price_jawa_bali)}
              </li>
              );
            })}
          </ul>
        </AdminPanelCard>
        <AdminPanelCard title="Overhead LK" accent="emerald">
          {(overhead.data?.items || []).slice(0, 1).map((row) => {
            const o = row as { fiscal_year: number; overhead_plus_har_pct: number };
            return (
            <p key={o.fiscal_year} className="text-sm">
              FY {o.fiscal_year}: overhead+HAR {(Number(o.overhead_plus_har_pct) * 100).toFixed(2)}%
            </p>
            );
          })}
        </AdminPanelCard>
      </div>
    </div>
  );
}
