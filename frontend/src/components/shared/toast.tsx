"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  ttlMs: number;
};

type ToastApi = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((variant: ToastVariant, message: string, title?: string) => {
    const t: ToastItem = {
      id: uid(),
      title,
      message,
      variant,
      createdAt: Date.now(),
      ttlMs: variant === "error" ? 5500 : 3200,
    };
    setToasts((s) => [t, ...s].slice(0, 5));
    window.setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== t.id));
    }, t.ttlMs);
  }, []);

  const api: ToastApi = useMemo(
    () => ({
      success: (m, t) => push("success", m, t),
      error: (m, t) => push("error", m, t),
      info: (m, t) => push("info", m, t),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport
        items={toasts}
        onDismiss={(id) => setToasts((s) => s.filter((x) => x.id !== id))}
      />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed top-4 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] space-y-2"
      role="region"
      aria-label="Notifications"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-xl border shadow-lg backdrop-blur bg-card/95 p-3",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            t.variant === "success" && "border-emerald-500/30",
            t.variant === "error" && "border-destructive/30",
            t.variant === "info" && "border-border"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {t.title && <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>}
              <p
                className={cn(
                  "text-sm mt-0.5 break-words",
                  t.variant === "error" ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {t.message}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

