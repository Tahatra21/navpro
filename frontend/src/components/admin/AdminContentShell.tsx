"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

type Props = {
  title: string;
  description: string;
  hints?: string[];
  children: ReactNode;
};

/** Right-hand admin panel: fixed header + scrollable body + optional petunjuk */
export function AdminContentShell({ title, description, hints, children }: Props) {
  return (
    <div className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="shrink-0 border-b border-border/60 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        {hints && hints.length > 0 ? (
          <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
            <div className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <ul className="space-y-1 text-xs text-muted-foreground">
                {hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </div>
  );
}
