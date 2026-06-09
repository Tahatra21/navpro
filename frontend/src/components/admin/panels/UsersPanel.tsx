"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminFilterBar,
  AdminPanelAlert,
  AdminPanelCard,
  adminSelectClass,
} from "@/components/admin/AdminPanelCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminStatusBadge, activeBadge } from "@/components/admin/AdminStatusBadge";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/shared/toast";
import { ORG_LEVEL_OPTIONS, USER_ROLE_OPTIONS } from "./constants";
import type { AdminUserRow, OrgUnitRow } from "./types";

const PAGE_SIZE = 10;

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Props = {
  orgUnits: OrgUnitRow[];
};

export function UsersPanel({ orgUnits }: Props) {
  const qc = useQueryClient();
  const backendOnline = useAuthStore((s) => s.backendOnline);
  const myRole = useAuthStore((s: { user: { role: string } | null }) => s.user?.role || null);
  const canEditEmail = myRole === "SUPER_ADMIN";
  const ROLE_OPTIONS = USER_ROLE_OPTIONS;
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [draft, setDraft] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    password: string;
    employee_id: string;
    org_unit_id: string;
    org_level: string;
  }>({
    id: "",
    email: "",
    full_name: "",
    role: "VIEWER",
    is_active: true,
    password: "",
    employee_id: "",
    org_unit_id: "",
    org_level: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const activeParam =
    activeFilter === "ACTIVE" ? "active" : activeFilter === "INACTIVE" ? "inactive" : "";

  const usersQuery = useQuery({
    queryKey: ["admin-users", page, PAGE_SIZE, debouncedSearch, roleFilter, activeParam],
    queryFn: () =>
      navproApi.adminGetUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        role: roleFilter,
        active: activeParam,
      }),
    enabled: backendOnline === true,
  });

  const users = (usersQuery.data?.users ?? []) as AdminUserRow[];
  const total = usersQuery.data?.total ?? 0;

  const refreshUsers = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const openCreate = () => {
    setErr("");
    setMode("create");
    setDraft({
      id: "",
      email: "",
      full_name: "",
      role: "VIEWER",
      is_active: true,
      password: "",
      employee_id: "",
      org_unit_id: "",
      org_level: "",
    });
    setOpen(true);
  };

  const openEdit = (u: AdminUserRow) => {
    setErr("");
    setMode("edit");
    setDraft({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      is_active: !!u.is_active,
      password: "",
      employee_id: u.employee_id || "",
      org_unit_id: u.org_unit_id || "",
      org_level: u.org_level || "",
    });
    setOpen(true);
  };

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        email: String(draft.email || "").trim().toLowerCase(),
        full_name: String(draft.full_name || "").trim(),
        role: String(draft.role || "VIEWER"),
        is_active: !!draft.is_active,
        employee_id: String(draft.employee_id || "").trim() || null,
        org_unit_id: String(draft.org_unit_id || "").trim() || null,
        org_level: String(draft.org_level || "").trim() || null,
      };
      if (mode === "create" && !payload.email) throw new Error("Email wajib diisi.");
      if (!payload.full_name) throw new Error("Nama wajib diisi.");
      if (!ROLE_OPTIONS.includes(payload.role as (typeof ROLE_OPTIONS)[number])) {
        throw new Error("Role tidak valid.");
      }

      if (mode === "create") {
        const pwd = String(draft.password || "").trim();
        if (pwd.length < 8) throw new Error("Password wajib diisi (minimal 8 karakter).");
        await navproApi.adminCreateUser({ ...payload, password: pwd });
      } else {
        if (draft.is_active === false) {
          const ok = window.confirm(`Nonaktifkan user "${draft.full_name}"? Mereka tidak bisa login sampai diaktifkan kembali.`);
          if (!ok) {
            setBusy(false);
            return;
          }
        }
        if (canEditEmail) await navproApi.adminUpdateUser(String(draft.id), payload);
        else {
          await navproApi.adminUpdateUser(String(draft.id), {
            full_name: payload.full_name,
            role: payload.role,
            is_active: payload.is_active,
            employee_id: payload.employee_id,
            org_unit_id: payload.org_unit_id,
            org_level: payload.org_level,
          });
        }
      }
      setOpen(false);
      refreshUsers();
      toast.success(mode === "create" ? "User berhasil dibuat." : "User berhasil diperbarui.");
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Gagal menyimpan user.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, role…"
            className="sm:max-w-xs"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={adminSelectClass}>
            <option value="">Semua role</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className={adminSelectClass}>
            <option value="">Semua status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{total} user</span>
          <Button variant="outline" size="sm" onClick={() => usersQuery.refetch()} disabled={busy || usersQuery.isFetching}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} disabled={busy}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah User
          </Button>
        </div>
      </AdminFilterBar>

      {usersQuery.isError ? (
        <AdminPanelAlert variant="error">
          {usersQuery.error instanceof Error ? usersQuery.error.message : "Gagal memuat pengguna."}
        </AdminPanelAlert>
      ) : null}

      {err ? <AdminPanelAlert variant="error">{err}</AdminPanelAlert> : null}

      <AdminPanelCard
        title="Daftar pengguna"
        description="Akun, role, dan unit organisasi"
        icon={Users}
        accent="primary"
        badge={`${total} user`}
      >
        <AdminDataTable
        columns={[
          {
            id: "name",
            header: "Nama",
            cell: (u) => <span className="font-medium">{u.full_name}</span>,
          },
          {
            id: "email",
            header: "Email",
            cell: (u) => <span className="text-xs text-muted-foreground">{u.email}</span>,
          },
          {
            id: "role",
            header: "Role",
            cell: (u) => <AdminStatusBadge label={u.role} variant="info" />,
          },
          {
            id: "org",
            header: "Unit org",
            cell: (u) =>
              u.org_unit_code ? (
                <span className="text-xs">
                  {u.org_unit_code}
                  {u.org_level ? ` · ${u.org_level}` : ""}
                </span>
              ) : (
                <span className="text-xs text-amber-700">Belum assign</span>
              ),
          },
          {
            id: "status",
            header: "Status",
            cell: (u) => activeBadge(!!u.is_active),
          },
          {
            id: "actions",
            header: "",
            headerClassName: "text-right",
            className: "text-right",
            cell: (u) => (
              <Button variant="outline" size="sm" onClick={() => openEdit(u)} disabled={busy}>
                Edit
              </Button>
            ),
          },
        ]}
        data={users}
        getRowKey={(u) => u.id}
        pageSize={PAGE_SIZE}
        loading={usersQuery.isLoading}
        paginationMode="server"
        totalCount={total}
        page={page}
        onPageChange={setPage}
        resetKey={`${debouncedSearch}-${roleFilter}-${activeFilter}`}
        emptyTitle="Tidak ada user"
        emptyDescription="Sesuaikan filter atau tambah user baru."
        />
      </AdminPanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah User" : "Edit User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={draft.email}
                onChange={(e) => setDraft((s) => ({ ...s, email: e.target.value }))}
                disabled={mode === "edit" && !canEditEmail}
              />
              {mode === "edit" && !canEditEmail && (
                <p className="text-xs text-muted-foreground">
                  Email hanya dapat diubah oleh <span className="font-semibold">SUPER_ADMIN</span>.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input
                value={draft.full_name}
                  onChange={(e) => setDraft((s) => ({ ...s, full_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  value={draft.role}
                  onChange={(e) => setDraft((s) => ({ ...s, role: e.target.value }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Active</Label>
                <select
                  value={draft.is_active ? "true" : "false"}
                  onChange={(e) => setDraft((s) => ({ ...s, is_active: e.target.value === "true" }))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Employee ID (opsional)</Label>
              <Input
                value={draft.employee_id}
                onChange={(e) => setDraft((s) => ({ ...s, employee_id: e.target.value }))}
                placeholder="NIP / ID karyawan"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit Organisasi</Label>
              <select
                value={draft.org_unit_id}
                onChange={(e) => setDraft((s) => ({ ...s, org_unit_id: e.target.value }))}
                className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">— Belum di-assign —</option>
                {orgUnits.map((ou) => (
                  <option key={ou.id} value={ou.id}>
                    {ou.code} — {ou.name} ({ou.segment})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Wajib untuk SA/ASMAN/MANAGER agar routing approval dan scope data berfungsi.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Level Organisasi</Label>
              <select
                value={draft.org_level}
                onChange={(e) => setDraft((s) => ({ ...s, org_level: e.target.value }))}
                className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">— Otomatis / kosong —</option>
                {ORG_LEVEL_OPTIONS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </div>
            {mode === "edit" && canEditEmail && (
              <Card className="p-3 border border-destructive/20 bg-destructive/5">
                <p className="text-sm font-semibold text-foreground">Reset Password</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Masukkan password baru (min. 8 karakter). Bagikan ke user lewat saluran aman.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="password"
                    placeholder="Password baru"
                    value={draft.password}
                    onChange={(e) => setDraft((s) => ({ ...s, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy || String(draft.password || "").length < 8}
                    onClick={async () => {
                      const ok = window.confirm(`Reset password untuk "${draft.full_name}"?`);
                      if (!ok) return;
                      setBusy(true);
                      setErr("");
                      try {
                        await navproApi.adminResetUserPassword(String(draft.id), String(draft.password));
                        setDraft((s) => ({ ...s, password: "" }));
                        toast.success("Password berhasil di-reset.");
                      } catch (e: unknown) {
                        setErr(e instanceof Error ? e.message : "Gagal reset password.");
                        toast.error(e instanceof Error ? e.message : "Gagal reset password.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Reset Password
                  </Button>
                </div>
              </Card>
            )}
            {mode === "create" && (
              <div className="space-y-1">
                <Label>Password (wajib, min. 8 karakter)</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={draft.password}
                    onChange={(e) => setDraft((s) => ({ ...s, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const bytes = new Uint8Array(12);
                      crypto.getRandomValues(bytes);
                      const chunk = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
                      setDraft((s) => ({ ...s, password: `Np-${chunk}!` }));
                    }}
                  >
                    Generate
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
