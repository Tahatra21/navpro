"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import { navproApi } from "@/services/api";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => navproApi.getNotifications(),
    enabled: backendOnline === true,
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: () => navproApi.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.notifications || [];
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifikasi"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Notifikasi</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAll.mutate()}
                disabled={unread === 0}
              >
                Tandai Dibaca
              </Button>
            </div>
            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Tidak ada notifikasi</p>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border/50 text-sm ${!n.is_read ? "bg-primary/5" : ""}`}
                  >
                    <p className="font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
