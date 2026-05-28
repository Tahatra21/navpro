"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, FolderKanban, CheckCircle2, Settings, ChevronDown, KeyRound, UserCog, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuthStore } from "@/stores/authStore";
import { canViewAdmin, canViewApprovals } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { MagicNav } from "@/components/layout/MagicNav";
import type { UserRole } from "@/types/navpro";
import { navproApi } from "@/services/api";
import { useToast } from "@/components/shared/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    icon: LayoutDashboard,
    match: (p: string) => p === "/dashboard",
  },
  {
    href: "/projects",
    label: "Daftar Proyek",
    shortLabel: "Proyek",
    icon: FolderKanban,
    match: (p: string) => p.startsWith("/projects"),
  },
  {
    href: "/approvals",
    label: "Approvals",
    shortLabel: "Approvals",
    icon: CheckCircle2,
    match: (p: string) => p.startsWith("/approvals"),
    roles: canViewApprovals,
  },
  {
    href: "/admin",
    label: "Admin",
    shortLabel: "Admin",
    icon: Settings,
    match: (p: string) => p.startsWith("/admin"),
    roles: canViewAdmin,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, backendOnline, logout, setUser } = useAuthStore();
  const roleOverride = useAuthStore((s: { roleOverride: UserRole | null }) => s.roleOverride);
  const effectiveRole = roleOverride || user?.role;
  const toast = useToast();

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const initials = useMemo(() => {
    const n = (user?.full_name || "").trim();
    if (!n) return "NP";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "N";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : (parts[0]?.[1] || "P");
    return `${a}${b}`.toUpperCase();
  }, [user?.full_name]);

  useEffect(() => {
    setFullName(user?.full_name || "");
  }, [user?.full_name]);

  useEffect(() => {
    if (!prefsOpen) {
      setFullName(user?.full_name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsOpen]);

  useEffect(() => {
    if (!pwdOpen) {
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }, [pwdOpen]);

  const roleLabel = useMemo(() => {
    const r = (effectiveRole || "").replace("_", " ");
    return roleOverride ? `${r} (override)` : r;
  }, [effectiveRole, roleOverride]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Image
            src="/img/logonav2.png"
            alt="NAVPRO"
            width={200}
            height={200}
            priority
            className="mx-auto h-auto w-auto max-w-[220px] object-contain"
          />
          <p className="text-sm text-muted-foreground animate-pulse">Memuat NAVPRO…</p>
        </div>
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles(effectiveRole));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-[4.5rem] max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-4 sm:gap-5 shrink-0 group max-w-[min(100%,20rem)]"
          >
            <Image
              src="/img/logonav2.png"
              alt="NAVPRO"
              width={168}
              height={56}
              priority
              className="h-11 sm:h-12 w-auto min-w-[7.5rem] sm:min-w-[8.75rem] max-w-[9.5rem] sm:max-w-[10.5rem] object-contain object-left flex-shrink-0"
            />
            <div className="hidden sm:block flex-shrink-0 pl-0.5 border-l border-border/50 ml-0.5">
              <span className="font-bold text-foreground tracking-wide text-sm block leading-tight whitespace-nowrap">
                NAVPRO
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                Your Compass for Viable Project
              </span>
            </div>
          </Link>

          <div className="flex-1 hidden md:flex justify-center items-center min-w-0 px-2">
            <MagicNav items={visibleNav} pathname={pathname} variant="header" />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className={cn(
                "hidden md:inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border",
                backendOnline
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-800 border-amber-500/30"
              )}
              title="Status koneksi API"
            >
              {backendOnline ? "Online" : "Offline"}
            </span>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2.5 py-2 transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  )}
                  aria-label="User menu"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                  <div className="hidden lg:block text-right leading-tight">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {roleLabel}
                    </p>
                    <p className="text-sm font-semibold text-foreground max-w-[220px] truncate">{user?.full_name}</p>
                  </div>
                  <div className="lg:hidden flex flex-col items-end leading-tight">
                    <p className="text-xs font-semibold text-foreground max-w-[140px] truncate">{user?.full_name || "Akun"}</p>
                    <p className="text-[10px] text-muted-foreground max-w-[140px] truncate">{roleLabel}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">{user?.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPrefsOpen(true)}>
                  <UserCog className="w-4 h-4 text-muted-foreground" />
                  Preferences / Profil
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPwdOpen(true)}>
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  Update Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={async () => {
                    await logout();
                    toast.info("Anda sudah logout.");
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 pb-[4.75rem] md:pb-6">
        {children}
      </main>

      {/* Mobile: magic nav bottom bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center pb-3 px-4 pointer-events-none">
        <MagicNav
          items={visibleNav}
          pathname={pathname}
          variant="bottom"
          className="pointer-events-auto"
        />
      </div>

      {/* Preferences dialog */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferences / Profil</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nama lengkap</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" />
              <p className="text-[11px] text-muted-foreground">Nama ini ditampilkan di header dan audit log.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrefsOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              onClick={async () => {
                const name = fullName.trim();
                if (!name) {
                  toast.error("Nama lengkap wajib diisi.");
                  return;
                }
                setBusy(true);
                try {
                  const { user: next } = await navproApi.updateProfile({ full_name: name });
                  setUser(next);
                  toast.success("Profil berhasil diperbarui.");
                  setPrefsOpen(false);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Gagal memperbarui profil.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Password</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Password saat ini</Label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Password saat ini"
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Password baru</Label>
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Konfirmasi password baru</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Demi keamanan, perubahan password membutuhkan password saat ini.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!currentPw || !newPw) {
                  toast.error("Password saat ini dan password baru wajib diisi.");
                  return;
                }
                if (newPw.length < 8) {
                  toast.error("Password baru minimal 8 karakter.");
                  return;
                }
                if (newPw !== confirmPw) {
                  toast.error("Konfirmasi password tidak sama.");
                  return;
                }
                setBusy(true);
                try {
                  await navproApi.changePassword({ current_password: currentPw, new_password: newPw });
                  toast.success("Password berhasil diperbarui.");
                  setCurrentPw("");
                  setNewPw("");
                  setConfirmPw("");
                  setPwdOpen(false);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Gagal memperbarui password.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Simpan Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
