"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./magic-nav.module.css";

export type MagicNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  shortLabel?: string;
};

type MagicNavProps = {
  items: MagicNavItem[];
  pathname: string;
  variant?: "header" | "bottom";
  className?: string;
};

export function MagicNav({ items, pathname, variant = "header", className }: MagicNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const found = items.findIndex((item) => item.match(pathname));
  const resolvedIndex = found >= 0 ? found : 0;

  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    const active = itemRefs.current[resolvedIndex];
    if (!nav || !active) return;
    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
    });
  }, [resolvedIndex]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, items, pathname, variant]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => updateIndicator());
    ro.observe(nav);
    itemRefs.current.forEach((el) => {
      if (el) ro.observe(el);
    });
    window.addEventListener("resize", updateIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator, items.length]);

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        styles.wrapper,
        variant === "header" ? styles.headerVariant : styles.bottomVariant,
        className
      )}
    >
      <nav ref={navRef} className={styles.navigation} aria-label="Navigasi utama">
        <div
          className={styles.indicator}
          aria-hidden
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.width > 0 ? 1 : 0,
          }}
        />
        <ul className={styles.list}>
          {items.map((item, index) => {
            const active = index === resolvedIndex;
            const Icon = item.icon;
            const text =
              variant === "bottom" && item.shortLabel ? item.shortLabel : item.label;
            return (
              <li
                key={item.href}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className={cn(styles.item, active && styles.itemActive)}
              >
                <Link
                  href={item.href}
                  className={styles.link}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                >
                  <span className={styles.iconWrap}>
                    <Icon className="w-4 h-4" strokeWidth={active ? 2.25 : 1.85} />
                  </span>
                  <span className={styles.label}>{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
