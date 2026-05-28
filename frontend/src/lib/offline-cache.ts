import type { Project } from "@/types/navpro";

const KEY_LIST = "navpro_offline_projects_v1";
const KEY_BY_ID = "navpro_offline_project_by_id_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStringify(val: unknown) {
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

export function offlineGetProjects(): Project[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<{ saved_at: string; projects: Project[] }>(localStorage.getItem(KEY_LIST));
  return parsed?.projects || [];
}

export function offlineSaveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  const raw = safeStringify({ saved_at: new Date().toISOString(), projects });
  if (!raw) return;
  localStorage.setItem(KEY_LIST, raw);
}

export function offlineGetProject(id: string): Project | null {
  if (typeof window === "undefined") return null;
  const map = safeParse<Record<string, { saved_at: string; project: Project }>>(
    localStorage.getItem(KEY_BY_ID)
  );
  return map?.[id]?.project || null;
}

export function offlineSaveProject(project: Project) {
  if (typeof window === "undefined") return;
  const existing =
    safeParse<Record<string, { saved_at: string; project: Project }>>(localStorage.getItem(KEY_BY_ID)) || {};
  existing[project.id] = { saved_at: new Date().toISOString(), project };
  const raw = safeStringify(existing);
  if (!raw) return;
  localStorage.setItem(KEY_BY_ID, raw);
}

