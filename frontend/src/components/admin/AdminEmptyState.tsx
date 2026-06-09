"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function AdminEmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
