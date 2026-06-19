"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/toast";
import { canApproveHjtAtRole } from "@/lib/rbac";

export default function HjtApprovalsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const backendOnline = useAuthStore((s) => s.backendOnline);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["hjt-approval-queue"],
    queryFn: () => navproApi.hjtApprovalQueue(),
    enabled: backendOnline === true,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => navproApi.hjtApproveQuotation(id),
    onSuccess: () => {
      toast.success("Disetujui.");
      qc.invalidateQueries({ queryKey: ["hjt-approval-queue"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => navproApi.hjtRejectQuotation(id, note),
    onSuccess: () => {
      toast.success("Ditolak.");
      qc.invalidateQueries({ queryKey: ["hjt-approval-queue"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval HJT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Antrian penawaran connectivity — terpisah dari approval KKF
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Grand Total</th>
              <th className="px-4 py-3">Floor</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Submit</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Tidak ada penawaran menunggu approval.
                </td>
              </tr>
            ) : (
              items.map((q) => {
                const canAct = canApproveHjtAtRole(user?.role, q.current_approval_role);
                return (
                  <tr key={q.id} className="border-t">
                    <td className="px-4 py-3">
                      <Link href={`/hjt/quotations/${q.id}`} className="font-medium text-primary hover:underline">
                        {q.customer_name || "—"}
                      </Link>
                      <div className="mt-1">
                        <StatusBadge status={q.status.toUpperCase()} />
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {q.grand_total_all != null ? formatCurrency(Number(q.grand_total_all)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {q.floor_override_justification ? (
                        <span className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1">
                          Di bawah floor
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{q.current_approval_role || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(q.submitted_at)}</td>
                    <td className="px-4 py-3">
                      {canAct ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <Input
                            placeholder="Catatan penolakan"
                            value={rejectNotes[q.id] || ""}
                            onChange={(e) =>
                              setRejectNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => approveMut.mutate(q.id)} disabled={approveMut.isPending}>
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={rejectMut.isPending || !(rejectNotes[q.id] || "").trim()}
                              onClick={() =>
                                rejectMut.mutate({ id: q.id, note: rejectNotes[q.id] })
                              }
                            >
                              Tolak
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Menunggu {q.current_approval_role}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
