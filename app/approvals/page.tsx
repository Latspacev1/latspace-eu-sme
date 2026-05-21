"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  Building2,
  User,
  Edit,
  Send,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { DataApproval, LogbookEntry } from "@/lib/types";
import { Fragment } from "react";
import { logbookApi } from "@/lib/api/logbook";
import { toast } from "sonner";

export default function ApprovalsLogbookPage() {
  const { currentRole } = useAppStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("logbook");

  // Approvals state
  const [approvalsSearchTerm, setApprovalsSearchTerm] = useState("");
  const [approvalsStatusFilter, setApprovalsStatusFilter] =
    useState<string>("PendingReview");
  const [approvalsTypeFilter, setApprovalsTypeFilter] = useState<string>("all");
  const [expandedApprovalId, setExpandedApprovalId] = useState<string | null>(
    null,
  );

  // Logbook state
  const [logbookSearchTerm, setLogbookSearchTerm] = useState("");
  const [logbookStatusFilter, setLogbookStatusFilter] = useState<string>("all");
  const [logbookCategoryFilter, setLogbookCategoryFilter] =
    useState<string>("all");
  const [expandedLogbookId, setExpandedLogbookId] = useState<string | null>(
    null,
  );

  // Corp Head action state
  const [requestChangeDialogOpen, setRequestChangeDialogOpen] = useState(false);
  const [selectedEntryForChange, setSelectedEntryForChange] =
    useState<LogbookEntry | null>(null);
  const [changeRequestComments, setChangeRequestComments] = useState("");

  // Request change mutation (Corp Head)
  const requestChangeMutation = useMutation({
    mutationFn: ({
      entryId,
      comments,
    }: {
      entryId: string;
      comments: string;
    }) => logbookApi.requestChange(entryId, comments),
    onSuccess: (response) => {
      if (response.success) {
        toast.success(
          `Change request sent to ${response.data?.plant_manager_notified || "Plant Manager"}`,
        );
        queryClient.invalidateQueries({ queryKey: ["logbook"] });
        setRequestChangeDialogOpen(false);
        setChangeRequestComments("");
        setSelectedEntryForChange(null);
      } else {
        toast.error(response.message || "Failed to send change request");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send change request: ${error.message}`);
    },
  });

  const handleRequestChange = (entry: LogbookEntry) => {
    setSelectedEntryForChange(entry);
    setRequestChangeDialogOpen(true);
  };

  const handleRequestChangeConfirm = () => {
    if (selectedEntryForChange && changeRequestComments.trim()) {
      requestChangeMutation.mutate({
        entryId: selectedEntryForChange.id,
        comments: changeRequestComments,
      });
    }
  };

  // Fetch logbook entries using apiClient (includes auth header)
  const { data: logbookEntriesRaw, isLoading: logbookLoading } = useQuery<
    LogbookEntry[]
  >({
    queryKey: ["logbook"],
    queryFn: async () => {
      const response = await logbookApi.getAll();
      if (!response.success) {
        throw new Error(response.message || "Failed to fetch logbook entries");
      }
      return response.data ?? [];
    },
  });

  // Ensure logbookEntries is always an array (defensive handling)
  const logbookEntries = Array.isArray(logbookEntriesRaw)
    ? logbookEntriesRaw
    : [];

  // Derive approvals from logbook entries
  // Corp Head now sees all logbook entries for viewing/monitoring
  // Single-step workflow: Plant Manager approves -> Approved (data saved to DB) -> Corp Head gets notification
  const approvals: DataApproval[] = logbookEntries.map((entry) => ({
    id: entry.id,
    type: "ManualEntry" as const,
    siteId: entry.plant_id || "",
    siteName: entry.plantName || "Unknown",
    title: `${entry.category} - ${entry.period}`,
    description: `Logbook entry for ${entry.plantName}`,
    submittedBy: entry.submittedBy || "Unknown",
    submittedAt: entry.submittedAt || new Date().toISOString(),
    status:
      entry.status === "Approved"
        ? "Approved"
        : entry.status === "Rejected"
          ? "Rejected"
          : entry.status === "ChangeRequested"
            ? "RequestChanges"
            : entry.status === "UnderReview"
              ? "PendingReview"
              : entry.status === "Submitted"
                ? "PendingReview"
                : "PendingReview",
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt,
    rejectionReason: entry.rejectionReason,
    referenceId: entry.id,
    referenceType: "LogbookEntry" as const,
    period: entry.period || "",
    metricsCount: entry.bulk_upload_data?.length || 0,
  }));

  // Use same loading state since approvals are derived from logbook
  const approvalsLoading = logbookLoading;

  // Filter approvals
  const filteredApprovals = approvals.filter((approval) => {
    const matchesSearch =
      approval.title
        ?.toLowerCase()
        .includes(approvalsSearchTerm.toLowerCase()) ||
      approval.siteName
        ?.toLowerCase()
        .includes(approvalsSearchTerm.toLowerCase()) ||
      approval.submittedBy
        ?.toLowerCase()
        .includes(approvalsSearchTerm.toLowerCase());
    const matchesStatus =
      approvalsStatusFilter === "all" ||
      approval.status === approvalsStatusFilter;
    const matchesType =
      approvalsTypeFilter === "all" || approval.type === approvalsTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Filter logbook entries - only show approved and change requested entries for Corp Head
  const filteredLogbookEntries = logbookEntries.filter((entry) => {
    // Only show approved or change requested entries
    if (entry.status !== "Approved" && entry.status !== "ChangeRequested")
      return false;

    const matchesSearch =
      entry.plantName
        ?.toLowerCase()
        .includes(logbookSearchTerm.toLowerCase()) ||
      entry.period?.toLowerCase().includes(logbookSearchTerm.toLowerCase());
    const matchesCategory =
      logbookCategoryFilter === "all" ||
      entry.category === logbookCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const pendingCount = approvals.filter(
    (a) => a.status === "PendingReview",
  ).length;

  // Approvals badge functions
  const getApprovalStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon?: any }> = {
      PendingReview: {
        className: "bg-yellow-100 text-yellow-700 border-yellow-300",
        icon: Clock,
      },
      Approved: {
        className: "bg-green-100 text-green-700 border-green-300",
        icon: CheckCircle2,
      },
      Rejected: {
        className: "bg-red-100 text-red-700 border-red-300",
        icon: XCircle,
      },
      RequestChanges: {
        className: "bg-orange-100 text-orange-700 border-orange-300",
      },
    };

    const config = variants[status] || {};
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.className}>
        {Icon && <Icon className="mr-1 h-3 w-3" />}
        {status === "PendingReview"
          ? "Pending Review"
          : status === "RequestChanges"
            ? "Changes Requested"
            : status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      ManualEntry: "bg-blue-50 text-blue-700 border-blue-200",
      UploadedData: "bg-purple-50 text-purple-700 border-purple-200",
      ComplianceReport: "bg-green-50 text-green-700 border-green-200",
      EmissionCalculation: "bg-orange-50 text-orange-700 border-orange-200",
    };
    const labels: Record<string, string> = {
      ManualEntry: "Manual Entry",
      UploadedData: "Uploaded Data",
      ComplianceReport: "Compliance Report",
      EmissionCalculation: "Emission Calculation",
    };
    return (
      <Badge variant="outline" className={colors[type] || ""}>
        {labels[type] || type}
      </Badge>
    );
  };

  // Logbook badge functions
  const getLogbookStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      Draft: "bg-gray-100 text-gray-700 border-gray-300",
      Submitted: "bg-blue-100 text-blue-700 border-blue-300",
      UnderReview: "bg-yellow-100 text-yellow-700 border-yellow-300",
      Approved: "bg-green-100 text-green-700 border-green-300",
      Rejected: "bg-red-100 text-red-700 border-red-300",
      ChangeRequested: "bg-orange-100 text-orange-700 border-orange-300",
    };
    const labels: Record<string, string> = {
      Draft: "Draft",
      Submitted: "Submitted",
      UnderReview: "Under Review",
      Approved: "Approved",
      Rejected: "Rejected",
      ChangeRequested: "Changes Requested",
    };
    // Add min-width to match "Changes Requested" size for "Approved" status
    const minWidthClass =
      status === "Approved" || status === "ChangeRequested"
        ? "min-w-[140px] inline-block text-center"
        : "";
    return (
      <Badge
        variant="outline"
        className={`${variants[status] || ""} ${minWidthClass}`}
      >
        {labels[status] || status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      Production: "bg-blue-50 text-blue-700 border-blue-200",
      Energy: "bg-amber-50 text-amber-700 border-amber-200",
      Fuel: "bg-orange-50 text-orange-700 border-orange-200",
      RawMaterial: "bg-green-50 text-green-700 border-green-200",
      Emissions: "bg-purple-50 text-purple-700 border-purple-200",
      Other: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return (
      <Badge variant="outline" className={colors[category] || ""}>
        {category === "RawMaterial" ? "Raw Material" : category}
      </Badge>
    );
  };

  const getAnomalyBadge = (entry: LogbookEntry) => {
    if (!entry.has_anomaly || !entry.anomaly_count) return null;

    const severity = entry.anomaly_info?.anomalous_fields?.some(
      (f) => f.severity === "critical",
    )
      ? "critical"
      : "warning";

    const bgColor =
      severity === "critical"
        ? "bg-red-100 text-red-700 border-red-300"
        : "bg-orange-100 text-orange-700 border-orange-300";

    return (
      <Badge variant="outline" className={bgColor}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        {entry.anomaly_count} Anomal{entry.anomaly_count > 1 ? "ies" : "y"}
      </Badge>
    );
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Logbook
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View approved and change requested data entries from plants
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        {/* Data Approvals tab commented out - only showing approved entries in Logbook */}
        {/* <TabsList>
          <TabsTrigger value="approvals">Data Approvals</TabsTrigger>
          <TabsTrigger value="logbook">Data Logbook</TabsTrigger>
        </TabsList> */}

        {/* Approvals Tab - Commented out as we only show approved entries in Logbook
        <TabsContent value="approvals" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search approvals..."
                value={approvalsSearchTerm}
                onChange={(e) => setApprovalsSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              <Select value={approvalsStatusFilter} onValueChange={setApprovalsStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PendingReview">Pending</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="RequestChanges">Changes Requested</SelectItem>
                </SelectContent>
              </Select>
              <Select value={approvalsTypeFilter} onValueChange={setApprovalsTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ManualEntry">Manual Entry</SelectItem>
                  <SelectItem value="UploadedData">Uploaded Data</SelectItem>
                  <SelectItem value="ComplianceReport">Compliance</SelectItem>
                  <SelectItem value="EmissionCalculation">Emissions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredApprovals && filteredApprovals.length > 0 ? (
                  filteredApprovals.map((approval) => (
                    <Fragment key={approval.id}>
                      <TableRow
                        className={`cursor-pointer hover:bg-muted/50 ${
                          approval.status === "PendingReview" ? "bg-yellow-50/30" : ""
                        }`}
                        onClick={() => setExpandedApprovalId(
                          expandedApprovalId === approval.id ? null : approval.id
                        )}
                      >
                        <TableCell>
                          {expandedApprovalId === approval.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{approval.title}</TableCell>
                        <TableCell>{approval.siteName}</TableCell>
                        <TableCell>{approval.period}</TableCell>
                        <TableCell>{getApprovalStatusBadge(approval.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={`/approvals/${approval.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedApprovalId === approval.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                                  <p className="text-sm mt-1">{approval.description}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Type</p>
                                  <div className="mt-1">{getTypeBadge(approval.type)}</div>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Metrics Count</p>
                                  <p className="text-sm mt-1">{approval.metricsCount || "-"}</p>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Submitted By</p>
                                  <p className="text-sm mt-1">{approval.submittedBy}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Submitted Date</p>
                                  <p className="text-sm mt-1">
                                    {new Date(approval.submittedAt).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No approvals found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        */}

        {/* Logbook Tab - Shows only approved entries */}
        <TabsContent value="logbook" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search approved entries..."
                value={logbookSearchTerm}
                onChange={(e) => setLogbookSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              {/* Status filter removed - only showing approved entries */}
              <Select
                value={logbookCategoryFilter}
                onValueChange={setLogbookCategoryFilter}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Energy">Energy</SelectItem>
                  <SelectItem value="Fuel">Fuel</SelectItem>
                  <SelectItem value="RawMaterial">Raw Material</SelectItem>
                  <SelectItem value="Emissions">Emissions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Anomalies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logbookLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredLogbookEntries &&
                  filteredLogbookEntries.length > 0 ? (
                  filteredLogbookEntries.map((entry) => (
                    <Fragment key={entry.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedLogbookId(
                            expandedLogbookId === entry.id ? null : entry.id,
                          )
                        }
                      >
                        <TableCell>
                          {expandedLogbookId === entry.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.period}
                        </TableCell>
                        <TableCell>{entry.plantName}</TableCell>
                        <TableCell>
                          {getCategoryBadge(entry.category)}
                        </TableCell>
                        <TableCell>
                          {getLogbookStatusBadge(entry.status)}
                        </TableCell>
                        <TableCell>{getAnomalyBadge(entry)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Commented out View button as per user request */}
                            {/*
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link href={`/logbook/${entry.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Link>
                            </Button>
                            */}
                            {/* Corp Head actions for approved entries */}
                            {currentRole === "CorporateHead" &&
                              entry.status === "Approved" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRequestChange(entry);
                                    }}
                                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Request Change
                                  </Button>
                                </>
                              )}
                            {/* Show change request info for ChangeRequested status */}
                            {entry.status === "ChangeRequested" &&
                              entry.changeRequestComments && (
                                <div
                                  className="inline-flex items-center justify-center rounded-md border border-orange-300 bg-orange-50 text-orange-700 px-3 py-1.5 text-sm font-medium h-8 cursor-default"
                                  title={entry.changeRequestComments}
                                >
                                  <span className="truncate max-w-[159px]">
                                    {entry.changeRequestComments}
                                  </span>
                                </div>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedLogbookId === entry.id && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Submitted By
                                  </p>
                                  <p className="text-sm mt-1">
                                    {entry.submittedBy}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Submitted Date
                                  </p>
                                  <p className="text-sm mt-1">
                                    {new Date(
                                      entry.submittedAt,
                                    ).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {entry.reviewedBy && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Reviewed By
                                    </p>
                                    <p className="text-sm mt-1">
                                      {entry.reviewedBy}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Anomaly Detection Results */}
                            {entry.anomaly_info &&
                              entry.anomaly_info.has_anomaly && (
                                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                  <div className="flex items-center gap-2 mb-3 text-orange-800">
                                    <AlertTriangle className="h-5 w-5" />
                                    <h4 className="font-semibold">
                                      Anomaly Details
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="bg-orange-100 text-orange-700 border-orange-300 ml-auto"
                                    >
                                      {entry.anomaly_count} Anomalies detected
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {entry.anomaly_info.anomalous_fields.map(
                                      (field, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-white p-3 rounded border border-orange-100 shadow-sm"
                                        >
                                          <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-semibold text-gray-700 flex-1 min-w-0 break-words whitespace-normal pr-2">
                                              {field.field_name
                                                .replace(/_/g, " ")
                                                .replace(/\b\w/g, (l: string) =>
                                                  l.toUpperCase(),
                                                )}
                                            </p>
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "flex-shrink-0",
                                                field.severity === "critical"
                                                  ? "bg-red-50 text-red-600 border-red-200 text-[10px]"
                                                  : "bg-orange-50 text-orange-600 border-orange-200 text-[10px]",
                                              )}
                                            >
                                              {field.severity.toUpperCase()}
                                            </Badge>
                                          </div>
                                          <div className="flex items-baseline gap-2">
                                            <p className="text-lg font-bold text-gray-900">
                                              {field.current_value?.toLocaleString() ?? "-"}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                              avg:{" "}
                                              {field.moving_average?.toFixed(1) ?? "N/A"}
                                            </p>
                                            <p className="text-xs font-medium text-red-600 ml-auto">
                                              +
                                              {field.deviation_percentage.toFixed(
                                                1,
                                              )}
                                              %
                                            </p>
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Change Request Comment Section */}
                            {entry.status === "ChangeRequested" &&
                              entry.changeRequestComments && (
                                <div className="mt-4 pt-4 border-t border-muted">
                                  <p className="text-sm font-medium text-muted-foreground mb-2">
                                    Change Request Comment
                                  </p>
                                  <div className="rounded-md border border-orange-300 bg-orange-50 p-3">
                                    <p className="text-sm text-orange-700">
                                      {entry.changeRequestComments}
                                    </p>
                                  </div>
                                  {entry.changeRequestedByName && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Requested by:{" "}
                                      {entry.changeRequestedByName}
                                      {entry.changeRequestedAt &&
                                        ` on ${new Date(
                                          entry.changeRequestedAt,
                                        ).toLocaleDateString("en-US", {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                        })}`}
                                    </p>
                                  )}
                                </div>
                              )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No entries found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Change Dialog (Corp Head) */}
      <Dialog
        open={requestChangeDialogOpen}
        onOpenChange={setRequestChangeDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Send a change request to the Plant Manager for this entry. They
              will be notified and can make the requested changes.
            </DialogDescription>
          </DialogHeader>
          {selectedEntryForChange && (
            <div className="py-4 space-y-4">
              <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Site:</span>
                  <span className="font-medium">
                    {selectedEntryForChange.plantName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Period:</span>
                  <span className="font-medium">
                    {selectedEntryForChange.period}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-700 border-green-300"
                  >
                    {selectedEntryForChange.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="change-comments"
                  className="text-sm font-medium"
                >
                  Change Request Comments *
                </label>
                <Textarea
                  id="change-comments"
                  placeholder="Explain what changes are needed and why..."
                  value={changeRequestComments}
                  onChange={(e) => setChangeRequestComments(e.target.value)}
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Be specific about what needs to be corrected or updated
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRequestChangeDialogOpen(false);
                setChangeRequestComments("");
                setSelectedEntryForChange(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestChangeConfirm}
              disabled={
                !changeRequestComments.trim() || requestChangeMutation.isPending
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {requestChangeMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
