"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import { navproApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { canEditProject } from "@/lib/rbac";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/navpro";

export default function EditProjectPage() {
  const { id } = useParams();
  const user = useAuthStore((s: { user: User | null }) => s.user);
  const projectId = id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => navproApi.getProject(projectId),
  });

  const project = data?.project;

  if (isLoading) {
    return <p className="text-muted-foreground">Memuat proyek…</p>;
  }

  if (!project) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Proyek tidak ditemukan.</p>
        <Button variant="outline" asChild>
          <Link href="/projects">Kembali</Link>
        </Button>
      </div>
    );
  }

  if (!canEditProject(user?.role, project.status)) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">
          Proyek berstatus <strong>{project.status}</strong> tidak dapat diedit.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectId}`}>Lihat Detail</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-sm">Gagal memuat proyek.</p>;
  }

  return <ProjectWizard mode="edit" initialProject={project} />;
}
