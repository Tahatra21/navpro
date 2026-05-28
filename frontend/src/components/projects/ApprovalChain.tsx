"use client";

import type { Project } from "@/types/navpro";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./approval-chain.module.css";

function isV2Flow(status: string) {
  return ["IN_REVIEW_ASMAN", "IN_REVIEW_MANAGER", "APPROVED"].includes(status);
}

function statusBadgeClass(statusLabel: string, active: boolean, rejected: boolean) {
  if (rejected) return styles.cardRejected;
  if (
    statusLabel.includes("APPROVED") ||
    statusLabel === "SUBMITTED" ||
    statusLabel === "COMPLETED"
  )
    return styles.cardDone;
  if (active) return styles.cardActive;
  return styles.cardMuted;
}

function dotClass(statusLabel: string, active: boolean, rejected: boolean) {
  if (rejected) return styles.dotRejected;
  if (
    statusLabel.includes("APPROVED") ||
    statusLabel === "SUBMITTED" ||
    statusLabel === "COMPLETED"
  )
    return styles.dotDone;
  if (active) return styles.dotActive;
  return "";
}

function buildNodes(project: Project) {
  const chain = project.approval_chain || [];
  const submit = chain.find((c) => c.level === "SUBMIT");
  const asman = chain.find((c) => c.level === "ASMAN");
  const manager = chain.find((c) => c.level === "MANAGER");
  const gm = chain.find((c) => c.level === "GM_SRM");
  const v2 = isV2Flow(project.status);

  if (v2) {
    return [
      {
        title: "Staff / Solution Architect",
        subtitle: "Input KKF & submit",
        node: submit,
        statusLabel: submit ? "SUBMITTED" : project.status === "DRAFT" ? "DRAFT" : "—",
        active: false,
        rejected: false,
      },
      {
        title: "Asman (Review Teknis)",
        subtitle: "SLA: 2 hari kerja",
        node: asman,
        statusLabel:
          asman?.status ||
          (project.status === "IN_REVIEW_ASMAN" ? "PENDING" : asman ? "APPROVED" : "WAITING"),
        active: project.status === "IN_REVIEW_ASMAN",
        rejected: asman?.status === "REJECTED" || asman?.status === "REJECTED_TO_DRAFT",
      },
      {
        title: "Manager Segment",
        subtitle: "SLA: 1 hari kerja",
        node: manager,
        statusLabel:
          manager?.status ||
          (project.status === "IN_REVIEW_MANAGER"
            ? "PENDING"
            : project.status === "APPROVED"
              ? "APPROVED"
              : "WAITING"),
        active: project.status === "IN_REVIEW_MANAGER",
        rejected: manager?.status === "REJECTED" || manager?.status === "REJECTED_TO_DRAFT",
      },
    ];
  }

  return [
    {
      title: "Solution Architect",
      subtitle: "Draft & hitung KKF",
      node: submit,
      statusLabel: submit ? "SUBMITTED" : project.status === "DRAFT" ? "DRAFT" : "—",
      active: false,
      rejected: false,
    },
    {
      title: "Manager Keuangan",
      subtitle: "Review L1 · SLA 2 hari",
      node: manager,
      statusLabel:
        manager?.status ||
        (["SUBMITTED", "UNDER_REVIEW"].includes(project.status) ? "PENDING" : "WAITING"),
      active: ["SUBMITTED", "UNDER_REVIEW"].includes(project.status),
      rejected: manager?.status === "REJECTED" || (project.status === "REJECTED" && !gm),
    },
    {
      title: "GM / SRM",
      subtitle: "Persetujuan final · SLA 1 hari",
      node: gm,
      statusLabel:
        gm?.status ||
        (project.status === "APPROVED_L1"
          ? "PENDING"
          : project.status === "APPROVED_FINAL"
            ? "APPROVED"
            : "WAITING"),
      active: project.status === "APPROVED_L1",
      rejected: gm?.status === "REJECTED",
    },
  ];
}

export function ApprovalChain({ project }: { project: Project }) {
  const nodes = buildNodes(project);

  return (
    <div className={styles.timeline}>
      {nodes.map((n, i) => (
        <div key={i} className={styles.step}>
          <div
            className={cn(styles.dot, dotClass(n.statusLabel, n.active, n.rejected))}
            aria-hidden
          />
          <div className={cn(styles.card, statusBadgeClass(n.statusLabel, n.active, n.rejected))}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{n.title}</span>
              <span className={styles.badge}>{n.statusLabel}</span>
            </div>
            <p className={styles.subtitle}>{n.subtitle}</p>
            {n.node?.user && <p className={styles.meta}>Oleh: {n.node.user}</p>}
            {n.node?.decided_at && (
              <p className={styles.meta}>{formatDateTime(n.node.decided_at)}</p>
            )}
            {n.node?.comment && <p className={styles.comment}>&ldquo;{n.node.comment}&rdquo;</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
