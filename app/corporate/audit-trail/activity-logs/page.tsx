"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  History,
  Search,
  ArrowLeft,
  User,
  Calendar,
  FileText,
  Edit,
  Trash,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuditLogs } from "@/lib/hooks/useAuditLogs";
import { AuditLog } from "@/lib/api/audit-logs";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

const ACTION_TYPE_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
];

const COLLECTION_OPTIONS = [
  { value: "all", label: "All Collections" },
  { value: "plants", label: "Plants" },
  { value: "formulas", label: "Formulas" },
  { value: "unified_data_points", label: "Data Points" },
  { value: "logbook_entries", label: "Logbook Entries" },
  { value: "users", label: "Users" },
  { value: "dynamic_parameters", label: "Parameters" },
  { value: "assets", label: "Assets" },
];

function getActionConfig(actionType: string) {
  switch (actionType?.toLowerCase()) {
    case "create":
      return {
        icon: Plus,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "update":
      return {
        icon: Edit,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "delete":
      return {
        icon: Trash,
        color: "text-red-600",
        bgColor: "bg-red-50",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        icon: FileText,
        color: "text-gray-600",
        bgColor: "bg-gray-50",
        badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
      };
  }
}

function formatCollectionName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CorporateActivityLogsPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filters = {
    limit,
    page,
    sort: "action_date",
    order: "desc" as const,
    ...(actionTypeFilter !== "all" && { action_type: actionTypeFilter }),
    ...(collectionFilter !== "all" && { collection_name: collectionFilter }),
    ...(searchQuery && { document_id: searchQuery }),
  };

  const { data, isLoading, isError, refetch } = useAuditLogs(filters);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Page Header */}
      <div className="bg-white border-b border-[#050505]/6">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/corporate/audit-trail")}
              className="p-2 -ml-2 rounded-lg hover:bg-[#050505]/5 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-[#0A0A0A]/60" />
            </button>
            <div className="flex-1">
              <h1 className="text-[24px] font-semibold text-[#0A0A0A] tracking-[-0.02em]">
                Activity Logs
              </h1>
              <p className="text-[13px] text-[#0A0A0A]/60 mt-0.5">
                View all system changes and user activities across all plants
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-9 px-4 border-[#050505]/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-[#050505]/6">
        <div className="px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0A0A0A]/40" />
              <Input
                placeholder="Search by document ID..."
                className="pl-10 h-9 border-[#050505]/10 bg-[#FAFAFA] focus:bg-white"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={actionTypeFilter}
              onValueChange={(value) => {
                setActionTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px] h-9 border-[#050505]/10">
                <Filter className="h-3.5 w-3.5 mr-2 text-[#0A0A0A]/40" />
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={collectionFilter}
              onValueChange={(value) => {
                setCollectionFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px] h-9 border-[#050505]/10">
                <FileText className="h-3.5 w-3.5 mr-2 text-[#0A0A0A]/40" />
                <SelectValue placeholder="Collection" />
              </SelectTrigger>
              <SelectContent>
                {COLLECTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data && (
              <div className="ml-auto text-[12px] text-[#0A0A0A]/50">
                <span className="font-medium text-[#0A0A0A]">{data.total}</span> total records
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#050505]/6 p-4 animate-pulse"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#050505]/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#050505]/5 rounded w-1/3" />
                    <div className="h-3 bg-[#050505]/5 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="bg-white rounded-xl border border-[#050505]/6 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <History className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-[15px] font-medium text-[#0A0A0A]">Failed to load activity logs</p>
            <p className="text-[13px] text-[#0A0A0A]/60 mt-1">Please try again</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#050505]/6 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#050505]/5 flex items-center justify-center mx-auto mb-4">
              <History className="h-6 w-6 text-[#0A0A0A]/40" />
            </div>
            <p className="text-[15px] font-medium text-[#0A0A0A]">No activity logs found</p>
            <p className="text-[13px] text-[#0A0A0A]/60 mt-1">
              Activity will appear here when changes are made
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data?.items.map((log) => {
              const config = getActionConfig(log.action_type);
              const ActionIcon = config.icon;

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-xl border border-[#050505]/6 p-4 hover:border-[#074D47]/20 hover:shadow-sm cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        config.bgColor
                      )}
                    >
                      <ActionIcon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-medium uppercase", config.badgeClass)}
                        >
                          {log.action_type}
                        </Badge>
                        <span className="text-[14px] font-medium text-[#0A0A0A]">
                          {formatCollectionName(log.collection_name)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#0A0A0A]/50 mt-1 font-mono truncate">
                        {log.document_id}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-[#0A0A0A]/50">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{log.user_id}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-[#0A0A0A]/50">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(log.action_date), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#050505]/6">
            <p className="text-[12px] text-[#0A0A0A]/50">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of{" "}
              {data.total} results
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 border-[#050505]/10"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="px-3 text-[12px] text-[#0A0A0A]/60">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 border-[#050505]/10"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-[18px]">
              {selectedLog && (
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    getActionConfig(selectedLog.action_type).bgColor
                  )}
                >
                  {(() => {
                    const Icon = getActionConfig(selectedLog.action_type).icon;
                    return (
                      <Icon
                        className={cn("h-4 w-4", getActionConfig(selectedLog.action_type).color)}
                      />
                    );
                  })()}
                </div>
              )}
              Activity Details
            </DialogTitle>
            <DialogDescription>Complete information about this activity</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6 mt-2">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    Action Type
                  </label>
                  <div className="mt-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-medium uppercase",
                        getActionConfig(selectedLog.action_type).badgeClass
                      )}
                    >
                      {selectedLog.action_type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    Collection
                  </label>
                  <p className="mt-1.5 text-[14px] font-medium text-[#0A0A0A]">
                    {formatCollectionName(selectedLog.collection_name)}
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    Document ID
                  </label>
                  <p className="mt-1.5 text-[13px] font-mono text-[#0A0A0A]/80 break-all">
                    {selectedLog.document_id}
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    User ID
                  </label>
                  <p className="mt-1.5 text-[13px] font-mono text-[#0A0A0A]/80 break-all">
                    {selectedLog.user_id}
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    Date & Time
                  </label>
                  <p className="mt-1.5 text-[14px] text-[#0A0A0A]">
                    {format(new Date(selectedLog.action_date), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    Log ID
                  </label>
                  <p className="mt-1.5 text-[13px] font-mono text-[#0A0A0A]/80 break-all">
                    {selectedLog.id}
                  </p>
                </div>
              </div>
              {selectedLog.action_details && Object.keys(selectedLog.action_details).length > 0 && (
                <div>
                  <label className="text-[11px] font-medium text-[#0A0A0A]/50 uppercase tracking-wide">
                    Action Details
                  </label>
                  <pre className="mt-2 p-4 bg-[#FAFAFA] rounded-lg text-[12px] font-mono text-[#0A0A0A]/80 overflow-auto max-h-48 border border-[#050505]/6">
                    {JSON.stringify(selectedLog.action_details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
