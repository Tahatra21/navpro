"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  Download,
  FolderPlus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HjtKpiTiles } from "@/components/hjt/HjtKpiTiles";
import { HjtLastmileDialog } from "@/components/hjt/HjtLastmileDialog";
import { HjtProductCombobox } from "@/components/hjt/HjtProductCombobox";
import { HjtApprovalTimeline } from "@/components/hjt/HjtApprovalTimeline";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/toast";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  canApproveHjtAtRole,
  canEditHjtQuotation,
  canSubmitHjtQuotation,
} from "@/lib/rbac";
import { IdNumberInput } from "@/components/shared/IdNumberInput";
import { formatCurrency, formatIdNumber, parseIdNumber } from "@/lib/format";
import type { HjtCalcMode, HjtQuotationFull } from "@/types/hjt";
import { formatHjtRegionLabel } from "@/types/hjt";

const STEPS = [
  { id: 1, label: "Pelanggan" },
  { id: 2, label: "Skema" },
  { id: 3, label: "Layanan" },
  { id: 4, label: "Lain-lain" },
  { id: 5, label: "Hitung" },
  { id: 6, label: "Submit" },
] as const;

type Props =
  | { mode: "edit"; quotationId: string }
  | { mode: "create"; quotationId?: never };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function HjtQuotationWizard(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(1);
  const [quotationId, setQuotationId] = useState<string | null>(
    props.mode === "edit" ? props.quotationId : null
  );
  const [creating, setCreating] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [lastmileLineId, setLastmileLineId] = useState<string | undefined>();
  const [lastmileOpen, setLastmileOpen] = useState(false);
  const [hargaFinal, setHargaFinal] = useState("");
  const [floorJustification, setFloorJustification] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["hjt-quotation", quotationId],
    queryFn: () => navproApi.hjtGetQuotation(quotationId!),
    enabled: !!quotationId,
  });

  const { data: tariffVersions } = useQuery({
    queryKey: ["hjt-tariff-versions"],
    queryFn: () => navproApi.hjtListTariffVersions("active"),
  });

  const { data: regionsData } = useQuery({
    queryKey: ["hjt-regions"],
    queryFn: () => navproApi.hjtListRegions(),
  });

  const { data: productsData } = useQuery({
    queryKey: ["hjt-products"],
    queryFn: () => navproApi.hjtListProducts(),
  });

  const full = data as HjtQuotationFull | undefined;
  const q = full?.quotation;
  const editable = canEditHjtQuotation(user?.role, q?.status);
  const canSubmit = canSubmitHjtQuotation(user?.role, q?.status);
  const canApprove =
    q?.status === "submitted" && canApproveHjtAtRole(user?.role, q.current_approval_role);

  const { data: approvalData } = useQuery({
    queryKey: ["hjt-approvals", quotationId],
    queryFn: () => navproApi.hjtApprovalTimeline(quotationId!),
    enabled: !!quotationId && !!q && q.status !== "draft",
  });

  const activeKepdir = tariffVersions?.versions?.[0]?.kepdir_ref;

  const invalidate = useCallback(() => {
    if (!quotationId) return;
    qc.invalidateQueries({ queryKey: ["hjt-quotation", quotationId] });
    qc.invalidateQueries({ queryKey: ["hjt-quotations"] });
    qc.invalidateQueries({ queryKey: ["hjt-approval-queue"] });
  }, [qc, quotationId]);

  const lookupLineHpp = useCallback(
    async (lineId: string, productId: number, regionId?: number) => {
      const region = regionId ?? q?.region_id;
      if (!region) {
        toast.error("Pilih region di Langkah 1 terlebih dahulu.");
        return;
      }
      try {
        const t = await navproApi.hjtLookupTariff({ product: productId, region });
        await navproApi.hjtUpsertLine(quotationId!, {
          id: lineId,
          product_id: productId,
          backbone: t.backbone,
          uplink: t.uplink,
          vas: t.vas,
          access: t.access,
          tarif: t.tarif,
        });
        if (!t.found || (t.backbone || 0) + (t.uplink || 0) + (t.vas || 0) === 0) {
          toast.error(
            "Tarif HPP belum ada untuk produk × region ini. Import matriks tarif di Admin HJT, atau pilih produk yang sudah ada tarifnya (contoh: Inet Corp IX&IIX, Dedicated Internet)."
          );
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Gagal lookup tarif");
      }
    },
    [quotationId, q?.region_id, toast]
  );

  const searchProducts = useCallback(
    (query: string) => navproApi.hjtListProducts(query).then((r) => r.products),
    []
  );

  const saveHeader = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      navproApi.hjtUpdateQuotation(quotationId!, body),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const calcMut = useMutation({
    mutationFn: (mode: HjtCalcMode) => navproApi.hjtCalculate(quotationId!, mode),
    onSuccess: () => {
      toast.success("Kalkulasi selesai.");
      invalidate();
      refetch();
      setStep(6);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: () =>
      navproApi.hjtSubmitQuotation(quotationId!, {
        harga_final: parseIdNumber(hargaFinal) > 0 ? parseIdNumber(hargaFinal) : undefined,
        floor_override_justification: floorJustification || undefined,
      }),
    onSuccess: () => {
      toast.success("Penawaran disubmit.");
      invalidate();
      refetch();
    },
    onError: (e: Error & { data?: { message?: string } }) =>
      toast.error(e.data?.message || e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => navproApi.hjtApproveQuotation(quotationId!),
    onSuccess: () => {
      toast.success("Disetujui.");
      invalidate();
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => navproApi.hjtRejectQuotation(quotationId!, rejectNote),
    onSuccess: () => {
      toast.success("Ditolak.");
      invalidate();
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createProjectMut = useMutation({
    mutationFn: () => navproApi.hjtCreateKkfProject(quotationId!),
    onSuccess: (data) => {
      toast.success(`Proyek KKF ${data.project_code} dibuat.`);
      router.push(`/projects/${data.project_id}`);
    },
    onError: (e: Error & { data?: { project_id?: string } }) => {
      if (e.data && typeof e.data === "object" && "project_id" in (e.data as object)) {
        const pid = (e.data as { project_id?: string }).project_id;
        if (pid) router.push(`/projects/${pid}`);
      }
      toast.error(e.message);
    },
  });

  const floorViolation = useMemo(() => {
    if (!q) return false;
    const snap =
      typeof q.calc_snapshot === "string"
        ? (() => {
            try {
              return JSON.parse(q.calc_snapshot);
            } catch {
              return null;
            }
          })()
        : q.calc_snapshot;
    const floor =
      q.offer_floor ??
      (q.calc_mode === "revenue_sharing"
        ? snap?.result?.revenue_split?.min_quot_final
        : snap?.result?.offer?.floor);
    if (floor == null) return false;
    const defaultFinal =
      q.calc_mode === "revenue_sharing"
        ? Number(q.offer_recommended || snap?.result?.harga_negosiasi || 0)
        : Number(q.offer_recommended || 0);
    const finalVal =
      parseIdNumber(hargaFinal) > 0 ? parseIdNumber(hargaFinal) : defaultFinal;
    return finalVal < Number(floor);
  }, [q, hargaFinal]);

  async function createDraftIfNeeded(): Promise<string | null> {
    if (quotationId) return quotationId;
    setCreating(true);
    setSaveError("");
    try {
      const regionId = regionsData?.regions?.[0]?.id;
      if (!regionId) {
        setSaveError("Katalog region kosong — jalankan seed backend.");
        return null;
      }
      const { quotation } = await navproApi.hjtCreateQuotation({
        customer_name: "Pelanggan Baru",
        calc_mode: "standard",
        duration_years: 1,
        scheme: "Subscription",
        region_id: regionId,
      });
      setQuotationId(quotation.id);
      router.replace(`/hjt/quotations/${quotation.id}`);
      return quotation.id;
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Gagal membuat penawaran");
      return null;
    } finally {
      setCreating(false);
    }
  }

  function validateStep(): boolean {
    setSaveError("");
    if (!q && step === 1 && props.mode === "create") return true;
    if (!q) {
      setSaveError("Data penawaran belum dimuat.");
      return false;
    }
    if (step === 1) {
      if (!q.customer_name?.trim()) {
        setSaveError("Nama pelanggan wajib diisi.");
        return false;
      }
      if (!q.region_id) {
        setSaveError("Region wajib dipilih.");
        return false;
      }
    }
    if (step === 3 && !(full?.lines?.length)) {
      setSaveError("Tambahkan minimal satu baris layanan.");
      return false;
    }
    if (step === 6 && q.grand_total_all == null) {
      setSaveError("Jalankan kalkulasi terlebih dahulu (Langkah 5 → Hitung).");
      return false;
    }
    return true;
  }

  async function addLine() {
    if (!quotationId) return;
    const products = productsData?.products || [];
    const first = products[0];
    if (!first) {
      toast.error("Katalog produk kosong.");
      return;
    }
    const { line } = await navproApi.hjtUpsertLine(quotationId, {
      product_id: first.id,
      capacity: 1,
      qty: 1,
      unit: "Mbps",
    });
    if (line?.id && q?.region_id && (line.backbone || 0) + (line.uplink || 0) === 0) {
      await lookupLineHpp(line.id, first.id);
    }
    invalidate();
    refetch();
  }

  const prev = () => setStep((s) => Math.max(1, s - 1));

  const next = async () => {
    if (step === 6 && !canSubmit) {
      router.push("/hjt/quotations");
      return;
    }
    if (props.mode === "create" && !quotationId && step === 1) {
      const id = await createDraftIfNeeded();
      if (!id) return;
      setStep(2);
      return;
    }
    if (step === 5) {
      setSaveError("");
      if (!q) {
        setSaveError("Data penawaran belum dimuat.");
        return;
      }
      if (!editable) {
        setStep(6);
        return;
      }
      if (!(full?.lines?.length)) {
        setSaveError("Tambahkan minimal satu baris layanan.");
        return;
      }
      calcMut.mutate((q.calc_mode as HjtCalcMode) || "standard");
      return;
    }
    if (!validateStep()) return;
    if (step === 6 && canSubmit && q?.grand_total_all != null) {
      if (floorViolation && !floorJustification.trim()) {
        setSaveError("Justifikasi di bawah floor wajib diisi.");
        return;
      }
      submitMut.mutate();
      return;
    }
    setStep((s) => Math.min(6, s + 1));
  };

  useEffect(() => {
    if (q?.status === "approved" || q?.status === "submitted") {
      if (q.grand_total_all != null && step < 5) setStep(5);
    }
  }, [q?.status, q?.grand_total_all, step]);

  const loading = (props.mode === "edit" && (isLoading || !q)) || creating;
  const footerLabel =
    step === 5
      ? editable
        ? calcMut.isPending
          ? "Menghitung…"
          : "Hitung"
        : "Lanjut"
      : step === 6 && canSubmit
        ? submitMut.isPending
          ? "Mengirim…"
          : "Submit"
        : step === 6
          ? "Selesai"
          : "Lanjut";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/hjt/quotations">
          <ArrowLeft className="w-4 h-4 mr-1" /> Daftar penawaran
        </Link>
      </Button>

      {saveError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {saveError}
        </div>
      ) : null}

      <div className="relative w-full max-w-4xl mx-auto max-h-[90vh] bg-card rounded-2xl shadow-xl flex flex-col overflow-hidden border border-border">
        <div className="flex items-center justify-between px-6 md:px-8 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground">
              {props.mode === "create" && !quotationId
                ? "Penawaran HJT Baru"
                : q?.customer_name || "Penawaran HJT"}
            </h1>
            {q ? <StatusBadge status={q.status.toUpperCase()} /> : null}
          </div>
          <Link
            href="/hjt/quotations"
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </Link>
        </div>

        <div className="px-6 md:px-8 pt-5 pb-3 flex-shrink-0">
          <div className="relative">
            <div className="absolute left-5 right-5 top-5 h-px bg-border -z-10" />
            <div className="grid grid-cols-[repeat(11,minmax(0,1fr))] items-start">
              {STEPS.map(({ id, label }, idx) => {
                const isActive = step === id;
                const isPast = step > id;
                const showArrow = idx < STEPS.length - 1;
                return (
                  <div key={id} className="contents">
                    <button
                      type="button"
                      className="flex flex-col items-center gap-1.5 bg-card px-1 col-span-1"
                      onClick={() => setStep(id)}
                    >
                      <div
                        className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                          ${
                            isActive
                              ? "border-secondary bg-card text-secondary shadow-md shadow-secondary/20"
                              : isPast
                                ? "border-secondary bg-secondary text-secondary-foreground"
                                : "border-border bg-card text-muted-foreground"
                          }`}
                      >
                        {id}
                      </div>
                      <span
                        className={`text-[9px] md:text-[10px] font-semibold tracking-wider uppercase text-center leading-tight ${
                          isActive ? "text-secondary" : isPast ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                    {showArrow ? (
                      <div className="flex items-center justify-center pt-[10px]">
                        <ChevronRight
                          className={`w-4 h-4 md:w-5 md:h-5 ${
                            isPast ? "text-secondary" : "text-muted-foreground/50"
                          }`}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-5 min-h-[320px]">
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Memuat penawaran HJT…</p>
          ) : (
            <>
              {activeKepdir ? (
                <p className="text-xs text-amber-800 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-4">
                  Tarif aktif: <strong>{activeKepdir}</strong>
                </p>
              ) : null}

              {step === 1 && q ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Langkah 1: Data Pelanggan &amp; Region</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Informasi pelanggan dan wilayah tarif HJT (kepdir).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nama pelanggan *">
                      <Input
                        defaultValue={q.customer_name || ""}
                        disabled={!editable}
                        className="h-11"
                        onBlur={(e) => saveHeader.mutate({ customer_name: e.target.value })}
                      />
                    </Field>
                    <Field label="NPWP">
                      <Input
                        defaultValue={q.npwp || ""}
                        disabled={!editable}
                        className="h-11"
                        onBlur={(e) => saveHeader.mutate({ npwp: e.target.value })}
                      />
                    </Field>
                    <Field label="No. kontrak">
                      <Input
                        defaultValue={q.contract_no || ""}
                        disabled={!editable}
                        className="h-11"
                        onBlur={(e) => saveHeader.mutate({ contract_no: e.target.value })}
                      />
                    </Field>
                    <Field label="Region *">
                      <select
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={q.region_id || ""}
                        disabled={!editable}
                        onChange={async (e) => {
                          const region_id = Number(e.target.value);
                          if (!region_id) return;
                          await navproApi.hjtUpdateQuotation(quotationId!, { region_id });
                          for (const line of full?.lines || []) {
                            if (line.product_id) {
                              await lookupLineHpp(line.id, line.product_id, region_id);
                            }
                          }
                          invalidate();
                          refetch();
                        }}
                      >
                        <option value="">— pilih —</option>
                        {(regionsData?.regions || []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {formatHjtRegionLabel(r)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 1 && props.mode === "create" && !q ? (
                <div className="space-y-5">
                  <h2 className="text-xl font-bold">Langkah 1: Mulai Penawaran HJT</h2>
                  <p className="text-sm text-muted-foreground">
                    Klik <strong>Lanjut</strong> untuk membuat draft penawaran. Anda akan mengisi data pelanggan
                    dan region di langkah berikutnya.
                  </p>
                </div>
              ) : null}

              {step === 2 && q ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Langkah 2: Skema &amp; Mode Kalkulasi</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Subscription/OTC, durasi kontrak, Mode A (Standard) atau Mode B (Revenue Sharing).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Skema">
                      <select
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={q.scheme || "Subscription"}
                        disabled={!editable}
                        onChange={(e) => saveHeader.mutate({ scheme: e.target.value })}
                      >
                        <option value="Subscription">Subscription</option>
                        <option value="OTC">OTC (One-Time Charge)</option>
                      </select>
                    </Field>
                    <Field label="Durasi (tahun)">
                      <Input
                        type="number"
                        min={1}
                        className="h-11"
                        defaultValue={q.duration_years || 1}
                        disabled={!editable}
                        onBlur={(e) => saveHeader.mutate({ duration_years: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Mode kalkulasi">
                      <select
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={q.calc_mode || "standard"}
                        disabled={!editable}
                        onChange={(e) => saveHeader.mutate({ calc_mode: e.target.value as HjtCalcMode })}
                      >
                        <option value="standard">Mode A — Standard</option>
                        <option value="revenue_sharing">Mode B — Revenue Sharing</option>
                      </select>
                    </Field>
                    {q.calc_mode === "revenue_sharing" ? (
                      <>
                        <Field label="Target IRR">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-11"
                            defaultValue={q.target_irr ?? 0.2}
                            disabled={!editable}
                            onBlur={(e) => saveHeader.mutate({ target_irr: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Diskon Backbone (0–1)">
                          <Input
                            type="number"
                            step="0.01"
                            max={1}
                            className="h-11"
                            defaultValue={q.disc_backbone ?? 0}
                            disabled={!editable}
                            onBlur={(e) => saveHeader.mutate({ disc_backbone: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Diskon Port (0–0,6)">
                          <Input
                            type="number"
                            step="0.01"
                            max={0.6}
                            className="h-11"
                            defaultValue={q.disc_port ?? 0}
                            disabled={!editable}
                            onBlur={(e) => saveHeader.mutate({ disc_port: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Level diskon">
                          <select
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                            defaultValue={q.discount_level || ""}
                            disabled={!editable}
                            onChange={(e) =>
                              saveHeader.mutate({ discount_level: e.target.value || null })
                            }
                          >
                            <option value="">— tidak ada —</option>
                            <option value="MB_NIAGA">MB Niaga (5%)</option>
                            <option value="GM_SBU">GM SBU (12%)</option>
                            <option value="DIRECTOR">Director (18%)</option>
                          </select>
                        </Field>
                        <Field label="Margin custom (0–1)">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-11"
                            defaultValue={q.margin_custom ?? 0}
                            disabled={!editable}
                            onBlur={(e) => saveHeader.mutate({ margin_custom: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Share ICON / Kawasan">
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-11"
                              defaultValue={q.share_icon ?? 0.7}
                              disabled={!editable}
                              onBlur={(e) => saveHeader.mutate({ share_icon: Number(e.target.value) })}
                            />
                            <Input
                              type="number"
                              step="0.01"
                              className="h-11"
                              defaultValue={q.share_kawasan ?? 0.3}
                              disabled={!editable}
                              onBlur={(e) => saveHeader.mutate({ share_kawasan: Number(e.target.value) })}
                            />
                          </div>
                        </Field>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 3 && q ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">Langkah 3: Baris Layanan</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pilih produk dari katalog — HPP Backbone/Uplink terisi otomatis dari master tarif.
                      </p>
                    </div>
                    {editable ? (
                      <Button size="sm" variant="outline" onClick={addLine}>
                        + Layanan
                      </Button>
                    ) : null}
                  </div>
                  {!q.region_id && editable ? (
                    <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                      Kembali ke <strong>Langkah 1</strong> dan pilih region agar HPP terisi.
                    </p>
                  ) : null}
                  <div className="overflow-x-auto rounded-lg border overflow-y-visible">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead className="bg-muted/50">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2 min-w-[240px]">Produk</th>
                          <th className="px-3 py-2 w-24">Kapasitas</th>
                          <th className="px-3 py-2 w-20">Qty</th>
                          {q.calc_mode === "revenue_sharing" ? (
                            <th className="px-3 py-2">Akses</th>
                          ) : null}
                          <th className="px-3 py-2">BB / UL</th>
                          <th className="px-3 py-2">Lastmile</th>
                          <th className="px-3 py-2">Harga dasar</th>
                          <th className="px-3 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {(full?.lines || []).map((line) => (
                          <tr key={line.id} className="border-t">
                            <td className="px-3 py-2 align-top min-w-[240px]">
                              <HjtProductCombobox
                                products={productsData?.products || []}
                                value={line.product_id}
                                disabled={!editable}
                                onSearch={searchProducts}
                                onChange={async (productId) => {
                                  await lookupLineHpp(line.id, productId);
                                  refetch();
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Input
                                type="number"
                                step={1}
                                min={1}
                                className="h-9 w-24"
                                defaultValue={Math.round(Number(line.capacity) || 1)}
                                disabled={!editable}
                                onBlur={async (e) => {
                                  const capacity = Math.max(1, Math.round(Number(e.target.value) || 1));
                                  await navproApi.hjtUpsertLine(quotationId!, {
                                    id: line.id,
                                    capacity,
                                  });
                                  refetch();
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Input
                                type="number"
                                step={1}
                                min={1}
                                className="h-9 w-20"
                                defaultValue={Math.round(Number(line.qty) || 1)}
                                disabled={!editable}
                                onBlur={async (e) => {
                                  const qty = Math.max(1, Math.round(Number(e.target.value) || 1));
                                  await navproApi.hjtUpsertLine(quotationId!, {
                                    id: line.id,
                                    qty,
                                  });
                                  refetch();
                                }}
                              />
                            </td>
                            {q.calc_mode === "revenue_sharing" ? (
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  defaultChecked={!!line.akses_existing}
                                  disabled={!editable}
                                  onChange={async (e) => {
                                    await navproApi.hjtUpsertLine(quotationId!, {
                                      id: line.id,
                                      akses_existing: e.target.checked,
                                    });
                                    refetch();
                                  }}
                                />
                              </td>
                            ) : null}
                            <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                              {!line.product_id ? (
                                "—"
                              ) : (line.backbone || 0) + (line.uplink || 0) + (line.vas || 0) === 0 ? (
                                <span className="text-amber-700" title="Belum ada baris tarif produk × region di database">
                                  Belum ada tarif
                                </span>
                              ) : (
                                `${formatCurrency(Number(line.backbone || 0))} / ${formatCurrency(Number(line.uplink || 0))}`
                              )}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-xs">
                              {formatCurrency(Number(line.lastmile || 0))}
                              {editable && q.calc_mode === "standard" ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 ml-1 text-xs"
                                  onClick={() => {
                                    setLastmileLineId(line.id);
                                    setLastmileOpen(true);
                                  }}
                                >
                                  KKF
                                </Button>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 tabular-nums font-medium text-xs">
                              {Number(line.harga_dasar) > 0 ? (
                                formatCurrency(Number(line.harga_dasar))
                              ) : (
                                <span className="text-muted-foreground font-normal" title="Terisi otomatis setelah tarif ditemukan, atau klik Hitung di Langkah 5">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {editable ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={async () => {
                                    await navproApi.hjtDeleteLine(quotationId!, line.id);
                                    refetch();
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {step === 4 && q ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">Langkah 4: Pengeluaran Lain-lain</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Opsional — biaya di luar tarif HJT.</p>
                    </div>
                    {editable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await navproApi.hjtUpsertExpense(quotationId!, {
                            item: "Biaya lain",
                            harsat: 0,
                            jumlah: 1,
                            total: 0,
                          });
                          refetch();
                        }}
                      >
                        + Item
                      </Button>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Harsat</th>
                          <th className="px-3 py-2">Jumlah</th>
                          <th className="px-3 py-2">Total</th>
                          <th className="px-3 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {(full?.expenses || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                              Belum ada pengeluaran lain-lain.
                            </td>
                          </tr>
                        ) : (
                          (full?.expenses || []).map((exp) => (
                            <tr key={exp.id} className="border-t">
                              <td className="px-3 py-2">
                                <Input
                                  className="h-8"
                                  defaultValue={exp.item}
                                  disabled={!editable}
                                  onBlur={async (e) => {
                                    await navproApi.hjtUpsertExpense(quotationId!, {
                                      id: exp.id,
                                      item: e.target.value,
                                      harsat: exp.harsat,
                                      jumlah: exp.jumlah,
                                      total: exp.total,
                                    });
                                    refetch();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  className="h-8 w-28"
                                  defaultValue={exp.harsat}
                                  disabled={!editable}
                                  onBlur={async (e) => {
                                    const harsat = Number(e.target.value);
                                    await navproApi.hjtUpsertExpense(quotationId!, {
                                      id: exp.id,
                                      item: exp.item,
                                      harsat,
                                      jumlah: exp.jumlah,
                                      total: harsat * exp.jumlah,
                                    });
                                    refetch();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  className="h-8 w-20"
                                  defaultValue={exp.jumlah}
                                  disabled={!editable}
                                  onBlur={async (e) => {
                                    const jumlah = Number(e.target.value);
                                    await navproApi.hjtUpsertExpense(quotationId!, {
                                      id: exp.id,
                                      item: exp.item,
                                      harsat: exp.harsat,
                                      jumlah,
                                      total: exp.harsat * jumlah,
                                    });
                                    refetch();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2 tabular-nums font-medium">
                                {formatCurrency(Number(exp.total || 0))}
                              </td>
                              <td className="px-3 py-2">
                                {editable ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={async () => {
                                      await navproApi.hjtDeleteExpense(quotationId!, exp.id);
                                      refetch();
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {step === 5 && q ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Langkah 5: Kalkulasi &amp; Ringkasan KPI</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Tekan <strong>Hitung</strong> untuk menghitung harga dasar, floor, rekomendasi, dan grand total.
                    </p>
                  </div>
                  {q.grand_total_all == null && editable ? (
                    <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-lg text-sm flex gap-3">
                      <Calculator className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>
                        Data layanan sudah lengkap. Klik <strong>Hitung</strong> di bawah untuk menjalankan engine
                        HJT ({q.calc_mode === "revenue_sharing" ? "Mode B" : "Mode A"}).
                      </p>
                    </div>
                  ) : null}
                  {q.grand_total_all != null ? (
                    <HjtKpiTiles quotation={q} lines={full?.lines} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum dikalkulasi.</p>
                  )}
                </div>
              ) : null}

              {step === 6 && q ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Langkah 6: Submit &amp; Finalisasi</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Review penawaran, submit approval, atau export SPH.
                    </p>
                  </div>

                  {q.grand_total_all != null ? (
                    <HjtKpiTiles quotation={q} lines={full?.lines} />
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {q.status === "approved" && q.linked_project_id ? (
                      <Button size="sm" asChild>
                        <Link href={`/projects/${q.linked_project_id}`}>
                          <FolderPlus className="w-4 h-4 mr-1" /> Buka Proyek KKF
                        </Link>
                      </Button>
                    ) : q.status === "approved" ? (
                      <Button
                        size="sm"
                        onClick={() => createProjectMut.mutate()}
                        disabled={createProjectMut.isPending}
                      >
                        <FolderPlus className="w-4 h-4 mr-1" /> Buat Proyek KKF
                      </Button>
                    ) : null}
                    {q.grand_total_all != null || q.status === "approved" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navproApi.hjtDownloadExport(quotationId!, "pdf")}
                        >
                          <Download className="w-4 h-4 mr-1" /> PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navproApi.hjtDownloadExport(quotationId!, "xlsx")}
                        >
                          <Download className="w-4 h-4 mr-1" /> Excel
                        </Button>
                      </>
                    ) : null}
                  </div>

                  {canSubmit && q.grand_total_all != null ? (
                    <div className="rounded-lg border p-4 space-y-4">
                      <h3 className="font-semibold text-sm">Submit untuk approval</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Harga final (default = rekomendasi)">
                          <IdNumberInput
                            value={hargaFinal}
                            placeholder={
                              q.offer_recommended != null
                                ? formatIdNumber(q.offer_recommended)
                                : ""
                            }
                            onChange={setHargaFinal}
                          />
                        </Field>
                        {floorViolation ? (
                          <Field label="Justifikasi di bawah floor *">
                            <Input
                              value={floorJustification}
                              onChange={(e) => setFloorJustification(e.target.value)}
                            />
                          </Field>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {canApprove ? (
                    <div className="rounded-lg border p-4 space-y-3">
                      <h3 className="font-semibold text-sm">Tindakan approval</h3>
                      <Input
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Catatan penolakan (wajib jika tolak)"
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                          Setujui
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => rejectMut.mutate()}
                          disabled={rejectMut.isPending || !rejectNote.trim()}
                        >
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {approvalData?.approvals?.length ? (
                    <div className="rounded-lg border p-4">
                      <h3 className="font-semibold text-sm mb-3">Timeline approval</h3>
                      <HjtApprovalTimeline
                        steps={approvalData.approvals}
                        floorJustification={q.floor_override_justification}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-5 border-t border-border flex-shrink-0 bg-card">
          <Button variant="outline" onClick={prev} disabled={step === 1 || loading} className="w-28">
            Kembali
          </Button>
          <Button
            onClick={() => void next()}
            disabled={loading || calcMut.isPending || submitMut.isPending}
            className="w-32 bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-md"
          >
            {footerLabel}
          </Button>
        </div>
      </div>

      <HjtLastmileDialog
        open={lastmileOpen}
        onOpenChange={setLastmileOpen}
        lineId={lastmileLineId}
        line={full?.lines?.find((l) => l.id === lastmileLineId)}
        onApplied={async (lastmile) => {
          if (!lastmileLineId || !quotationId) return;
          await navproApi.hjtUpsertLine(quotationId, { id: lastmileLineId, lastmile });
          refetch();
          toast.success("Lastmile diterapkan.");
        }}
      />
    </div>
  );
}
