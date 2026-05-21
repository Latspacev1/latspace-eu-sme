"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Check,
  X,
  FileText,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  detectAnomaly,
  getAnomalySeverityColor,
} from "@/lib/utils/anomaly-detection";
import Link from "next/link";
import { toast } from "sonner";
import { flattenBulkUploadData } from "@/lib/utils/matrix-data";
import type { LogbookEntry } from "@/lib/types";
import { logbookApi } from "@/lib/api/logbook";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = use(params);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRequestChangesDialog, setShowRequestChangesDialog] =
    useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [changeRequestComments, setChangeRequestComments] = useState("");

  // Fetch the logbook entry directly (approval ID = logbook entry ID)
  const {
    data: entry,
    isLoading,
    error,
  } = useQuery<LogbookEntry>({
    queryKey: ["logbook", id],
    queryFn: async () => {
      const response = await logbookApi.getById(id);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.message || "Failed to fetch entry");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await logbookApi.approve(
        id,
        approvalComments || undefined,
      );
      if (!response.success) {
        throw new Error(response.message || "Failed to approve entry");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logbook"] });
      toast.success("Data approved and saved to database");
      setShowApproveDialog(false);
      router.push("/approvals");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await logbookApi.reject(
        id,
        rejectionReason || "No reason provided",
      );
      if (!response.success) {
        throw new Error(response.message || "Failed to reject entry");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logbook"] });
      toast.success("Data rejected and submitter notified");
      setShowRejectDialog(false);
      router.push("/approvals");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: async () => {
      const response = await logbookApi.requestChange(
        id,
        changeRequestComments,
      );
      if (!response.success) {
        throw new Error(response.message || "Failed to request changes");
      }
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["logbook"] });
      toast.success(
        `Change request sent to ${response.data?.plant_manager_notified || "Plant Manager"}`,
      );
      setShowRequestChangesDialog(false);
      setChangeRequestComments("");
      router.push("/approvals");
    },
    onError: (error: Error) => {
      toast.error(`Failed to request changes: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div>Loading...</div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex-1 p-8">
        <div className="text-center space-y-4">
          <p className="text-red-600">Failed to load entry details</p>
          <Button variant="outline" onClick={() => router.push("/approvals")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Approvals
          </Button>
        </div>
      </div>
    );
  }

  // Derive approval-like data from entry
  // New flow: Plant Manager approval directly saves to DB, Corp Head receives notification only
  const approval = {
    id: entry.id,
    type: "ManualEntry" as const,
    siteId: entry.plant_id || "",
    siteName: entry.plantName || "Unknown",
    title: `${entry.category} - ${entry.period}`,
    description: `Logbook entry for ${entry.plantName}`,
    submittedBy: entry.submittedBy || "Unknown",
    submittedAt: entry.submittedAt || "",
    status:
      entry.status === "Approved"
        ? "Approved"
        : entry.status === "Rejected"
          ? "Rejected"
          : entry.status === "ChangeRequested"
            ? "RequestChanges"
            : entry.status === "UnderReview"
              ? "UnderReview"
              : "UnderReview",
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt,
    rejectionReason: entry.rejectionReason,
    referenceId: entry.id,
    referenceType: "LogbookEntry" as const,
    period: entry.period || "",
    metricsCount: entry.bulk_upload_data?.length || 0,
    comments: entry.approval_comments,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      UnderReview: "bg-yellow-100 text-yellow-700",
      Approved: "bg-green-100 text-green-700",
      Rejected: "bg-red-100 text-red-700",
      RequestChanges: "bg-orange-100 text-orange-700",
    };
    return (
      <Badge className={variants[status] || ""}>
        {status === "UnderReview"
          ? "Under Review"
          : status === "RequestChanges"
            ? "Changes Requested"
            : status}
      </Badge>
    );
  };

  // Corp Head can request changes on approved entries only (data already saved by Plant Manager)
  const canRequestChanges = approval.status === "Approved";
  // No more Corp Head approval step - Plant Manager approval directly saves to DB
  const canApprove = false;

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/approvals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Review Data Submission
            </h1>
            <p className="text-muted-foreground mt-1">
              {approval.period} - {approval.siteName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(approval.status)}
        </div>
      </div>

      {/* Submission Information */}
      <Card>
        <CardHeader>
          <CardTitle>{approval.title}</CardTitle>
          <CardDescription>{approval.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Site</Label>
              <div className="font-medium mt-1">{approval.siteName}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Period</Label>
              <div className="font-medium mt-1">{approval.period}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Type</Label>
              <div className="font-medium mt-1">
                {approval.type === "ManualEntry"
                  ? "Manual Entry"
                  : approval.type === "UploadedData"
                    ? "Uploaded Data"
                    : approval.type}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                Metrics Count
              </Label>
              <div className="font-medium mt-1">
                {approval.metricsCount || "-"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                Submitted By
              </Label>
              <div className="font-medium mt-1">{approval.submittedBy}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">
                Submitted Date
              </Label>
              <div className="font-medium mt-1">
                {new Date(approval.submittedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            {approval.reviewedBy && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Reviewed By
                  </Label>
                  <div className="font-medium mt-1">{approval.reviewedBy}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Reviewed Date
                  </Label>
                  <div className="font-medium mt-1">
                    {approval.reviewedAt
                      ? new Date(approval.reviewedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "-"}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Anomaly Detection Summary */}
      {entry.has_anomaly && entry.anomaly_info && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 font-semibold flex items-center justify-between">
            Anomaly Warning
            <Badge
              variant="outline"
              className="bg-orange-100 text-orange-700 border-orange-300"
            >
              {entry.anomaly_count} Anomalies detected
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-orange-700 mt-2">
            <p className="mb-2 text-sm font-medium">
              Significant deviations from historical averages:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entry.anomaly_info.anomalous_fields.map((field, idx) => (
                <div
                  key={idx}
                  className="bg-white p-2 rounded border border-orange-100 text-xs shadow-sm"
                >
                  <p className="font-semibold text-gray-700 truncate">
                    {field.field_name
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </p>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="font-bold">
                      {field.current_value?.toLocaleString() ?? "-"}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      avg: {field.moving_average?.toFixed(1) ?? "N/A"}
                    </span>
                  </p>
                  <p className="text-red-600 font-medium text-[10px]">
                    +{field.deviation_percentage.toFixed(1)}% deviation
                  </p>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Values Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Values</CardTitle>
          <CardDescription>
            {entry.bulk_upload_data?.length || 0} parameter(s) in this entry
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entry.bulk_upload_data && entry.bulk_upload_data.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Parameter Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flattenBulkUploadData(entry.bulk_upload_data).map(
                    (item: any, index: number) => {
                      let movingAvg = item.moving_average ?? null;
                      if (movingAvg == null && entry.anomaly_info?.anomalous_fields) {
                        const displayName = item.display_name || item.param_name || "";
                        const match = entry.anomaly_info.anomalous_fields.find(
                          (f: any) => f.field_name === displayName && f.current_value === item.data_value,
                        );
                        if (match) movingAvg = match.moving_average;
                      }
                      const anomalyResult = detectAnomaly(
                        item.data_value,
                        movingAvg,
                        item.param_name,
                      );
                      return (
                        <TableRow
                          key={index}
                          className={
                            anomalyResult.isAnomaly ? "bg-orange-50/30" : ""
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>
                                {item.param_name?.replace(/_/g, " ") || "N/A"}
                              </span>
                              {item.column && (
                                <span className="text-[10px] text-muted-foreground">
                                  Col: {item.column}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {typeof item.data_value === "number"
                                  ? item.data_value.toLocaleString(undefined, {
                                      maximumFractionDigits: 4,
                                    })
                                  : item.data_value || "N/A"}
                              </span>
                              {anomalyResult.isAnomaly && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] py-0 h-4 ${getAnomalySeverityColor(anomalyResult.severity)}`}
                                >
                                  <AlertTriangle className="h-2 w-2 mr-1" />
                                  {anomalyResult.deviationPercentage.toFixed(1)}
                                  %
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{item.param_unit || "N/A"}</TableCell>
                          <TableCell>{item.month || "N/A"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                item.data_type === "output"
                                  ? "bg-teal-50 text-teal-700 border-teal-300"
                                  : "bg-blue-50 text-blue-700 border-blue-300"
                              }
                            >
                              {item.data_type || "input"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    },
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No data values available in this entry
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Comments/Rejection */}
      {approval.comments && approval.status === "Approved" && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700">Approval Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-900">{approval.comments}</p>
          </CardContent>
        </Card>
      )}

      {approval.rejectionReason && approval.status === "Rejected" && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-900">{approval.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions - Corp Head can only request changes on approved entries */}
      {canRequestChanges && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowRequestChangesDialog(true)}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Request Changes
          </Button>
        </div>
      )}

      {/* Info message for non-approved entries */}
      {!canRequestChanges && approval.status !== "Approved" && (
        <div className="flex justify-end pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            This entry is currently under review by the Plant Manager. You will
            receive a notification once approved.
          </p>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Data Submission</DialogTitle>
            <DialogDescription>
              Approving this submission will make the data available for
              compliance reporting and emissions calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Site:</span>
                <span className="font-medium">{approval.siteName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Period:</span>
                <span className="font-medium">{approval.period}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Metrics:</span>
                <span className="font-medium">
                  {approval.metricsCount} data points
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Comments (Optional)</Label>
              <Textarea
                id="comments"
                placeholder="Add any comments or notes about this approval..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending
                ? "Approving..."
                : "Approve Submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Data Submission</DialogTitle>
            <DialogDescription>
              Please provide a detailed reason for rejecting this submission.
              The plant manager will be notified and can make corrections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Enter detailed reason for rejection (e.g., data inconsistencies, missing documentation, calculation errors)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={5}
                required
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what needs to be corrected for resubmission
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectionReason || rejectMutation.isPending}
              variant="destructive"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Changes Dialog */}
      <Dialog
        open={showRequestChangesDialog}
        onOpenChange={setShowRequestChangesDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Send a change request to the Plant Manager. They will be notified
              and can make the requested corrections before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Site:</span>
                <span className="font-medium">{approval.siteName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Period:</span>
                <span className="font-medium">{approval.period}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Submitted By:</span>
                <span className="font-medium">{approval.submittedBy}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-comments">Change Request Comments *</Label>
              <Textarea
                id="change-comments"
                placeholder="Explain what changes are needed and why (e.g., values seem incorrect, need additional data points, calculations need verification)..."
                value={changeRequestComments}
                onChange={(e) => setChangeRequestComments(e.target.value)}
                rows={5}
                required
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what needs to be corrected or updated
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRequestChangesDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => requestChangesMutation.mutate()}
              disabled={
                !changeRequestComments.trim() ||
                requestChangesMutation.isPending
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {requestChangesMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
