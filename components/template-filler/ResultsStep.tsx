"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FillResponse, getDownloadUrl } from "@/lib/api/template-filler";
import {
  Download,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  FileSpreadsheet,
} from "lucide-react";

interface ResultsStepProps {
  result: FillResponse;
  onReset: () => void;
}

interface MappingMatch {
  row?: number;
  template_row?: number;
  parameter_name?: string;
  parameter?: string;
  template_label?: string;
  matched_param?: string;
  matched_asset?: string;
  target_cell?: string;
  value?: number | string | null;
  confidence?: number;
}

interface MappingSkipped {
  row?: number;
  template_row?: number;
  target_cell?: string;
  reason?: string;
  template_label?: string;
}

export function ResultsStep({ result, onReset }: ResultsStepProps) {
  const [showMatches, setShowMatches] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const handleDownload = () => {
    window.open(getDownloadUrl(result.file_id), "_blank");
  };

  const matches = result.mapping_report.matches as MappingMatch[];
  const skipped = result.mapping_report.skipped as MappingSkipped[];
  const errors = result.mapping_report.errors;

  const hasMatches = matches.length > 0;
  const hasSkipped = skipped.length > 0;
  const hasErrors = errors.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Success header */}
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-green-100 p-3 shrink-0">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">
                Template filled successfully!
              </h3>
              <p className="text-muted-foreground">
                Your Excel template has been processed and is ready for download.
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center min-w-0">
              <div className="text-3xl font-bold text-green-700">
                {result.summary.total_filled.toLocaleString()}
              </div>
              <div className="text-sm text-green-600">Cells Filled</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center min-w-0">
              <div className="text-3xl font-bold text-yellow-700">
                {result.summary.total_skipped.toLocaleString()}
              </div>
              <div className="text-sm text-yellow-600">Rows Skipped</div>
            </div>
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center min-w-0">
              <div className="text-3xl font-bold text-red-700">
                {result.summary.total_errors.toLocaleString()}
              </div>
              <div className="text-sm text-red-600">Errors</div>
            </div>
          </div>

          {/* Download button */}
          <Button onClick={handleDownload} size="lg" className="w-full">
            <Download className="w-5 h-5 mr-2" />
            Download Filled Workbook
            <FileSpreadsheet className="w-5 h-5 ml-2" />
          </Button>

          {/* Mapping details */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Mapping Details
            </h4>

            {hasMatches && (
              <Collapsible open={showMatches} onOpenChange={setShowMatches}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Successful Matches
                      <Badge variant="secondary">
                        {matches.length}
                      </Badge>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showMatches ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-y-auto max-h-[500px]">
                      <table className="w-full text-xs border-collapse" style={{tableLayout: "fixed"}}>
                        <colgroup>
                          <col style={{width: "56px"}} />
                          <col style={{width: "30%"}} />
                          <col style={{width: "22%"}} />
                          <col style={{width: "10%"}} />
                          <col style={{width: "12%"}} />
                          <col style={{width: "60px"}} />
                        </colgroup>
                        <thead className="sticky top-0 bg-background border-b z-10">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cell</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Label</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Param</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">Conf.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matches.map((match, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                                {match.target_cell ?? match.row ?? match.template_row ?? "-"}
                              </td>
                              <td className="px-3 py-2 leading-snug">
                                <div className="truncate" title={match.template_label ?? ""}>
                                  {match.template_label ?? "-"}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="truncate font-medium" title={match.matched_param ?? match.parameter_name ?? ""}>
                                  {match.matched_param ?? match.parameter_name ?? match.parameter ?? "-"}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="truncate text-muted-foreground" title={match.matched_asset ?? ""}>
                                  {match.matched_asset ?? "-"}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-mono">
                                {match.value !== null && match.value !== undefined
                                  ? typeof match.value === "number"
                                    ? match.value.toLocaleString()
                                    : match.value
                                  : "-"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge
                                  variant={(match.confidence ?? 0) >= 0.9 ? "default" : "secondary"}
                                  className="text-xs px-1.5"
                                >
                                  {Math.round((match.confidence ?? 0) * 100)}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {hasSkipped && (
              <Collapsible open={showSkipped} onOpenChange={setShowSkipped}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      Skipped Rows
                      <Badge variant="secondary">
                        {skipped.length}
                      </Badge>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showSkipped ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Cell</TableHead>
                          <TableHead className="w-[45%]">Label</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skipped.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {item.target_cell ?? item.row ?? item.template_row ?? "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.template_label ?? "-"}
                            </TableCell>
                            <TableCell className="text-xs text-yellow-700">
                              {item.reason ?? "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {hasErrors && (
              <Collapsible open={showErrors} onOpenChange={setShowErrors}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Errors
                      <Badge variant="destructive">
                        {errors.length}
                      </Badge>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showErrors ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border border-destructive/50 rounded-lg overflow-auto max-h-[300px] p-2">
                    <div className="text-sm text-destructive space-y-1">
                      {errors.map((error, idx) => (
                        <div key={idx} className="p-2 bg-destructive/5 rounded">
                          {typeof error === "string"
                            ? error
                            : JSON.stringify(error)}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="outline" onClick={onReset} className="w-full">
          <RotateCcw className="w-4 h-4 mr-2" />
          Fill Another Template
        </Button>
      </CardFooter>
    </Card>
  );
}
