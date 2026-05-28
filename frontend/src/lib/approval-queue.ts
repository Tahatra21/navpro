import type { ApprovalQueueItem, ApprovalsQueueV2Item } from "@/types/navpro";

export function mapV2QueueToItems(rows: ApprovalsQueueV2Item[]): ApprovalQueueItem[] {
  const now = Date.now();
  return rows.map((r) => {
    const due = r.due_at ? new Date(r.due_at).getTime() : null;
    return {
      step_id: r.step_id,
      project_id: r.project_id,
      project_code: r.project_code,
      project_name: r.project_name,
      status: r.project_status,
      step_order: r.step_order,
      approver_level: r.approver_level,
      step_status: r.step_status,
      segment: r.segment,
      sla_due_at: r.due_at ?? null,
      sla_overdue: due != null ? due < now : false,
    };
  });
}
