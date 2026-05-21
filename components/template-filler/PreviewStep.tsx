"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewResponse } from "@/lib/api/template-filler";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewStepProps {
  previewData: PreviewResponse;
  onBack: () => void;
  onComplete: (sheetName: string, column: string, startRow: number) => void;
}

export function PreviewStep({ previewData, onBack, onComplete }: PreviewStepProps) {
  const [selectedSheet, setSelectedSheet] = useState(previewData.sheets[0]?.name || "");
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [startRow, setStartRow] = useState(2);

  const currentSheet = previewData.sheets.find((s) => s.name === selectedSheet);

  const handleColumnClick = (column: string) => {
    setSelectedColumn(column);
  };

  const handleContinue = () => {
    if (selectedColumn && currentSheet) {
      onComplete(currentSheet.name, selectedColumn, startRow);
    }
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="pt-6">
        <div className="space-y-4 min-w-0">
          <div>
            <h3 className="text-lg font-semibold mb-1">Select Sheet & Column</h3>
            <p className="text-sm text-muted-foreground">
              Click a column header to select the column to fill with data
            </p>
          </div>

          {/* Sheet tabs */}
          <div className="flex flex-wrap gap-1 border-b overflow-x-auto">
            {previewData.sheets.map((sheet) => (
              <button
                key={sheet.name}
                onClick={() => {
                  setSelectedSheet(sheet.name);
                  setSelectedColumn(null);
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                  selectedSheet === sheet.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {sheet.name}
              </button>
            ))}
          </div>

          {/* Excel-like grid */}
          {currentSheet && (
            <>
              <div className="border rounded-lg overflow-auto max-h-[400px] w-full">
                <table className="text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="border p-2 bg-muted text-muted-foreground font-normal w-12">
                        #
                      </th>
                      {currentSheet.columns.map((col) => (
                        <th
                          key={col}
                          onClick={() => handleColumnClick(col)}
                          className={cn(
                            "border p-2 cursor-pointer transition-colors min-w-[100px]",
                            selectedColumn === col
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-accent"
                          )}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.preview_rows.map((row) => (
                      <tr key={row.row_number} className="hover:bg-accent/50">
                        <td className="border p-2 bg-muted text-muted-foreground font-mono text-xs text-center">
                          {row.row_number}
                        </td>
                        {currentSheet.columns.map((col) => (
                          <td
                            key={col}
                            className={cn(
                              "border p-2 truncate max-w-[200px]",
                              selectedColumn === col && "bg-primary/10"
                            )}
                            title={row[col] != null ? String(row[col]) : undefined}
                          >
                            {row[col] != null ? String(row[col]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-muted-foreground">
                Total rows: {currentSheet.row_count.toLocaleString()} (showing first{" "}
                {currentSheet.preview_rows.length})
              </div>
            </>
          )}

          {selectedColumn && (
            <div className="bg-accent p-3 rounded-lg text-sm">
              <span className="font-medium">Selected:</span> Column {selectedColumn}
              {currentSheet?.headers && currentSheet.headers.length > 0 && (
                <span className="text-muted-foreground ml-2">
                  (Header:{" "}
                  {String(
                    currentSheet.headers[currentSheet.columns.indexOf(selectedColumn)] ?? "N/A"
                  )}
                  )
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label htmlFor="startRow">Start filling from row</Label>
              <Input
                id="startRow"
                type="number"
                min={1}
                value={startRow}
                onChange={(e) => setStartRow(parseInt(e.target.value) || 2)}
                className="w-24"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-6">Row 1 is typically the header row</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!selectedColumn}>
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
