"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancialImpactStore } from "@/lib/store/useFinancialImpactStore";
import { ResultsPanel } from "./results-panel";
import type { FinancialImpactCalculatorProps } from "./types";

export function FinancialImpactCalculator({
  plantId,
  currentGeiOptions = [{ label: "Current Period", value: 0.0 }],
  targetGeiOptions = [{ label: "FY 2025-26", value: 0.0 }],
  productionOptions = [
    { label: "Avg Yearly Production", value: 115388 },
    { label: "Annual Installed Capacity", value: 19000000 },
    { label: "YTD Production", value: 96156 },
  ],
  defaultCurrentGei = 0.0,
  defaultTargetGei = 0.0,
  defaultProduction = 0,
  defaultCccRate = 500,
  showPredictedOption = false,
  predictedGeiValue,
  predictedGeiLabel = "Predicted GEI",
  className = "",
}: FinancialImpactCalculatorProps) {
  const setPlantCalculatorValues = useFinancialImpactStore(
    (state) => state.setPlantCalculatorValues
  );
  const storedValues = useFinancialImpactStore(
    (state) => plantId ? state.plantValues[plantId] : null
  );

  const [currentGeiSelection, setCurrentGeiSelection] = useState<string>("");
  const [currentGei, setCurrentGei] = useState(0);
  const [customCurrentGei, setCustomCurrentGei] = useState("0.0000");

  const [targetGeiSelection, setTargetGeiSelection] = useState<string>("");
  const [targetGei, setTargetGei] = useState(0);
  const [customTargetGei, setCustomTargetGei] = useState("0.0000");

  const [productionSelection, setProductionSelection] = useState<string>("");
  const [production, setProduction] = useState(0);
  const [customProduction, setCustomProduction] = useState("0");

  const [cccRate, setCccRate] = useState(defaultCccRate);

  // Handle predicted option being hidden while selected
  useEffect(() => {
    if (!showPredictedOption && currentGeiSelection === "predicted") {
      setCurrentGeiSelection("");
      setCurrentGei(0);
      setCustomCurrentGei("0.0000");
    }
  }, [showPredictedOption, currentGeiSelection]);

  // Update predicted value when it changes and is selected
  useEffect(() => {
    if (
      showPredictedOption &&
      currentGeiSelection === "predicted" &&
      predictedGeiValue !== undefined
    ) {
      setCurrentGei(predictedGeiValue);
      setCustomCurrentGei(predictedGeiValue.toFixed(4));
    }
  }, [predictedGeiValue, showPredictedOption, currentGeiSelection]);

  // Restore stored values on mount (only once)
  useEffect(() => {
    if (storedValues && plantId) {
      setCurrentGei(storedValues.currentGei);
      setCustomCurrentGei(storedValues.currentGei.toFixed(4));
      setCurrentGeiSelection(storedValues.currentGeiSelection);

      setTargetGei(storedValues.targetGei);
      setCustomTargetGei(storedValues.targetGei.toFixed(4));
      setTargetGeiSelection(storedValues.targetGeiSelection);

      setProduction(storedValues.production);
      setCustomProduction(storedValues.production.toString());
      setProductionSelection(storedValues.productionSelection);

      setCccRate(storedValues.cccRate);
    }
    // Only run on mount - intentionally excluding storedValues from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId]);

  // Persist values to store when they change
  useEffect(() => {
    if (plantId && (currentGeiSelection || targetGeiSelection || productionSelection)) {
      setPlantCalculatorValues(plantId, {
        currentGei,
        targetGei,
        production,
        cccRate,
        deltaGei: currentGei - targetGei,
        totalGhgDelta: (currentGei - targetGei) * production,
        financialImpact: Math.abs((currentGei - targetGei) * production) * cccRate,
        currentGeiSelection,
        targetGeiSelection,
        productionSelection,
      });
    }
  }, [
    plantId,
    currentGei,
    targetGei,
    production,
    cccRate,
    currentGeiSelection,
    targetGeiSelection,
    productionSelection,
    setPlantCalculatorValues,
  ]);

  // Calculate results
  const geiDelta = currentGei - targetGei;
  const totalGhgDelta = geiDelta * production;
  const financialImpact = Math.abs(totalGhgDelta) * cccRate;

  const isExcess = totalGhgDelta > 0;
  const isDeficit = totalGhgDelta < 0;
  const isNeutral = Math.abs(totalGhgDelta) < 0.01;

  const formatCurrency = (value: number) => {
    return `${(value / 100000).toFixed(2)} L`;
  };

  const formatNumber = (value: number, decimals = 0) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Handlers
  const handleCurrentGeiPresetChange = (value: string) => {
    if (value === "custom") {
      setCurrentGeiSelection("custom");
      return;
    }
    if (value === "predicted" && predictedGeiValue !== undefined) {
      setCurrentGeiSelection("predicted");
      setCurrentGei(predictedGeiValue);
      setCustomCurrentGei(predictedGeiValue.toFixed(4));
      return;
    }
    const option = currentGeiOptions.find((o) => o.label === value);
    if (option) {
      setCurrentGeiSelection(value);
      setCurrentGei(option.value);
      setCustomCurrentGei(option.value.toFixed(4));
    }
  };

  const handleTargetGeiPresetChange = (value: string) => {
    if (value === "custom") {
      setTargetGeiSelection("custom");
      return;
    }
    const option = targetGeiOptions.find((o) => o.label === value);
    if (option) {
      setTargetGeiSelection(value);
      setTargetGei(option.value);
      setCustomTargetGei(option.value.toFixed(4));
    }
  };

  const handleProductionPresetChange = (value: string) => {
    const option = productionOptions.find((o) => o.label === value);
    if (option) {
      setProduction(option.value);
      setCustomProduction(option.value.toString());
    }
  };

  const handleCustomCurrentGeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomCurrentGei(e.target.value);
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setCurrentGei(value);
    }
  };

  const handleCustomTargetGeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTargetGei(e.target.value);
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setTargetGei(value);
    }
  };

  const handleCustomProductionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "");
    setCustomProduction(rawValue);
    const value = parseFloat(rawValue) || 0;
    if (value >= 0) {
      setProduction(value);
    }
  };

  const handleCccRateChange = (value: number[]) => {
    setCccRate(value[0]);
  };

  const handleCccInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 100 && value <= 5000) {
      setCccRate(value);
    }
  };

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      {/* Left Box: Input Parameters */}
      <Card className="border-2 border-gray-200 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span>Input Parameters</span>
            <Settings2 className="h-5 w-5 text-gray-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Current GEI Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
              Current GEI (tCO2e/ton)
            </Label>
            <div className="flex gap-2">
              <Select
                value={currentGeiSelection}
                onValueChange={handleCurrentGeiPresetChange}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {showPredictedOption && predictedGeiValue !== undefined && (
                    <SelectItem value="predicted">
                      {predictedGeiLabel} ({predictedGeiValue.toFixed(4)})
                    </SelectItem>
                  )}
                  {currentGeiOptions.map((option, index) => (
                    <SelectItem key={`${option.label}-${index}`} value={option.label}>
                      {option.label} ({option.value.toFixed(4)})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Value</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={customCurrentGei}
                onChange={handleCustomCurrentGeiChange}
                className="w-44 text-right font-mono"
                step="0.0001"
                min="0"
                disabled={currentGeiSelection !== "custom"}
              />
            </div>
          </div>

          {/* Target GEI Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
              Target GEI (tCO2e/ton)
            </Label>
            <div className="flex gap-2">
              <Select
                value={targetGeiSelection}
                onValueChange={handleTargetGeiPresetChange}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select target year" />
                </SelectTrigger>
                <SelectContent>
                  {targetGeiOptions.map((option, index) => (
                    <SelectItem key={`${option.label}-${index}`} value={option.label}>
                      {option.label} ({option.value.toFixed(4)})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Value</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={customTargetGei}
                onChange={handleCustomTargetGeiChange}
                className="w-44 text-right font-mono"
                step="0.0001"
                min="0"
                disabled={targetGeiSelection !== "custom"}
              />
            </div>
          </div>

          {/* Production Volume Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
              Production (tonnes)
            </Label>
            <div className="flex gap-2">
              <Select
                value={productionSelection}
                onValueChange={(val) => {
                  setProductionSelection(val);
                  if (val !== "custom") {
                    handleProductionPresetChange(val);
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select production basis" />
                </SelectTrigger>
                <SelectContent>
                  {productionOptions.map((option, index) => (
                    <SelectItem key={`${option.label}-${index}`} value={option.label}>
                      {option.label} ({formatNumber(option.value)})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Value</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="text"
                value={
                  productionSelection === "custom" ? customProduction : formatNumber(production)
                }
                onChange={handleCustomProductionChange}
                className="w-44 text-right font-mono"
                disabled={productionSelection !== "custom"}
              />
            </div>
          </div>

          {/* CCC Rate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
                CCC Rate (per tCO2e)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={cccRate}
                  onChange={handleCccInputChange}
                  className="h-8 w-20 text-sm font-mono text-right"
                  min={100}
                  max={5000}
                  step={50}
                />
              </div>
            </div>
            <Slider
              value={[cccRate]}
              onValueChange={handleCccRateChange}
              min={100}
              max={5000}
              step={50}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-medium">
              <span>100</span>
              <span>2,500</span>
              <span>5,000</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right Box: Results */}
      <ResultsPanel
        currentGei={currentGei}
        targetGei={targetGei}
        production={production}
        cccRate={cccRate}
        geiDelta={geiDelta}
        totalGhgDelta={totalGhgDelta}
        financialImpact={financialImpact}
        isExcess={isExcess}
        isDeficit={isDeficit}
        isNeutral={isNeutral}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
      />
    </div>
  );
}
