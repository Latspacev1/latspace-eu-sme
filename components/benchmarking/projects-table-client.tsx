"use client";

import { useQuery } from "@tanstack/react-query";
import { benchmarkingApi } from "@/lib/api/benchmarking";
import { ProjectsTable } from "@/components/benchmarking/projects-table";

export function ProjectsTableClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["benchmarking-projects"],
    queryFn: async () => {
      const res = await benchmarkingApi.listProjects();
      return res.success && res.data ? res.data : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  return <ProjectsTable projects={data ?? []} isLoading={isLoading} />;
}
