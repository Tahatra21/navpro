"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Send,
  Check,
  Copy,
  Archive,
  Pencil,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CashflowTable } from "@/components/projects/CashflowTable";
import { CashflowChart } from "@/components/projects/CashflowChart";
import { ApprovalChain } from "@/components/projects/ApprovalChain";
import { ProjectAuditLog } from "@/components/projects/ProjectAuditLog";
import { VersionHistory } from "@/components/projects/VersionHistory";
import { ExecutiveSummary } from "@/components/projects/ExecutiveSummary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  canApproveAtStatus,
  canCreateProject,
  canEditProject,
  canRejectAtStatus,
  canSubmitProject,
} from "@/lib/rbac";
import { formatDate, formatDurationCategory } from "@/lib/format";
import { offlineGetProject, offlineSaveProject } from "@/lib/offline-cache";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s: { user: import("@/types/navpro").User | null }) => s.user);
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const id = params.id as string;
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateReason, setDelegateReason] = useState("");
  const [delegateToId, setDelegateToId] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["project", id],
    queryFn: () => navproApi.getProject(id),
    enabled: backendOnline !== false,
  });

  const onlineProject = data?.project;
  if (backendOnline === true && onlineProject) offlineSaveProject(onlineProject);
  const project = backendOnline === true ? onlineProject : offlineGetProject(id);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project", id] });
    qc.invalidateQueries({ queryKey: ["portfolio"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["approval-queue"] });
    qc.invalidateQueries({ queryKey: ["approvals-queue-v2"] });
  };

  const calculate = useMutation({
    mutationFn: async () => {
      try {
        const asyncRes = await navproApi.calculateProjectAsync(id);
        for (let i = 0; i < 30; i++) {
          const job = await navproApi.getJobStatus(asyncRes.job_id);
          if (job.state === "completed") return;
          if (job.state === "failed") throw new Error(job.failed_reason || "Kalkulasi gagal");
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch {
        await navproApi.calculateProject(id);
      }
    },
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: () => navproApi.submitProject(id, comment || undefined),
    onSuccess: () => {
      setComment("");
      setActionError("");
      refetch();
      invalidate();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const approve = useMutation({
    mutationFn: () => navproApi.approveProject(id, comment || undefined),
    onSuccess: () => {
      setComment("");
      setActionError("");
      refetch();
      invalidate();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const reject = useMutation({
    mutationFn: () => navproApi.rejectProject(id, rejectComment),
    onSuccess: () => {
      setRejectOpen(false);
      setRejectComment("");
      refetch();
      invalidate();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const canDoApproval = canApproveAtStatus(user?.role, project?.status ?? "");
  const { data: myStepData } = useQuery({
    queryKey: ["my-approval-step", id],
    queryFn: () => navproApi.getMyApprovalStep(id),
    enabled: backendOnline !== false && !!canDoApproval,
  });
  const myStep = myStepData?.step;

  const { data: delegateCandidates } = useQuery({
    queryKey: ["delegate-candidates", myStep?.id],
    queryFn: () => navproApi.getDelegateCandidates(myStep!.id),
    enabled: delegateOpen && !!myStep?.id,
  });

  const delegate = useMutation({
    mutationFn: () =>
      navproApi.delegateApprovalStep(myStep!.id, {
        to_user_id: delegateToId,
        reason: delegateReason.trim(),
      }),
    onSuccess: () => {
      setDelegateOpen(false);
      setDelegateReason("");
      setDelegateToId("");
      setActionError("");
      refetch();
      invalidate();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const duplicate = useMutation({
    mutationFn: () => navproApi.duplicateProject(id),
    onSuccess: (res) => router.push(`/projects/${res.project.id}/edit`),
  });

  const archive = useMutation({
    mutationFn: () => navproApi.archiveProject(id),
    onSuccess: () => router.push("/projects"),
  });

  const exportPdf = useMutation({
    mutationFn: async () => {
      const blob = await navproApi.downloadProjectPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NAVPRO_${project?.project_code || id}_ExecutiveSummary.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const exportXlsx = useMutation({
    mutationFn: async () => {
      const blob = await navproApi.downloadProjectXlsx(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NAVPRO_${project?.project_code || id}_Cashflow.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Memuat detail proyek…</p>;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Proyek tidak ditemukan.</p>
        <Button variant="link" onClick={() => router.push("/projects")}>
          Kembali ke daftar
        </Button>
      </div>
    );
  }

  const canCalc =
    canCreateProject(user?.role) &&
    ["DRAFT", "COMPUTED", "REJECTED"].includes(project.status);
  const canSubmit = canSubmitProject(user?.role, project.status) && !!project.kpi?.xirr;
  const canDoReject = canRejectAtStatus(user?.role, project.status);
  const rejectMinLen = 20;
  const canEdit = canEditProject(user?.role, project.status);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/projects">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Kembali
        </Link>
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{project.project_name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{project.project_code}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Mulai kontrak: {formatDate(project.contract_start_date)} · Durasi{" "}
            {project.project_duration_months} bulan · {formatDurationCategory(project.duration_category)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${id}/edit`}>
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Link>
            </Button>
          )}
          {canCreateProject(user?.role) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => duplicate.mutate()}
              disabled={duplicate.isPending}
            >
              <Copy className="w-4 h-4 mr-1" />
              Duplikasi
            </Button>
          )}
          {canCalc && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => calculate.mutate()}
              disabled={calculate.isPending}
            >
              <Calculator className="w-4 h-4 mr-1" />
              {calculate.isPending ? "Menghitung…" : "Hitung Ulang"}
            </Button>
          )}
          {canSubmitProject(user?.role, project.status) && (
            <Button
              size="sm"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !canSubmit}
              title={!canSubmit ? "Jalankan kalkulasi terlebih dahulu" : undefined}
            >
              <Send className="w-4 h-4 mr-1" />
              Submit
            </Button>
          )}
          {canCreateProject(user?.role) && project.status !== "ARCHIVED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Arsipkan proyek ini?")) archive.mutate();
              }}
              disabled={archive.isPending}
            >
              <Archive className="w-4 h-4 mr-1" />
              Arsip
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPdf.mutate()}
            disabled={exportPdf.isPending}
          >
            {exportPdf.isPending ? "Menyiapkan PDF…" : "Export PDF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportXlsx.mutate()}
            disabled={exportXlsx.isPending}
          >
            {exportXlsx.isPending ? "Menyiapkan XLSX…" : "Export XLSX"}
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-1">
        <div className="mb-3">
          <h2 className="font-semibold text-lg">Executive Summary</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ringkasan untuk review manajemen — kesimpulan, metrik utama, dan dasar perhitungan dalam satu tampilan.
          </p>
        </div>
        <ExecutiveSummary project={project} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)] gap-6 items-start">
        <div className="space-y-6 min-w-0 order-2 xl:order-1">
          <section
            id="cashflow"
            className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 scroll-mt-24"
          >
            <div>
              <h2 className="font-semibold text-lg">Cashflow Bulanan</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Spreadsheet arus kas — geser ke samping untuk melihat semua periode.
              </p>
            </div>
            <CashflowChart periods={project.cashflow_monthly || []} />
            <CashflowTable periods={project.cashflow_monthly || []} />
          </section>

          {project.status === "APPROVED" && (
            <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3">
              Proyek disetujui final. Executive summary PDF tersedia via tombol Export PDF di atas.
            </p>
          )}

          {project.versions && project.versions.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-lg mb-3">Riwayat Versi Kalkulasi</h2>
              <VersionHistory projectId={id} versions={project.versions} />
            </section>
          )}
        </div>

        <aside className="order-1 xl:order-2 space-y-4 w-full xl:sticky xl:top-[4.75rem] xl:self-start">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-lg pb-3 mb-1 border-b border-border">
              Workflow Approval
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Status persetujuan per tahap — selalu terlihat di samping data kajian.
            </p>
            <ApprovalChain project={project} />

            {(canDoApproval || canDoReject) && (
              <div className="mt-5 pt-4 border-t border-border space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Tindakan Anda</h3>
                {actionError && (
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {actionError}
                  </p>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">Komentar (opsional untuk setujui)</Label>
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  {canDoApproval && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => approve.mutate()}
                      disabled={approve.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Setujui
                    </Button>
                  )}
                  {canDoReject && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setRejectOpen(true)}
                    >
                      Tolak
                    </Button>
                  )}
                  {canDoApproval && myStep && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setDelegateOpen(true)}
                    >
                      <UserRoundCog className="w-4 h-4 mr-1" />
                      Delegasi
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-lg pb-3 mb-3 border-b border-border">
              Audit Trail
            </h2>
            <p className="text-xs text-muted-foreground mb-3">Log aktivitas terbaru pada proyek ini.</p>
            <ProjectAuditLog projectId={id} compact />
          </section>
        </aside>
      </div>

      <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delegasi Approval</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alihkan tanggung jawab step {myStep?.approver_level} ke rekan selevel (min. 10 karakter alasan).
          </p>
          <div className="space-y-2">
            <Label>Delegasikan ke</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={delegateToId}
              onChange={(e) => setDelegateToId(e.target.value)}
            >
              <option value="">— Pilih user —</option>
              {(delegateCandidates?.candidates || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={delegateReason}
            onChange={(e) => setDelegateReason(e.target.value)}
            placeholder="Alasan delegasi (cuti, beban kerja, dll.)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegateOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !delegateToId ||
                delegateReason.trim().length < 10 ||
                delegate.isPending
              }
              onClick={() => delegate.mutate()}
            >
              {delegate.isPending ? "Memproses…" : "Konfirmasi Delegasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Proyek</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Komentar wajib diisi minimal {rejectMinLen} karakter (BR-A03).
          </p>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Alasan penolakan…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={rejectComment.trim().length < rejectMinLen || reject.isPending}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? "Memproses…" : "Konfirmasi Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
