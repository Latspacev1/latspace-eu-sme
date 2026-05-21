"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Play } from "lucide-react";
import { TemplateFillConfig } from "./TemplateFiller";

interface ConfigureStepProps {
  plantId: string;
  initialConfig: TemplateFillConfig;
  onBack: () => void;
  onComplete: (config: TemplateFillConfig) => void;
}

// Financial year order (Apr-Mar)
const MONTHS = [
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
];

export function ConfigureStep({ initialConfig, onBack, onComplete }: ConfigureStepProps) {
  const [financialYear, setFinancialYear] = useState(initialConfig.financialYear);
  const [timeType, setTimeType] = useState<"monthly" | "annual">(initialConfig.timeType);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(initialConfig.months || []);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleMonthToggle = (month: number) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const selectAllMonths = () => {
    setSelectedMonths(MONTHS.map((m) => m.value));
  };

  const clearAllMonths = () => {
    setSelectedMonths([]);
  };

  const handleContinue = () => {
    onComplete({
      ...initialConfig,
      financialYear,
      timeType,
      months: timeType === "monthly" ? selectedMonths : undefined,
    });
  };

  const canContinue = timeType === "annual" || selectedMonths.length > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Configure Data Source</h3>
            <p className="text-sm text-muted-foreground">
              Select the financial year and time period for the data to fill
            </p>
          </div>

          {/* Summary of previous selections */}
          <div className="bg-muted p-4 rounded-lg grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Sheet:</span>
              <p className="font-medium">{initialConfig.sheetName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Column:</span>
              <p className="font-medium">{initialConfig.targetColumn}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Start Row:</span>
              <p className="font-medium">{initialConfig.startRow}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Financial Year</Label>
            <Select
              value={String(financialYear)}
              onValueChange={(v) => setFinancialYear(parseInt(v))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    FY {year}-{(year + 1).toString().slice(-2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Time Range</Label>
            <RadioGroup
              value={timeType}
              onValueChange={(v: string) => setTimeType(v as "monthly" | "annual")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="annual" id="annual" />
                <Label htmlFor="annual" className="font-normal cursor-pointer">
                  Annual (full year aggregate)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="font-normal cursor-pointer">
                  Monthly (select specific months)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {timeType === "monthly" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Months</Label>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAllMonths} type="button">
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllMonths} type="button">
                    Clear
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {MONTHS.map((month) => (
                  <label
                    key={month.value}
                    htmlFor={`month-${month.value}`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      id={`month-${month.value}`}
                      checked={selectedMonths.includes(month.value)}
                      onCheckedChange={() => handleMonthToggle(month.value)}
                      className="border-gray-400"
                    />
                    <span className="text-sm">{month.label}</span>
                  </label>
                ))}
              </div>
              {selectedMonths.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedMonths.length} {selectedMonths.length === 1 ? "month" : "months"}{" "}
                  selected
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue}>
          <Play className="w-4 h-4 mr-2" />
          Start Filling
        </Button>
      </CardFooter>
    </Card>
  );
}
