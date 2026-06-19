"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavEntry } from "@/lib/nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PrimaryNavProps = {
  entries: NavEntry[];
  pathname: string;
  variant?: "header" | "bottom";
  className?: string;
};

export function PrimaryNav({ entries, pathname, variant = "header", className }: PrimaryNavProps) {
  if (entries.length === 0) return null;

  const isBottom = variant === "bottom";

  return (
    <nav
      className={cn(
        "flex items-center",
        isBottom
          ? "gap-0.5 rounded-full border border-border bg-card/95 px-1 py-1 shadow-md max-w-[min(calc(100vw-1.25rem),28rem)] overflow-x-auto"
          : "gap-1",
        className
      )}
      aria-label="Navigasi utama"
    >
      {entries.map((entry) => {
        if (entry.type === "link") {
          const active = entry.match(pathname);
          const Icon = entry.icon;
          const text = isBottom && entry.shortLabel ? entry.shortLabel : entry.label;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              title={entry.label}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-full transition-colors whitespace-nowrap",
                isBottom
                  ? "flex-col px-2.5 py-1.5 min-w-[3.25rem] text-[0.625rem] font-medium"
                  : "px-3 py-2 text-xs font-medium",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className={cn(isBottom ? "w-5 h-5" : "w-4 h-4")} strokeWidth={active ? 2.25 : 1.85} />
              <span>{text}</span>
            </Link>
          );
        }

        const active = entry.match(pathname);
        const Icon = entry.icon;
        const text = isBottom && entry.shortLabel ? entry.shortLabel : entry.label;

        if (isBottom && entry.children.length === 1) {
          const only = entry.children[0];
          const OnlyIcon = only.icon;
          return (
            <Link
              key={entry.id}
              href={only.href}
              aria-current={active ? "page" : undefined}
              title={only.label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 min-w-[3.25rem] text-[0.625rem] font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <OnlyIcon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.85} />
              <span>{text}</span>
            </Link>
          );
        }

        return (
          <DropdownMenu key={entry.id}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={entry.label}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isBottom
                    ? "flex-col px-2.5 py-1.5 min-w-[3.25rem] text-[0.625rem] font-medium"
                    : "px-3 py-2 text-xs font-medium",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className={cn(isBottom ? "w-5 h-5" : "w-4 h-4")} strokeWidth={active ? 2.25 : 1.85} />
                <span className="flex items-center gap-0.5">
                  {text}
                  {!isBottom ? <ChevronDown className="w-3 h-3 opacity-60" /> : null}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isBottom ? "center" : "start"} side={isBottom ? "top" : "bottom"}>
              {entry.children.map((child) => {
                const ChildIcon = child.icon;
                const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                return (
                  <DropdownMenuItem key={child.href} asChild>
                    <Link
                      href={child.href}
                      className={cn("flex items-center gap-2 cursor-pointer", childActive && "font-semibold")}
                    >
                      <ChildIcon className="w-4 h-4 text-muted-foreground" />
                      {child.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
