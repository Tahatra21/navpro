"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/shared/toast";
import { ExchangeRateAdminPanel } from "@/components/kurs/ExchangeRateAdminPanel";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminSummaryBar } from "@/components/admin/AdminSummaryBar";
import { AdminContentShell } from "@/components/admin/AdminContentShell";
import {
  AssumptionsPanel,
  AuditPanel,
  CategoriesPanel,
  HealthPanel,
  HjtTariffPanel,
  NotificationTemplatesPanel,
  OrgPanel,
  PresetsPanel,
  SlaPanel,
  SystemConfigPanel,
  UsersPanel,
  type OrgUnitRow,
} from "@/components/admin/panels";
import { ADMIN_TAB_MAP, parseAdminTab, type AdminTabId } from "./admin-config";

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-10 rounded-xl bg-muted" />
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <div className="h-96 rounded-xl bg-muted" />
            <div className="h-96 rounded-xl bg-muted" />
          </div>
        </div>
      }
    >
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = parseAdminTab(searchParams.get("tab"));
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const recheckBackend = useAuthStore((s) => s.recheckBackend);
  const qc = useQueryClient();
  const activeTab = ADMIN_TAB_MAP[tab];
  const toast = useToast();

  useEffect(() => {
    recheckBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat buka admin
  }, []);

  const setTab = (id: AdminTabId) => {
    router.replace(`/admin?tab=${id}`, { scroll: false });
  };

  const assumptions = useQuery({
    queryKey: ["admin-assumptions"],
    queryFn: () => navproApi.adminGetAssumptions(),
    enabled: backendOnline === true && tab === "assumptions",
  });

  const assumptionsHistory = useQuery({
    queryKey: ["admin-assumptions-history"],
    queryFn: () => navproApi.adminGetAssumptionsHistory(),
    enabled: backendOnline === true && tab === "assumptions",
  });

  const presets = useQuery({
    queryKey: ["admin-presets"],
    queryFn: () => navproApi.adminGetPresets(),
    enabled: backendOnline === true && tab === "presets",
  });

  const sla = useQuery({
    queryKey: ["admin-sla"],
    queryFn: () => navproApi.adminGetSla(),
    enabled: backendOnline === true && tab === "sla",
  });

  const capexCats = useQuery({
    queryKey: ["admin-capex-cats"],
    queryFn: () => navproApi.adminGetCapexCategories(),
    enabled: backendOnline === true && tab === "categories",
  });

  const opexCats = useQuery({
    queryKey: ["admin-opex-cats"],
    queryFn: () => navproApi.adminGetOpexCategories(),
    enabled: backendOnline === true && tab === "categories",
  });

  const orgUnits = useQuery({
    queryKey: ["admin-org-units"],
    queryFn: () => navproApi.adminGetOrgUnits(),
    enabled: backendOnline === true && (tab === "org" || tab === "users"),
  });

  const systemConfig = useQuery({
    queryKey: ["admin-system-config"],
    queryFn: () => navproApi.adminGetSystemConfig(),
    enabled: backendOnline === true && tab === "system",
  });

  const notifTemplates = useQuery({
    queryKey: ["admin-notif-templates"],
    queryFn: () => navproApi.adminGetSystemConfig(),
    enabled: backendOnline === true && tab === "templates",
  });

  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => navproApi.adminGetSystemHealth(),
    enabled: backendOnline === true && tab === "health",
  });

  const setMaintenance = useMutation({
    mutationFn: (enabled: boolean) => navproApi.adminSetMaintenance(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-health"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Admin</p>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Panel Admin NAVPRO</h1>
        <AdminSummaryBar backendOnline={backendOnline} onGoKurs={() => setTab("kurs")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <AdminSidebar tab={tab} onTabChange={setTab} backendOnline={backendOnline} />

        <AdminContentShell title={activeTab.label} description={activeTab.desc} hints={activeTab.hints}>
          {tab === "assumptions" && (
            <AssumptionsPanel
              data={assumptions.data}
              history={assumptionsHistory.data}
              loading={assumptions.isLoading}
              onSave={async (next) => {
                try {
                  await navproApi.adminSaveAssumptions(next);
                  qc.invalidateQueries({ queryKey: ["admin-assumptions"] });
                  qc.invalidateQueries({ queryKey: ["admin-assumptions-history"] });
                  toast.success("Asumsi master berhasil disimpan.");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Gagal menyimpan asumsi.");
                  throw e;
                }
              }}
            />
          )}
          {tab === "kurs" && <ExchangeRateAdminPanel standalone />}
          {tab === "presets" && (
            <PresetsPanel data={presets.data} loading={presets.isLoading} onRefresh={() => presets.refetch()} />
          )}
          {tab === "sla" && <SlaPanel data={sla.data} loading={sla.isLoading} onRefresh={() => sla.refetch()} />}
          {tab === "categories" && (
            <CategoriesPanel
              capex={capexCats.data}
              opex={opexCats.data}
              loading={capexCats.isLoading || opexCats.isLoading}
              onRefresh={() => {
                capexCats.refetch();
                opexCats.refetch();
              }}
            />
          )}
          {tab === "system" && (
            <SystemConfigPanel
              data={systemConfig.data}
              loading={systemConfig.isLoading}
              onSave={async (key, val) => {
                try {
                  await navproApi.adminSetSystemConfig(key, val);
                  qc.invalidateQueries({ queryKey: ["admin-system-config"] });
                  qc.invalidateQueries({ queryKey: ["admin-health"] });
                  toast.success("System config tersimpan.");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Gagal menyimpan system config.");
                  throw e;
                }
              }}
            />
          )}
          {tab === "templates" && (
            <NotificationTemplatesPanel
              data={notifTemplates.data}
              loading={notifTemplates.isLoading}
              onSave={async (key, val) => {
                try {
                  await navproApi.adminSetSystemConfig(key, val);
                  qc.invalidateQueries({ queryKey: ["admin-notif-templates"] });
                  toast.success("Template notifikasi tersimpan.");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Gagal menyimpan template.");
                  throw e;
                }
              }}
            />
          )}
          {tab === "org" && (
            <OrgPanel data={orgUnits.data} loading={orgUnits.isLoading} onRefresh={() => orgUnits.refetch()} />
          )}
          {tab === "users" && (
            <UsersPanel
              orgUnits={(orgUnits.data as { org_units?: OrgUnitRow[] })?.org_units || []}
            />
          )}
          {tab === "audit" && <AuditPanel />}
          {tab === "health" && (
            <HealthPanel
              data={health.data}
              loading={health.isLoading}
              toggling={setMaintenance.isPending}
              onToggle={(enabled) => setMaintenance.mutate(enabled)}
            />
          )}
          {tab === "hjt-tariff" && <HjtTariffPanel />}
        </AdminContentShell>
      </div>
    </div>
  );
}
