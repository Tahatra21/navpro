"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import {
  ADMIN_TAB_GROUPS,
  ADMIN_TAB_MAP,
  type AdminTabId,
} from "@/app/(dashboard)/admin/admin-config";

type Props = {
  tab: AdminTabId;
  onTabChange: (id: AdminTabId) => void;
  backendOnline: boolean | null;
};

export function AdminSidebar({ tab, onTabChange, backendOnline }: Props) {
  const recheckBackend = useAuthStore((s) => s.recheckBackend);
  const [rechecking, setRechecking] = useState(false);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await recheckBackend();
    } finally {
      setRechecking(false);
    }
  };

  return (
    <Card className="p-2 lg:sticky lg:top-4 h-fit">
      <nav className="space-y-4" aria-label="Navigasi panel admin">
        {ADMIN_TAB_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.tabIds.map((id) => {
                const def = ADMIN_TAB_MAP[id];
                const Icon = def.icon;
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onTabChange(id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? "bg-primary/10 text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                        active
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-transparent bg-muted/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate">{def.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {backendOnline === false && (
        <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900">
          <p>Backend offline. Panel Admin membutuhkan koneksi backend.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={rechecking}
            onClick={handleRecheck}
          >
            {rechecking ? "Menghubungkan…" : "Coba hubungkan lagi"}
          </Button>
        </div>
      )}
    </Card>
  );
}
