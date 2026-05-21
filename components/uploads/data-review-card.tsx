"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Pencil,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface ExtractedField {
  id: string;
  label: string;
  value: string | number;
  unit: string;
  isAnomaly?: boolean;
  anomalyMessage?: string;
  hasUnitMismatch?: boolean;
  suggestedUnit?: string;
  suggestedValue?: string | number;
  category: "production" | "energy" | "fuel";
}

export interface ExtractedDataReview {
  fileName: string;
  fileSize: string;
  uploadDate: string;
  extractedFields: ExtractedField[];
}

interface DataReviewCardProps {
  data: ExtractedDataReview;
  onApprove: (editedFields: ExtractedField[]) => void;
  onReject: () => void;
  onEdit: () => void;
}

export function DataReviewCard({
  data,
  onApprove,
  onReject,
  onEdit,
}: DataReviewCardProps) {
  const [editedFields, setEditedFields] = useState<ExtractedField[]>(
    data.extractedFields,
  );
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  // Separate fields into primary and secondary
  const primaryFields = editedFields.filter((f) =>
    [
      "clinker_production",
      "clinker_consumption",
      "raw_meal",
      "limestone",
      "cement_total",
      "opc_produced",
    ].includes(f.id),
  );

  const secondaryFields = editedFields.filter(
    (f) =>
      ![
        "clinker_production",
        "clinker_consumption",
        "raw_meal",
        "limestone",
        "cement_total",
        "opc_produced",
      ].includes(f.id),
  );

  const hasAnomalies = editedFields.some((f) => f.isAnomaly);
  const hasUnitMismatches = editedFields.some((f) => f.hasUnitMismatch);

  const handleFieldEdit = (fieldId: string, newValue: string) => {
    setEditedFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, value: newValue, isAnomaly: false } : f,
      ),
    );
  };

  const handleUnitChange = (fieldId: string, newUnit: string) => {
    setEditedFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, unit: newUnit, hasUnitMismatch: false } : f,
      ),
    );
  };

  const handleAutoCorrect = (fieldId: string) => {
    setEditedFields((prev) =>
      prev.map((f) => {
        if (
          f.id === fieldId &&
          f.hasUnitMismatch &&
          f.suggestedValue &&
          f.suggestedUnit
        ) {
          return {
            ...f,
            value: f.suggestedValue,
            unit: f.suggestedUnit,
            hasUnitMismatch: false,
          };
        }
        return f;
      }),
    );
  };

  const renderField = (field: ExtractedField) => {
    const isEditing = editingFieldId === field.id;

    return (
      <div
        key={field.id}
        className={cn(
          "flex items-start justify-between py-3 border-b last:border-0",
          field.isAnomaly && "bg-red-50 dark:bg-red-950/20 px-3 rounded-md",
        )}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{field.label}</Label>
            {field.isAnomaly && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                Anomaly
              </Badge>
            )}
            {field.hasUnitMismatch && (
              <Badge
                variant="outline"
                className="text-xs text-orange-600 border-orange-600"
              >
                Unit Mismatch
              </Badge>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={field.value}
                onChange={(e) => handleFieldEdit(field.id, e.target.value)}
                className="max-w-xs"
              />
              <Select
                value={field.unit}
                onValueChange={(value) => handleUnitChange(field.id, value)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t">t</SelectItem>
                  <SelectItem value="Tons">Tons</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="MWh">MWh</SelectItem>
                  <SelectItem value="kWh">kWh</SelectItem>
                  <SelectItem value="KL">KL</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingFieldId(null)}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "text-base font-semibold",
                  field.isAnomaly && "text-red-600 dark:text-red-400",
                )}
              >
                {typeof field.value === "number"
                  ? field.value.toLocaleString()
                  : field.value}{" "}
                {field.unit}
              </span>
            </div>
          )}

          {field.isAnomaly && field.anomalyMessage && (
            <Alert className="mt-2 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {field.anomalyMessage}
              </AlertDescription>
            </Alert>
          )}

          {field.hasUnitMismatch &&
            field.suggestedValue &&
            field.suggestedUnit && (
              <div className="mt-2 text-xs text-muted-foreground">
                Suggested: {field.suggestedValue.toLocaleString()}{" "}
                {field.suggestedUnit}
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 ml-2 text-xs"
                  onClick={() => handleAutoCorrect(field.id)}
                >
                  Auto-correct
                </Button>
              </div>
            )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditingFieldId(field.id)}
          className="ml-2"
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                Daily Production Report Upload
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                {data.uploadDate}
              </CardDescription>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>{data.fileName}</span>
            <span className="text-xs">({data.fileSize})</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <h3 className="font-semibold text-sm">
              Extracted Data - Review Required
            </h3>
          </div>
          <Badge
            variant="secondary"
            className="text-orange-600 border-orange-600"
          >
            Pending Review
          </Badge>
        </div>

        {(hasAnomalies || hasUnitMismatches) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {hasAnomalies && "Some values appear anomalous. "}
              {hasUnitMismatches && "Some unit mismatches detected. "}
              Please review and correct before approving.
            </AlertDescription>
          </Alert>
        )}

        {/* Primary Fields */}
        <div className="space-y-1">{primaryFields.map(renderField)}</div>

        {/* Secondary Fields (Collapsible) */}
        {secondaryFields.length > 0 && (
          <div className="space-y-1">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setShowAllMetrics(!showAllMetrics)}
            >
              <span className="text-sm font-medium">
                {showAllMetrics ? "Hide" : "Show"} Additional Metrics (
                {secondaryFields.length})
              </span>
              {showAllMetrics ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>

            {showAllMetrics && (
              <div className="mt-2 space-y-1 border rounded-md p-3">
                {secondaryFields.map(renderField)}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={onReject}>
            <X className="w-4 h-4 mr-2" />
            REJECT
          </Button>
          <Button variant="outline" className="flex-1" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            EDIT
          </Button>
          <Button
            className="flex-1"
            onClick={() => onApprove(editedFields)}
            disabled={hasAnomalies}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            APPROVE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
