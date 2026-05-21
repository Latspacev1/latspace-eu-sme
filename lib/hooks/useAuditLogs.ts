"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  auditLogsApi,
  AuditLog,
  AuditLogFilters,
  PaginatedAuditLogs,
  DocVersion,
  VersionComparison,
} from "@/lib/api/audit-logs";

/**
 * Hook to fetch paginated audit logs with optional filters
 */
export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const response = await auditLogsApi.getAll(filters);
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch audit logs");
      }
      return response.data as PaginatedAuditLogs;
    },
  });
}

/**
 * Hook to fetch a single audit log by ID
 */
export function useAuditLog(auditLogId: string | null) {
  return useQuery({
    queryKey: ["audit-log", auditLogId],
    queryFn: async () => {
      if (!auditLogId) return null;
      const response = await auditLogsApi.getById(auditLogId);
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch audit log");
      }
      return response.data;
    },
    enabled: !!auditLogId,
  });
}

/**
 * Hook to fetch audit logs for a specific document
 */
export function useDocumentAuditLogs(
  collectionName: string | null,
  documentId: string | null,
  limit: number = 50
) {
  return useQuery({
    queryKey: ["audit-logs", "document", collectionName, documentId, limit],
    queryFn: async () => {
      if (!collectionName || !documentId) return [];
      const response = await auditLogsApi.getForDocument(collectionName, documentId, limit);
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch document audit logs");
      }
      return response.data as AuditLog[];
    },
    enabled: !!collectionName && !!documentId,
  });
}

/**
 * Hook to fetch version history for a document
 */
export function useDocumentVersions(
  collectionName: string | null,
  documentId: string | null,
  limit: number = 50
) {
  return useQuery({
    queryKey: ["doc-versions", collectionName, documentId, limit],
    queryFn: async () => {
      if (!collectionName || !documentId) return [];
      const response = await auditLogsApi.getDocumentVersions(collectionName, documentId, limit);
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch document versions");
      }
      return response.data as DocVersion[];
    },
    enabled: !!collectionName && !!documentId,
  });
}

/**
 * Hook to fetch a specific version of a document
 */
export function useDocumentAtVersion(
  collectionName: string | null,
  documentId: string | null,
  version: number | null
) {
  return useQuery({
    queryKey: ["doc-version", collectionName, documentId, version],
    queryFn: async () => {
      if (!collectionName || !documentId || version === null) return null;
      const response = await auditLogsApi.getDocumentAtVersion(collectionName, documentId, version);
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch document version");
      }
      return response.data as Record<string, unknown>;
    },
    enabled: !!collectionName && !!documentId && version !== null,
  });
}

/**
 * Hook to compare two versions of a document
 */
export function useVersionComparison(
  collectionName: string | null,
  documentId: string | null,
  versionA: number | null,
  versionB: number | null
) {
  return useQuery({
    queryKey: ["version-comparison", collectionName, documentId, versionA, versionB],
    queryFn: async () => {
      if (!collectionName || !documentId || versionA === null || versionB === null) {
        return null;
      }
      const response = await auditLogsApi.compareVersions(
        collectionName,
        documentId,
        versionA,
        versionB
      );
      if (!response.success) {
        throw new Error(response.message || "Failed to compare versions");
      }
      return response.data as VersionComparison;
    },
    enabled: !!collectionName && !!documentId && versionA !== null && versionB !== null,
  });
}

/**
 * Hook to get recent audit log activity (for dashboards)
 */
export function useRecentAuditActivity(limit: number = 10) {
  return useQuery({
    queryKey: ["audit-logs", "recent", limit],
    queryFn: async () => {
      const response = await auditLogsApi.getAll({
        limit,
        page: 1,
        sort: "action_date",
        order: "desc",
      });
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch recent audit activity");
      }
      return response.data?.items || [];
    },
  });
}

/**
 * Hook to get audit log statistics
 */
export function useAuditLogStats() {
  return useQuery({
    queryKey: ["audit-logs", "stats"],
    queryFn: async () => {
      // Fetch total count and recent counts
      const [allResponse, todayResponse] = await Promise.all([
        auditLogsApi.getAll({ limit: 1, page: 1 }),
        auditLogsApi.getAll({
          limit: 1,
          page: 1,
          // Note: Backend would need date filtering for accurate "today" count
          // For now we return total as a proxy
        }),
      ]);

      return {
        total: allResponse.data?.total || 0,
        today: todayResponse.data?.total || 0,
        week: allResponse.data?.total || 0, // Would need date range filter
      };
    },
  });
}
