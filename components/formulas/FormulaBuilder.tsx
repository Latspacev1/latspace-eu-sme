"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formulasApi } from "@/lib/api/formulas";
import { DraggableParam } from "./DraggableParam";
import { OperatorToolbar } from "./OperatorToolbar";
import { FormulaCanvas, FormulaCanvasRef } from "./FormulaCanvas";
import { FormulaTrace } from "./FormulaTrace";
import { useAppStore } from "@/lib/store/useAppStore";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Save,
  ArrowLeft,
  FlaskConical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function FormulaBuilder() {
  const router = useRouter();
  const { user } = useAppStore();
  const canvasRef = useRef<FormulaCanvasRef>(null);

  const [expression, setExpression] = useState("");
  const [name, setName] = useState("");
  const [outputParam, setOutputParam] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("monthly");

  const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewTrace, setPreviewTrace] = useState<{
    provenance: Record<string, any>;
    traceSteps: Record<string, unknown>[] | null;
  } | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  // Fetch available parameters
  const { data: paramsData } = useQuery({
    queryKey: ["formulaParams"],
    queryFn: formulasApi.getAvailableParams,
  });

  const availableInputParams = paramsData?.data?.emission_params || [];
  const availableOutputParams = paramsData?.data?.output_params || [];
  const assetParams = paramsData?.data?.asset_params || {};

  // Track expanded asset types and assets
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const toggleAsset = (key: string) => {
    setExpandedAssets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: formulasApi.validate,
    onSuccess: (data) => {
      if (data.success && data.data) {
        setIsValid(data.data.valid ?? true);
      } else {
        setIsValid(false);
      }
    },
    onError: () => {
      setIsValid(false);
    },
  });

  // Save mutation
  const createMutation = useMutation({
    mutationFn: formulasApi.create,
    onSuccess: (data) => {
      if (data.success) {
        router.push("/corporate/overview");
      } else {
        alert(
          "Failed to save formula: " +
            (data.message || data.error || "Unknown error"),
        );
      }
    },
    onError: (error: any) => {
      alert("Failed to save formula: " + (error.message || "Unknown error"));
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: formulasApi.preview,
    onSuccess: (data) => {
      if (data.success && data.data && data.data.result !== undefined) {
        setPreviewResult(String(data.data.result));
        setPreviewTrace({
          provenance: data.data.provenance ?? {},
          traceSteps: data.data.trace_steps ?? null,
        });
      } else {
        setPreviewResult("Error");
        setPreviewTrace(null);
      }
    },
    onError: () => {
      setPreviewResult("Error");
      setPreviewTrace(null);
    },
  });

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (expression.trim()) {
        validateMutation.mutate(expression);

        // Also try to preview if we have plant ID
        if (user?.plantId) {
          previewMutation.mutate({
            expression,
            plant_id: user.plantId,
            financial_year: 2025,
            month: 1,
          });
        }
      } else {
        setIsValid(undefined);
        setPreviewResult(null);
        setPreviewTrace(null);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [expression, user?.plantId]);

  const handleOperatorInsert = (op: string) => {
    // Insert with spaces for readability
    canvasRef.current?.insert(" " + op + " ");
  };

  const handleParamInsert = (param: string) => {
    canvasRef.current?.insert(param);
  };

  const handleSave = () => {
    if (!name || !outputParam || !expression) {
      alert("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      name,
      expression,
      output_param: outputParam,
      description,
      scope,
      plant_id: user?.plantId ?? null,
    });
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-100/50 rounded-full">
            <FlaskConical className="w-5 h-5 text-teal-700" />
          </div>
          <CardTitle className="text-base font-medium text-slate-700">
            New Metric Definition
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-slate-600"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </CardHeader>

      <CardContent className="p-6 lg:p-8 space-y-8">
        {/* Metadata Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="formula-name"
              className="text-xs font-bold uppercase tracking-widest text-slate-500"
            >
              Formula Name
            </Label>
            <Input
              id="formula-name"
              placeholder="e.g. Carbon Intensity Scope 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-slate-300 focus-visible:ring-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="output-param"
              className="text-xs font-bold uppercase tracking-widest text-slate-500"
            >
              Output Parameter
            </Label>
            <Select value={outputParam} onValueChange={setOutputParam}>
              <SelectTrigger
                id="output-param"
                className="border-slate-300 focus:ring-teal-500"
              >
                <SelectValue placeholder="Select Output Parameter" />
              </SelectTrigger>
              <SelectContent>
                {availableOutputParams.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label
              htmlFor="description"
              className="text-xs font-bold uppercase tracking-widest text-slate-500"
            >
              Description
            </Label>
            <Input
              id="description"
              placeholder="Optional description of this calculation"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-slate-300 focus-visible:ring-teal-500"
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Plant-Level Parameters
            </Label>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] text-slate-400 font-normal"
            >
              CLICK TO INSERT
            </Badge>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 min-h-[60px] flex flex-wrap gap-2 content-start">
            {availableInputParams.map((param) => (
              <DraggableParam
                key={param}
                label={param}
                type="input"
                onClick={() => handleParamInsert(param)}
              />
            ))}
            {availableInputParams.length === 0 && (
              <div className="w-full text-center py-2">
                <span className="text-xs text-slate-400">
                  No plant-level parameters
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Asset-Scoped Parameters */}
        {Object.keys(assetParams).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Asset Parameters
              </Label>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] text-slate-400 font-normal"
              >
                ASSET.PARAM SYNTAX
              </Badge>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              {Object.entries(assetParams).map(([assetType, assets]) => (
                <Collapsible
                  key={assetType}
                  open={expandedTypes.has(assetType)}
                  onOpenChange={() => toggleType(assetType)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-slate-100 rounded text-left">
                    {expandedTypes.has(assetType) ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-sm font-medium text-slate-700 capitalize">
                      {assetType}
                    </span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {Object.keys(assets as Record<string, string[]>).length}{" "}
                      assets
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 space-y-1">
                    {Object.entries(assets as Record<string, string[]>).map(
                      ([assetName, params]) => {
                        const assetKey = `${assetType}:${assetName}`;
                        return (
                          <Collapsible
                            key={assetKey}
                            open={expandedAssets.has(assetKey)}
                            onOpenChange={() => toggleAsset(assetKey)}
                          >
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-1.5 hover:bg-slate-100 rounded text-left">
                              {expandedAssets.has(assetKey) ? (
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-slate-400" />
                              )}
                              <span className="text-xs font-medium text-slate-600">
                                {assetName}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-auto">
                                {params.length} params
                              </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-5 pt-1 pb-2">
                              <div className="flex flex-wrap gap-1.5">
                                {params.map((param: string) => (
                                  <button
                                    key={`${assetName}.${param}`}
                                    onClick={() =>
                                      handleParamInsert(`${assetName}.${param}`)
                                    }
                                    className="px-2 py-0.5 text-[11px] bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 transition-colors"
                                  >
                                    {assetName}.{param}
                                  </button>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      },
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </section>
        )}

        <OperatorToolbar onInsert={handleOperatorInsert} />

        <FormulaCanvas
          ref={canvasRef}
          expression={expression}
          setExpression={setExpression}
          isValid={isValid}
          previewResult={previewResult}
          availableParams={availableInputParams}
        />

        {previewTrace && Object.keys(previewTrace.provenance).length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              {showTrace ? "Hide trace" : "Show trace"}
            </button>
            {showTrace && (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <FormulaTrace
                  expression={expression}
                  provenance={previewTrace.provenance}
                  traceSteps={previewTrace.traceSteps}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-3 px-6 py-4 bg-slate-50/50 border-t border-slate-100 rounded-b-lg">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="uppercase tracking-wide text-xs font-medium"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isValid || createMutation.isPending}
          className="bg-teal-700 hover:bg-teal-800 text-white uppercase tracking-wide text-xs font-medium gap-2"
        >
          {createMutation.isPending ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {createMutation.isPending ? "Saving..." : "Save Formula"}
        </Button>
      </CardFooter>
    </Card>
  );
}
