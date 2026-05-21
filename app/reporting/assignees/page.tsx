"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/useAppStore";
import { reportingApi, type ReportingInstanceDetail } from "@/lib/api/reporting";
import { adminApi } from "@/lib/api/admin";
import { AssigneesTable } from "./components/assignees-table";

export default function AssigneesPage() {
  const { user } = useAppStore();
  const plantId = user?.plantId ?? undefined;
  const orgId = user?.orgId;

  // 1. Fetch all instances for this plant
  const { data: instancesResp, isLoading: loadingInstances } = useQuery({
    queryKey: ["reporting-instances", plantId],
    queryFn: () => reportingApi.listInstances(plantId),
    enabled: !!plantId,
  });

  const instanceSummaries = instancesResp?.data ?? [];

  // 2. Fetch full detail for each instance (parallel queries)
  const instanceDetailQueries = instanceSummaries.map((summary) => ({
    queryKey: ["reporting-instance", summary.id],
    queryFn: () => reportingApi.getInstance(summary.id),
  }));

  // useQueries isn't imported — use individual queries via useMemo + manual fetch
  // We instead fetch details for all summaries as a single derived query
  const { data: instanceDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["reporting-instance-details", instanceSummaries.map((s) => s.id)],
    queryFn: async () => {
      const results = await Promise.all(
        instanceSummaries.map((s) => reportingApi.getInstance(s.id)),
      );
      return results
        .filter((r) => r.success && r.data)
        .map((r) => r.data as ReportingInstanceDetail);
    },
    enabled: instanceSummaries.length > 0,
  });

  // 3. Fetch org users
  const { data: usersResp, isLoading: loadingUsers } = useQuery({
    queryKey: ["org-users", orgId],
    queryFn: () => adminApi.listUsers(orgId),
    enabled: !!orgId,
  });

  const users = usersResp?.data ?? [];
  const instances = instanceDetails ?? [];
  const isLoading = loadingInstances || loadingDetails || loadingUsers;

  return (
    <div className="px-8 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assignees</h1>
          <p className="text-sm text-slate-500">
            Assign owners and send reminders for each disclosure question.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="mt-10 text-center text-sm text-slate-500">Loading…</div>
      )}

      {!isLoading && !plantId && (
        <div className="mt-10 text-center text-sm text-slate-500">
          No plant selected. Please select a plant to view assignees.
        </div>
      )}

      {!isLoading && plantId && (
        <AssigneesTable instances={instances} users={users} />
      )}
    </div>
  );
}
