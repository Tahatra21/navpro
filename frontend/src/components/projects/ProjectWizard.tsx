"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Trash2, ChevronRight } from "lucide-react";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  buildProjectPayload,
  projectToWizardState,
  type WizardCapexRow,
  type WizardOpexRow,
  type WizardRevenueRow,
} from "@/lib/project-mappers";
import type { Project } from "@/types/navpro";
import {
  formatZodError,
  wizardStep1Schema,
  wizardStep2Schema,
} from "@/lib/wizard-validate";
import {
  assumptionFieldsForWizard,
  projectUsesCustomAssumptions,
  resolveGlobalAssumptions,
} from "@/lib/global-assumptions";
import { RevenueTariffStep } from "@/components/projects/RevenueTariffStep";
import { OpexCatalogStep } from "@/components/projects/OpexCatalogStep";
import { TARIFF_PACKAGES } from "@/lib/tariff-calculator";
import type { OpexCatalogItem } from "@/lib/opex-service-catalog";
import type { TariffCalculatorSnapshot } from "@/types/navpro";

// ── Constants ─────────────────────────────────────────────────────────────────
const CAPEX_CATEGORIES = ["HARDWARE", "SOFTWARE", "CIVIL", "NETWORK", "POWER", "VEHICLE", "INTEGRATION", "OTHER"];
const STEPS = [
  { id: 1, label: "Info Dasar" },
  { id: 2, label: "Durasi" },
  { id: 3, label: "CAPEX" },
  { id: 4, label: "OPEX" },
  { id: 5, label: "Tarif" },
  { id: 6, label: "Hitung" },
];

const generateProjectCodePreview = () => {
  const y = new Date().getFullYear();
  return `NAVPRO-${y}-XXXX (otomatis)`;
};

// ── Helper ────────────────────────────────────────────────────────────────────
const formatRp = (v: number) =>
  v.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const uid = () => Math.random().toString(36).substr(2, 9);

const RAB_8ITEM_LASTMILE: Array<Omit<WizardCapexRow, "id">> = [
  { name: "Survey & Design", category: "INTEGRATION", amount: 15_000_000, currency: "IDR", period: 0 },
  { name: "Perizinan/SITAC", category: "CIVIL", amount: 25_000_000, currency: "IDR", period: 0 },
  { name: "Pekerjaan Sipil", category: "CIVIL", amount: 120_000_000, currency: "IDR", period: 0 },
  { name: "Perangkat Network", category: "NETWORK", amount: 85_000_000, currency: "IDR", period: 0 },
  { name: "Perangkat Power", category: "POWER", amount: 55_000_000, currency: "IDR", period: 0 },
  { name: "Instalasi & Integrasi", category: "INTEGRATION", amount: 40_000_000, currency: "IDR", period: 0 },
  { name: "Testing & Commissioning", category: "INTEGRATION", amount: 10_000_000, currency: "IDR", period: 1 },
  { name: "Kontinjensi", category: "OTHER", amount: 20_000_000, currency: "IDR", period: 0 },
];

async function pollCalculation(projectId: string, jobId?: string) {
  if (jobId) {
    for (let i = 0; i < 60; i++) {
      try {
        const job = await navproApi.getJobStatus(jobId);
        if (job.state === "completed") return;
        if (job.state === "failed") throw new Error(job.failed_reason || "Kalkulasi gagal");
      } catch (e: unknown) {
        const err = e as { status?: number };
        if (err.status === 400) break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    const { project } = await navproApi.getProject(projectId);
    if (project.status === "COMPUTED") return;
  }
  await navproApi.calculateProject(projectId);
}

export function ProjectWizard({
  mode,
  initialProject,
}: {
  mode: "create" | "edit";
  initialProject?: Project;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState(mode === "edit" ? "Memuat…" : "Belum disimpan");
  const [projectId, setProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [projectCode, setProjectCode] = useState(initialProject?.project_code ?? "");
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authUser = useAuthStore((s) => s.user);

  const configQuery = useQuery({
    queryKey: ["wizard-config"],
    queryFn: async () => {
      const [assumptions, presets, orgUnitsRes, opexCatalogRes] = await Promise.all([
        navproApi.getAssumptions(),
        navproApi.getPresets(),
        navproApi.getOrgUnits(),
        navproApi.getOpexCatalog(),
      ]);
      return {
        assumptions,
        presets: presets.presets as Array<{ preset_name: string; duration_months: number }>,
        orgUnits: orgUnitsRes.org_units,
        opexCatalog: opexCatalogRes.items as OpexCatalogItem[],
      };
    },
  });

  const globalAssumptions = configQuery.data?.assumptions as Record<string, number> | undefined;
  const resolvedAssumptions = resolveGlobalAssumptions(globalAssumptions);
  const assumptionEffectiveDate = resolvedAssumptions.effective_date;
  const presets = configQuery.data?.presets || [];
  const orgUnits = configQuery.data?.orgUnits || [];
  const opexCatalog = configQuery.data?.opexCatalog || [];
  const canPickAnyOrg =
    authUser?.role === "SUPER_ADMIN" ||
    authUser?.role === "FINANCE_ADMIN" ||
    !authUser?.org_unit_id;
  const orgPickerLocked = !canPickAnyOrg && orgUnits.length <= 1;

  // Step 1
  const [orgUnitId, setOrgUnitId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [customer, setCustomer] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [contractDate, setContractDate] = useState(new Date().toISOString().split("T")[0]);
  const [picSales, setPicSales] = useState("");

  // Step 2
  const [durationMonths, setDurationMonths] = useState(12);
  const [waccOverride, setWaccOverride] = useState("");
  const [inflationOverride, setInflationOverride] = useState("");
  const [kursUsdOverride, setKursUsdOverride] = useState("");
  const [bcrMandatory, setBcrMandatory] = useState("");
  const [bcrMinimum, setBcrMinimum] = useState("");
  /** true = pakai asumsi master (pre-fill, tanpa override di payload) */
  const [useMasterAssumptions, setUseMasterAssumptions] = useState(true);

  // Step 3 – CAPEX
  const [capexRows, setCapexRows] = useState<WizardCapexRow[]>([]);
  const [capexInput, setCapexInput] = useState<{
    name: string;
    category: string;
    amount: number;
    currency: "IDR" | "USD";
    period: number;
  }>({ name: "", category: "HARDWARE", amount: 0, currency: "IDR", period: 0 });

  // Step 4 – OPEX (katalog Icon+)
  const [opexRows, setOpexRows] = useState<WizardOpexRow[]>([]);

  // Step 5 – Kalkulator tarif → revenue
  const [revenueRows, setRevenueRows] = useState<WizardRevenueRow[]>([]);
  const [tariffSnapshot, setTariffSnapshot] = useState<TariffCalculatorSnapshot | null>(null);

  const kursForPreview = useMemo(() => {
    const v = useMasterAssumptions
      ? resolvedAssumptions.kurs_usd
      : parseFloat(kursUsdOverride);
    return Number.isFinite(v) && v > 0 ? v : 16500;
  }, [useMasterAssumptions, resolvedAssumptions.kurs_usd, kursUsdOverride]);

  const totalCapex = capexRows.reduce((s, r) => s + (r.currency === "IDR" ? r.amount : r.amount * 16500), 0);
  const totalOpex = opexRows.filter(r => r.type === "NOMINAL").reduce((s, r) => s + (r.currency === "IDR" ? r.amount : r.amount * 16500), 0);
  const totalRevOtc = revenueRows.reduce((s, r) => s + (r.currency === "IDR" ? r.otc : r.otc * kursForPreview), 0);
  const totalRevSewa = revenueRows.reduce((s, r) => {
    const base = r.revenueMode === "step_yearly" ? r.harsatYear1 * r.qty : r.harsat * r.qty;
    return s + (r.currency === "IDR" ? base : base * kursForPreview);
  }, 0);

  const codeDisplay =
    projectCode ||
    (mode === "create" ? generateProjectCodePreview() : "—");

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const getPayload = useCallback(
    () =>
      buildProjectPayload({
        project_name: projectName,
        contract_start_date: contractDate,
        project_duration_months: durationMonths,
        org_unit_id: orgUnitId || undefined,
        customer_name: customer,
        contract_number: contractNo,
        pic_sales: picSales,
        wacc_override: useMasterAssumptions ? "" : waccOverride,
        inflation_rate_override: useMasterAssumptions ? "" : inflationOverride,
        kurs_usd_override: useMasterAssumptions ? "" : kursUsdOverride,
        bcr_mandatory_override: useMasterAssumptions ? "" : bcrMandatory,
        bcr_minimum_override: useMasterAssumptions ? "" : bcrMinimum,
        capexRows,
        opexRows,
        revenueRows,
        tariffCalculatorSnapshot: tariffSnapshot,
      }),
    [
      projectName,
      contractDate,
      durationMonths,
      orgUnitId,
      customer,
      contractNo,
      picSales,
      waccOverride,
      inflationOverride,
      kursUsdOverride,
      bcrMandatory,
      bcrMinimum,
      capexRows,
      opexRows,
      revenueRows,
      tariffSnapshot,
      useMasterAssumptions,
    ]
  );

  useEffect(() => {
    if (orgUnitId || orgUnits.length === 0) return;
    if (authUser?.org_unit_id && orgUnits.some((o) => o.id === authUser.org_unit_id)) {
      setOrgUnitId(authUser.org_unit_id);
    } else if (orgUnits.length === 1) {
      setOrgUnitId(orgUnits[0].id);
    }
  }, [orgUnits, authUser?.org_unit_id, orgUnitId]);

  useEffect(() => {
    if (!initialProject || mode !== "edit") {
      if (mode === "create") setSaveStatus("Belum disimpan");
      return;
    }
    const s = projectToWizardState(initialProject);
    setOrgUnitId(s.orgUnitId || initialProject.org_unit_id || "");
    setProjectCode(s.projectCode);
    setProjectName(s.projectName);
    setCustomer(s.customer);
    setContractNo(s.contractNo);
    setContractDate(s.contractDate);
    setPicSales(s.picSales);
    setDurationMonths(s.durationMonths);
    setUseMasterAssumptions(!projectUsesCustomAssumptions(initialProject));
    setWaccOverride(s.waccOverride);
    setInflationOverride(s.inflationOverride);
    setKursUsdOverride("kursUsdOverride" in s ? String((s as { kursUsdOverride?: string }).kursUsdOverride || "") : "");
    setBcrMandatory(s.bcrMandatory);
    setBcrMinimum(s.bcrMinimum);
    setCapexRows(s.capexRows);
    setOpexRows(s.opexRows);
    setRevenueRows(s.revenueRows);
    setTariffSnapshot(s.tariffSnapshot ?? null);
    setProjectId(initialProject.id);
    setSaveStatus("Tersimpan");
    dirtyRef.current = false;
  }, [initialProject, mode]);

  /** Pre-fill parameter finansial dari asumsi master (P1). */
  useEffect(() => {
    if (!globalAssumptions || !useMasterAssumptions) return;
    const f = assumptionFieldsForWizard(globalAssumptions);
    setWaccOverride(f.waccOverride);
    setInflationOverride(f.inflationOverride);
    setKursUsdOverride(f.kursUsdOverride);
    setBcrMandatory(f.bcrMandatory);
    setBcrMinimum(f.bcrMinimum);
  }, [globalAssumptions, useMasterAssumptions]);

  const toggleCustomAssumptions = (custom: boolean) => {
    setUseMasterAssumptions(!custom);
    if (!custom && globalAssumptions) {
      const f = assumptionFieldsForWizard(globalAssumptions);
      setWaccOverride(f.waccOverride);
      setInflationOverride(f.inflationOverride);
      setKursUsdOverride(f.kursUsdOverride);
      setBcrMandatory(f.bcrMandatory);
      setBcrMinimum(f.bcrMinimum);
    }
    markDirty();
  };

  const displayWacc = useMasterAssumptions ? String(resolvedAssumptions.wacc_annual) : waccOverride;
  const displayInflation = useMasterAssumptions
    ? String(resolvedAssumptions.inflation_monthly)
    : inflationOverride;
  const displayKurs = useMasterAssumptions ? String(resolvedAssumptions.kurs_usd) : kursUsdOverride;
  const displayBcrMandatory = useMasterAssumptions
    ? String(resolvedAssumptions.bcr_mandatory)
    : bcrMandatory;
  const displayBcrMinimum = useMasterAssumptions ? String(resolvedAssumptions.bcr_minimum) : bcrMinimum;

  const autosaveDraft = useCallback(async () => {
    if (mode !== "edit" || !projectId || !projectName.trim()) return;
    if (!dirtyRef.current) return;
    setSaveStatus("Menyimpan…");
    try {
      await navproApi.updateProject(projectId, getPayload());
      dirtyRef.current = false;
      setSaveStatus(`Tersimpan ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
    } catch {
      setSaveStatus("Gagal menyimpan");
    }
  }, [mode, projectId, projectName, getPayload]);

  useEffect(() => {
    if (mode !== "edit" || !projectId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveDraft();
    }, 900);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [
    mode,
    projectId,
    projectName,
    orgUnitId,
    customer,
    contractNo,
    contractDate,
    picSales,
    durationMonths,
    waccOverride,
    inflationOverride,
    bcrMandatory,
    bcrMinimum,
    useMasterAssumptions,
    capexRows,
    opexRows,
    revenueRows,
    tariffSnapshot,
    autosaveDraft,
  ]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const addCapex = () => {
    if (!capexInput.name) return;
    setCapexRows(p => [...p, { ...capexInput, id: uid() }]);
    setCapexInput({ name: "", category: "HARDWARE", amount: 0, currency: "IDR", period: 0 });
  };

  const applyRab8Lastmile = () => {
    if (!confirm("Terapkan template RAB 8-item Lastmile? Item CAPEX yang ada akan diganti.")) return;
    setCapexRows(RAB_8ITEM_LASTMILE.map((r) => ({ ...r, id: uid() })));
    markDirty();
  };

  const validateStep = (): boolean => {
    try {
      if (step === 1) {
        const needsOrg = mode === "create" || !initialProject?.org_unit_id;
        if (needsOrg) {
          wizardStep1Schema.parse({ projectName, contractDate, orgUnitId });
        } else {
          wizardStep1Schema.parse({ projectName, contractDate, orgUnitId: orgUnitId || "locked" });
        }
      }
      if (step === 2) {
        wizardStep2Schema.parse({
          durationMonths,
          waccOverride,
          inflationOverride,
          kursUsdOverride,
          bcrMandatory,
          bcrMinimum,
        });
      }
      if (step === 5) {
        if (revenueRows.length === 0) {
          setSaveError("Terapkan hasil kalkulator tarif ke proyek (minimal 1 baris revenue).");
          return false;
        }
      }
      setSaveError("");
      return true;
    } catch (e: unknown) {
      const maybeZod = e as { issues?: unknown };
      const msg = maybeZod?.issues ? formatZodError(e as unknown as import("zod").ZodError) : "Input belum valid.";
      setSaveError(msg);
      return false;
    }
  };

  const handleCalculate = async () => {
    if (!projectName.trim()) {
      setSaveError("Nama proyek wajib diisi");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaveStatus("Menyimpan…");
    try {
      const payload = getPayload();
      let id = projectId;
      if (mode === "create" || !id) {
        const { project } = await navproApi.createProject(payload);
        id = project.id;
        setProjectId(id);
        setProjectCode(project.project_code);
      } else {
        await navproApi.updateProject(id, payload);
      }

      setSaveStatus("Menghitung KPI…");
      let jobId: string | undefined;
      try {
        const asyncRes = await navproApi.calculateProjectAsync(id);
        jobId = asyncRes.job_id;
        setSaveStatus("Antrian kalkulasi…");
      } catch {
        /* fallback sync jika Redis tidak aktif */
      }
      await pollCalculation(id, jobId);
      setSaveStatus("Selesai");
      router.push(`/projects/${id}`);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan proyek");
      setSaveStatus("Gagal");
      setSaving(false);
    }
  };

  const next = () => {
    if (!validateStep()) return;
    if (step === 6) {
      handleCalculate();
      return;
    }
    if (step < 6) setStep((s) => s + 1);
  };
  const prev = () => step > 1 && setStep((s) => s - 1);
  const close = () => router.push("/projects");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {saveError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-lg">
          {saveError}
        </div>
      )}
    <div className="flex items-center justify-center p-2">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-foreground">
              {mode === "edit" ? "Edit Proyek NAVPRO" : "Proyek NAVPRO Baru"}
            </h1>
            <span className="text-xs font-semibold px-3 py-1 rounded-full border border-primary text-primary bg-primary/10">
              {saveStatus}
            </span>
          </div>
          <button onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-8 pt-5 pb-3 flex-shrink-0">
          <div className="relative">
            <div className="absolute left-5 right-5 top-5 h-px bg-border -z-10" />
            <div className="grid grid-cols-[repeat(11,minmax(0,1fr))] items-start">
              {STEPS.map(({ id, label }, idx) => {
                const isActive = step === id;
                const isPast = step > id;
                const showArrow = idx < STEPS.length - 1;
                const arrowActive = step > id; // arrow lights up once current step has moved past this one
                return (
                  <div key={id} className="contents">
                    <div className="flex flex-col items-center gap-1.5 bg-card px-1 col-span-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
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
                        className={`text-[10px] font-semibold tracking-wider uppercase ${
                          isActive ? "text-secondary" : isPast ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                    </div>

                    {showArrow && (
                      <div className="flex items-center justify-center pt-[10px]">
                        <ChevronRight
                          className={`w-5 h-5 transition-colors ${
                            arrowActive ? "text-secondary" : "text-muted-foreground/50"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-8 py-5">

          {/* ── STEP 1: Info Dasar ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-foreground">Langkah 1: Informasi Dasar Proyek</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-sm">
                    Unit Organisasi <span className="text-destructive">*</span>
                  </Label>
                  {mode === "edit" && initialProject?.org_unit_id ? (
                    <div className="h-11 px-3 flex items-center rounded-md border border-input bg-muted/50 text-sm">
                      {(() => {
                        const ou = orgUnits.find((o) => o.id === initialProject.org_unit_id);
                        if (ou) return `${ou.code} — ${ou.name} (${ou.segment})`;
                        return `${initialProject.segment || initialProject.org_unit_id}`;
                      })()}
                      <span className="ml-2 text-xs text-muted-foreground">(tidak dapat diubah)</span>
                    </div>
                  ) : configQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat unit organisasi…</p>
                  ) : orgUnits.length === 0 ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Belum ada unit organisasi. Hubungi admin untuk assign org unit pada akun Anda.
                    </p>
                  ) : (
                    <>
                      <select
                        value={orgUnitId}
                        onChange={(e) => {
                          setOrgUnitId(e.target.value);
                          markDirty();
                        }}
                        disabled={orgPickerLocked}
                        className="h-11 w-full px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="">— Pilih unit organisasi —</option>
                        {orgUnits.map((ou) => (
                          <option key={ou.id} value={ou.id}>
                            {ou.code} — {ou.name} ({ou.type} / {ou.segment})
                          </option>
                        ))}
                      </select>
                      {orgPickerLocked && authUser?.org_unit_name && (
                        <p className="text-xs text-muted-foreground">
                          Terkunci ke unit Anda: {authUser.org_unit_code} — {authUser.org_unit_name}
                        </p>
                      )}
                      {canPickAnyOrg && (
                        <p className="text-xs text-muted-foreground">
                          Menentukan routing approval Asman/Manager dan segment data proyek.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Kode Proyek NAVPRO (otomatis) <span className="text-destructive">*</span></Label>
                  <Input value={codeDisplay} readOnly className="h-11 bg-muted/50 text-muted-foreground cursor-default" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nama Proyek Investasi <span className="text-destructive">*</span></Label>
                  <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Contoh: Pengadaan Jaringan Backbone Regional Sumatera" className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nama Pelanggan / Customer</Label>
                  <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Sama dengan NPWP / LKPP / iCRM" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nomor Kontrak / BAKBB</Label>
                  <Input value={contractNo} onChange={e => setContractNo(e.target.value)} placeholder="Jika sudah ada" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Tanggal Mulai Kontrak Proyek <span className="text-destructive">*</span></Label>
                  <Input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">PIC Sales</Label>
                  <Input value={picSales} onChange={e => setPicSales(e.target.value)} placeholder="Nama Sales / PIC Proyek" className="h-11" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Durasi & Override ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-foreground">Langkah 2: Konfigurasi Durasi &amp; Variabel Override</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 max-w-xs">
                  <Label className="text-sm">Durasi Proyek (Bulan) <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {(presets.length > 0
                      ? presets.map((p) => p.duration_months)
                      : [12, 24, 36, 60, 120]
                    ).filter((v, i, a) => a.indexOf(v) === i).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setDurationMonths(m);
                          markDirty();
                        }}
                        className={`shrink-0 px-3 py-2 text-sm rounded-md border font-medium transition-colors ${durationMonths === m ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        {m} Bln
                      </button>
                    ))}
                    <Input
                      type="number" min={1} max={120}
                      value={durationMonths}
                      onChange={e => setDurationMonths(Math.min(120, Math.max(1, Number(e.target.value))))}
                      className="shrink-0 h-10 w-24 text-center"
                      placeholder="Custom"
                    />
                  </div>
                </div>
              </div>
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-primary mb-0.5">Parameter Keuangan Proyek</h4>
                    <p className="text-xs text-muted-foreground">
                      Nilai default diisi otomatis dari Asumsi Master Finance Admin.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Dari Asumsi Master
                    {assumptionEffectiveDate ? ` · ${assumptionEffectiveDate}` : ""}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!useMasterAssumptions}
                    onChange={(e) => toggleCustomAssumptions(e.target.checked)}
                    className="rounded border-input"
                  />
                  Ubah parameter untuk proyek ini (override)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">WACC Tahunan (%)</Label>
                    <Input
                      value={displayWacc}
                      onChange={(e) => {
                        setWaccOverride(e.target.value);
                        markDirty();
                      }}
                      readOnly={useMasterAssumptions}
                      type="number"
                      step="0.01"
                      className={`h-10 ${useMasterAssumptions ? "bg-muted/50 cursor-default" : ""}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Inflasi Bulanan (%)</Label>
                    <Input
                      value={displayInflation}
                      onChange={(e) => {
                        setInflationOverride(e.target.value);
                        markDirty();
                      }}
                      readOnly={useMasterAssumptions}
                      type="number"
                      step="0.01"
                      className={`h-10 ${useMasterAssumptions ? "bg-muted/50 cursor-default" : ""}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Kurs USD (IDR)</Label>
                    <Input
                      value={displayKurs}
                      onChange={(e) => {
                        setKursUsdOverride(e.target.value);
                        markDirty();
                      }}
                      readOnly={useMasterAssumptions}
                      type="number"
                      step="1"
                      className={`h-10 ${useMasterAssumptions ? "bg-muted/50 cursor-default" : ""}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">BCR Mandatory</Label>
                    <Input
                      value={displayBcrMandatory}
                      onChange={(e) => {
                        setBcrMandatory(e.target.value);
                        markDirty();
                      }}
                      readOnly={useMasterAssumptions}
                      type="number"
                      step="0.01"
                      className={`h-10 ${useMasterAssumptions ? "bg-muted/50 cursor-default" : ""}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">BCR Minimum</Label>
                    <Input
                      value={displayBcrMinimum}
                      onChange={(e) => {
                        setBcrMinimum(e.target.value);
                        markDirty();
                      }}
                      readOnly={useMasterAssumptions}
                      type="number"
                      step="0.01"
                      className={`h-10 ${useMasterAssumptions ? "bg-muted/50 cursor-default" : ""}`}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-primary/10 text-primary p-3 rounded-lg text-sm border border-primary/20">
                <strong>Durasi aktif:</strong> {durationMonths} bulan — cashflow akan digenerate untuk periode 1 s.d. {durationMonths}.
              </div>
            </div>
          )}

          {/* ── STEP 3: CAPEX ────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Langkah 3: Input Belanja Modal (CAPEX)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Masukkan semua biaya investasi awal beserta bulan terjadinya (Bulan 0 = Tahun Investasi).</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-sm">
                  <div className="font-semibold text-foreground">Starter</div>
                  <div className="text-xs text-muted-foreground">Template RAB 8-item Lastmile (bisa diedit setelahnya).</div>
                </div>
                <Button variant="outline" size="sm" onClick={applyRab8Lastmile}>
                  Terapkan Template
                </Button>
              </div>
              {/* Add Row Form */}
              <div className="bg-muted/30 border border-border rounded-lg p-3 flex flex-wrap gap-2 items-end">
                <div className="flex-[2] min-w-[160px] space-y-1">
                  <Label className="text-xs">Nama Barang/Investasi</Label>
                  <Input value={capexInput.name} onChange={e => setCapexInput(p => ({ ...p, name: e.target.value }))} placeholder="Nama item..." className="h-8 text-sm" />
                </div>
                <div className="flex-[1] min-w-[120px] space-y-1">
                  <Label className="text-xs">Kategori</Label>
                  <select value={capexInput.category} onChange={e => setCapexInput(p => ({ ...p, category: e.target.value }))}
                    className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background text-foreground">
                    {CAPEX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-[1] min-w-[110px] space-y-1">
                  <Label className="text-xs">Nilai</Label>
                  <div className="flex gap-1">
                    <Input type="number" min={0} value={capexInput.amount} onChange={e => setCapexInput(p => ({ ...p, amount: Number(e.target.value) }))} className="h-8 text-sm" />
                    <select value={capexInput.currency} onChange={e => setCapexInput(p => ({ ...p, currency: e.target.value as "IDR" | "USD" }))}
                      className="h-8 px-1 border border-input rounded-md text-xs bg-background text-foreground w-16">
                      <option value="IDR">IDR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Bulan Ke-</Label>
                  <Input type="number" min={0} max={durationMonths} value={capexInput.period} onChange={e => setCapexInput(p => ({ ...p, period: Number(e.target.value) }))} className="h-8 text-sm" />
                </div>
                <Button size="sm" onClick={addCapex} className="h-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground">Tambah</Button>
              </div>
              {/* Table */}
              <div className="overflow-auto rounded-lg border border-border max-h-56">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-muted-foreground">Item CAPEX</th>
                      <th className="px-3 py-2 font-semibold text-muted-foreground">Kategori</th>
                      <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Nilai Modal</th>
                      <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Mata Uang</th>
                      <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Bulan Ke</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {capexRows.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada item CAPEX. Tambahkan di atas.</td></tr>
                    ) : capexRows.map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.amount.toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-center">{r.currency}</td>
                        <td className="px-3 py-2 text-center">{r.period}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => setCapexRows(p => p.filter(x => x.id !== r.id))} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right text-sm font-bold text-foreground">
                Total CAPEX: {formatRp(totalCapex)}
              </div>
            </div>
          )}

          {/* ── STEP 4: OPEX — Katalog Icon+ ─────────────────────────────────── */}
          {step === 4 && (
            <OpexCatalogStep
              durationMonths={durationMonths}
              catalog={opexCatalog}
              catalogLoading={configQuery.isLoading}
              opexRows={opexRows}
              setOpexRows={setOpexRows}
              onDirty={markDirty}
              formatRpTotal={formatRp}
            />
          )}

          {/* ── STEP 5: Kalkulator tarif → Revenue ─────────────────────────── */}
          {step === 5 && (
            <RevenueTariffStep
              durationMonths={durationMonths}
              customerName={customer}
              revenueRows={revenueRows}
              setRevenueRows={setRevenueRows}
              tariffSnapshot={tariffSnapshot}
              setTariffSnapshot={setTariffSnapshot}
              onDirty={markDirty}
              kursUsd={kursForPreview}
            />
          )}

          {/* ── STEP 6: Review & Hitung ──────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Langkah 6: Review &amp; Trigger Kalkulasi Finansial</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Tinjau ringkasan data proyek Anda sebelum memicu mesin kalkulasi.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Profil */}
                <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-2">Ringkasan Profil Proyek</h4>
                  {[
                    ["Kode Proyek", codeDisplay],
                    ["Nama Proyek", projectName || "—"],
                    ["Mulai Kontrak", contractDate],
                    ["Durasi Proyek", `${durationMonths} Bulan`],
                    ["Pelanggan", customer || "—"],
                    ["PIC Sales", picSales || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}:</span>
                      <strong className="text-foreground text-right max-w-[200px] truncate">{v}</strong>
                    </div>
                  ))}
                </div>
                {/* Parameter */}
                <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-2">Variabel Parameter</h4>
                  {[
                    ["WACC", `${displayWacc}%${useMasterAssumptions ? " (Master)" : " (Override)"}`],
                    ["Inflasi/bulan", `${displayInflation}%${useMasterAssumptions ? " (Master)" : " (Override)"}`],
                    ["Kurs USD", `${Number(displayKurs).toLocaleString("id-ID")}${useMasterAssumptions ? " (Master)" : " (Override)"}`],
                    ["BCR Mandatory", displayBcrMandatory],
                    ["BCR Minimum", displayBcrMinimum],
                    ["Total Item CAPEX", `${capexRows.length} item`],
                    ["Total CAPEX", formatRp(totalCapex)],
                    ["Total Item OPEX", `${opexRows.length} item`],
                    ["Total OPEX Baseline", `${formatRp(totalOpex)}/bln`],
                    ["Total Revenue Stream", `${revenueRows.length} item (dari kalkulator)`],
                    ["Paket tarif", tariffSnapshot?.params?.packageId ? TARIFF_PACKAGES.find(p => p.id === tariffSnapshot.params.packageId)?.label ?? tariffSnapshot.params.packageId : "—"],
                    ["Sewa Baseline", `${formatRp(totalRevSewa)}/bln`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}:</span>
                      <strong className="text-foreground">{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-lg text-sm flex gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Menekan <strong>Hitung</strong> akan menghitung <strong>NPV (XNPV), IRR (XIRR), BCR, Payback (Balik Modal),</strong> dan <strong>Kesimpulan Kelayakan</strong>. Status proyek berubah ke <code className="bg-primary/15 px-1 rounded">COMPUTED</code> setelah selesai.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-border flex-shrink-0 bg-card">
          <Button variant="outline" onClick={prev} disabled={step === 1} className="w-28 text-muted-foreground">
            Kembali
          </Button>
          <Button
            onClick={next}
            disabled={saving}
            className="w-28 bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-md"
          >
            {saving ? "Memproses…" : step === 6 ? "Hitung" : "Lanjut"}
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
}
