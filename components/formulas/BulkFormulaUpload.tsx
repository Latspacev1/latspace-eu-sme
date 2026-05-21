"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { formulasApi } from "@/lib/api/formulas";
import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  ChevronDown,
  ChevronUp,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

interface MissingParam {
  param_name: string;
  param_type: string; // 'emission' or 'output'
  suggestions: string[];
  used_in_formulas: string[];
}

interface FormulaValidation {
  row_number: number;
  name: string;
  output_param: string;
  expression: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  cascade_warnings: string[];
  missing_params: MissingParam[];
}

interface ValidationResult {
  success: boolean;
  total_count: number;
  valid_count: number;
  invalid_count: number;
  formulas: FormulaValidation[];
  global_errors: string[];
  all_missing_params: MissingParam[];
  has_resolvable_issues: boolean;
}

interface ParamResolution {
  action: "use_existing" | "create_new" | "unresolved";
  use_param?: string; // If using existing
  unit?: string; // If creating new
  display_name?: string; // If creating new
}

export function BulkFormulaUpload() {
  const token = useAppStore((state) => state.token);
  const user = useAppStore((state) => state.user);
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Parameter resolution state
  const [resolutions, setResolutions] = useState<
    Record<string, ParamResolution & { param_type: string }>
  >({});
  const [showResolutionStep, setShowResolutionStep] = useState(false);

  // Initialize resolutions when missing params are detected
  const initializeResolutions = (missingParams: MissingParam[]) => {
    const initial: Record<string, ParamResolution & { param_type: string }> =
      {};
    missingParams.forEach((mp) => {
      initial[mp.param_name] = {
        action: mp.suggestions.length > 0 ? "use_existing" : "create_new",
        use_param: mp.suggestions[0] || undefined,
        unit: "",
        display_name: mp.param_name
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        param_type: mp.param_type, // Track whether it's 'emission' or 'output'
      };
    });
    setResolutions(initial);
  };

  const updateResolution = (
    paramName: string,
    update: Partial<ParamResolution>,
  ) => {
    setResolutions((prev) => ({
      ...prev,
      [paramName]: { ...prev[paramName], ...update },
    }));
  };

  const allResolved = () => {
    return Object.values(resolutions).every((r) => {
      if (r.action === "use_existing") return !!r.use_param;
      if (r.action === "create_new") return !!r.unit && r.unit.trim() !== "";
      return false;
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setValidationResult(null);
      setResolutions({});
      setShowResolutionStep(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleDownloadTemplate = async () => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    try {
      const blob = await formulasApi.downloadTemplate(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "formula_upload_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded successfully");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const handleValidate = async () => {
    if (!file || !token) return;

    setIsValidating(true);
    try {
      const response = await formulasApi.validateBulkUpload(file, token, user?.plantId ?? undefined);
      if (response.success && response.data) {
        setValidationResult(response.data);

        // Check if there are missing params that need resolution
        if (
          response.data.all_missing_params &&
          response.data.all_missing_params.length > 0
        ) {
          initializeResolutions(response.data.all_missing_params);
          setShowResolutionStep(true);
          toast.warning(
            `${response.data.all_missing_params.length} missing parameters need resolution`,
          );
        } else if (response.data.invalid_count > 0) {
          toast.warning(
            `${response.data.invalid_count} formulas have validation errors`,
          );
        } else {
          toast.success("All formulas validated successfully!");
        }
      } else {
        toast.error(response.error || "Validation failed");
      }
    } catch (error) {
      toast.error("Failed to validate file");
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !token) return;

    setIsImporting(true);
    try {
      const response = await formulasApi.importBulkUpload(file, token, true, user?.plantId ?? undefined);
      if (response.success) {
        toast.success(response.message || "Formulas imported successfully");
        setFile(null);
        setValidationResult(null);
        setResolutions({});
        setShowResolutionStep(false);
      } else {
        toast.error(response.error || "Import failed");
      }
    } catch (error) {
      toast.error("Failed to import formulas");
    } finally {
      setIsImporting(false);
    }
  };

  const handleResolveAndImport = async () => {
    if (!file || !token || !allResolved()) return;

    setIsImporting(true);
    try {
      // For now, import with resolutions stored for future backend support
      // The resolutions will be used to create params or remap
      const response = await formulasApi.importWithResolutions(
        file,
        token,
        resolutions,
        user?.plantId ?? undefined,
      );
      if (response.success) {
        toast.success(
          response.message || "Formulas imported with resolved parameters",
        );
        setFile(null);
        setValidationResult(null);
        setResolutions({});
        setShowResolutionStep(false);
      } else {
        toast.error(response.error || "Import failed");
      }
    } catch (error) {
      toast.error("Failed to import formulas");
    } finally {
      setIsImporting(false);
    }
  };

  const toggleRowExpand = (rowNumber: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Download Template Card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Step 1: Download Template
          </CardTitle>
          <CardDescription>
            Download the Excel template with example formulas and instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Step 2: Upload Filled Template
          </CardTitle>
          <CardDescription>
            Upload your Excel file with formula definitions for validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : file
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-300 hover:border-slate-400"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <div className="text-left">
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <p className="text-sm text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setValidationResult(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">
                  {isDragActive
                    ? "Drop the Excel file here..."
                    : "Drag and drop an Excel file, or click to select"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Supports .xlsx and .xls files
                </p>
              </div>
            )}
          </div>

          {file && (
            <div className="flex gap-3">
              <Button
                onClick={handleValidate}
                disabled={isValidating}
                variant="outline"
                className="gap-2"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Validate Formulas
              </Button>
              {validationResult && validationResult.valid_count > 0 && (
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Import {validationResult.valid_count} Valid Formulas
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {validationResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              Validation Results
            </CardTitle>
            <CardDescription className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  {validationResult.valid_count} Valid
                </Badge>
              </span>
              {validationResult.invalid_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-700 border-red-200"
                  >
                    {validationResult.invalid_count} Invalid
                  </Badge>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {validationResult.global_errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800 mb-1">File Errors:</p>
                <ul className="list-disc list-inside text-sm text-red-700">
                  {validationResult.global_errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Parameters Resolution UI */}
            {validationResult.all_missing_params &&
              validationResult.all_missing_params.length > 0 &&
              showResolutionStep && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Resolve Missing Parameters (
                    {validationResult.all_missing_params.length})
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    For each missing parameter, choose to use an existing
                    parameter or create a new one.
                  </p>
                  <div className="space-y-3">
                    {validationResult.all_missing_params.map((mp, i) => (
                      <div
                        key={i}
                        className="bg-white p-4 rounded border border-amber-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <code className="text-sm font-medium text-slate-800 bg-amber-100 px-2 py-0.5 rounded">
                            {mp.param_name}
                          </code>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              mp.param_type === "formula_output"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                : mp.param_type === "output"
                                  ? "bg-purple-100 text-purple-700 border-purple-300"
                                  : "bg-amber-100 text-amber-700 border-amber-300"
                            }`}
                          >
                            {mp.param_type === "formula_output"
                              ? "🎯 Formula Output"
                              : mp.param_type === "output"
                                ? "📊 Output Dependency"
                                : "📥 Input"}
                          </Badge>
                        </div>

                        {/* Resolution Options */}
                        <div className="space-y-3">
                          {/* Option 1: Use existing */}
                          {mp.suggestions.length > 0 && (
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                id={`use-${mp.param_name}`}
                                name={`resolve-${mp.param_name}`}
                                checked={
                                  resolutions[mp.param_name]?.action ===
                                  "use_existing"
                                }
                                onChange={() =>
                                  updateResolution(mp.param_name, {
                                    action: "use_existing",
                                    use_param: mp.suggestions[0],
                                  })
                                }
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={`use-${mp.param_name}`}
                                  className="text-sm font-medium text-slate-700 cursor-pointer"
                                >
                                  Use existing parameter
                                </label>
                                {resolutions[mp.param_name]?.action ===
                                  "use_existing" && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {mp.suggestions.map((sug, j) => (
                                      <button
                                        key={j}
                                        onClick={() =>
                                          updateResolution(mp.param_name, {
                                            use_param: sug,
                                          })
                                        }
                                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                                          resolutions[mp.param_name]
                                            ?.use_param === sug
                                            ? "bg-blue-500 text-white border-blue-600"
                                            : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                        }`}
                                      >
                                        {sug}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Option 2: Create new */}
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              id={`create-${mp.param_name}`}
                              name={`resolve-${mp.param_name}`}
                              checked={
                                resolutions[mp.param_name]?.action ===
                                "create_new"
                              }
                              onChange={() =>
                                updateResolution(mp.param_name, {
                                  action: "create_new",
                                })
                              }
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={`create-${mp.param_name}`}
                                className="text-sm font-medium text-slate-700 cursor-pointer"
                              >
                                Create new parameter
                              </label>
                              {resolutions[mp.param_name]?.action ===
                                "create_new" && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-slate-500 block mb-1">
                                      Display Name
                                    </label>
                                    <input
                                      type="text"
                                      value={
                                        resolutions[mp.param_name]
                                          ?.display_name || ""
                                      }
                                      onChange={(e) =>
                                        updateResolution(mp.param_name, {
                                          display_name: e.target.value,
                                        })
                                      }
                                      className="w-full text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="e.g., Coal Consumption"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-500 block mb-1">
                                      Unit *
                                    </label>
                                    <input
                                      type="text"
                                      value={
                                        resolutions[mp.param_name]?.unit || ""
                                      }
                                      onChange={(e) =>
                                        updateResolution(mp.param_name, {
                                          unit: e.target.value,
                                        })
                                      }
                                      className="w-full text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="e.g., kg, MWh, tons"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 mt-2">
                          Used in: {mp.used_in_formulas.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Import with Resolutions Button */}
                  <div className="mt-4 flex gap-3">
                    <Button
                      onClick={handleResolveAndImport}
                      disabled={!allResolved() || isImporting}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isImporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Resolve & Import
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowResolutionStep(false)}
                    >
                      Cancel
                    </Button>
                    {!allResolved() && (
                      <p className="text-xs text-amber-600 flex items-center">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        All parameters must be resolved (unit required for new
                        params)
                      </p>
                    )}
                  </div>
                </div>
              )}

            <div className="space-y-2">
              {validationResult.formulas.map((formula) => (
                <div
                  key={formula.row_number}
                  className={`border rounded-lg overflow-hidden ${
                    formula.valid
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-red-200 bg-red-50/50"
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/50"
                    onClick={() => toggleRowExpand(formula.row_number)}
                  >
                    <div className="flex items-center gap-3">
                      {formula.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">
                          {formula.name}
                        </p>
                        <p className="text-sm text-slate-500 font-mono">
                          {formula.output_param}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {formula.warnings.length > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                        >
                          {formula.warnings.length} warning
                          {formula.warnings.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {formula.cascade_warnings.length > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-700 border-purple-200 text-xs gap-1"
                        >
                          <Link2 className="h-3 w-3" />
                          {formula.cascade_warnings.length} affected
                        </Badge>
                      )}
                      {expandedRows.has(formula.row_number) ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {expandedRows.has(formula.row_number) && (
                    <div className="border-t border-slate-200 p-3 bg-white/50 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">
                          Expression:
                        </p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block overflow-x-auto">
                          {formula.expression}
                        </code>
                      </div>

                      {formula.errors.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Errors:
                          </p>
                          <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                            {formula.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {formula.warnings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Warnings:
                          </p>
                          <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                            {formula.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {formula.cascade_warnings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> Cascade Impact:
                          </p>
                          <ul className="list-disc list-inside text-xs text-purple-700 space-y-0.5">
                            {formula.cascade_warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
