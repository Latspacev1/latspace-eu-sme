"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formulasApi, Formula } from "@/lib/api/formulas";
import { useAppStore } from "@/lib/store/useAppStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListFilter,
  RefreshCw,
  CheckCircle2,
  Clock,
  Archive,
  Lock,
  Code2,
  ArrowRight,
  Layers,
} from "lucide-react";

// Topological sort to get execution order
interface FormulaWithLevel extends Formula {
  executionLevel: number;
}

function getExecutionOrder(formulas: Formula[]): FormulaWithLevel[] {
  // Build a map of output_param -> formula
  const outputToFormula = new Map<string, Formula>();
  formulas.forEach((f) => {
    outputToFormula.set(f.output_param, f);
  });

  // Calculate execution level for each formula
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function getLevel(formula: Formula): number {
    const id = formula.id;

    // Already calculated
    if (levels.has(id)) return levels.get(id)!;

    // Cycle detection
    if (visiting.has(id)) return 0;

    visiting.add(id);

    // Get max level of dependencies
    let maxDepLevel = -1;
    const outputDeps = formula.dependencies?.output_params || [];

    for (const depParam of outputDeps) {
      const depFormula = outputToFormula.get(depParam);
      if (depFormula && depFormula.id !== id) {
        const depLevel = getLevel(depFormula);
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }
    }

    visiting.delete(id);
    visited.add(id);

    const level = maxDepLevel + 1;
    levels.set(id, level);
    return level;
  }

  // Calculate levels for all formulas
  formulas.forEach((f) => getLevel(f));

  // Add level to each formula and sort
  const formulasWithLevel: FormulaWithLevel[] = formulas.map((f) => ({
    ...f,
    executionLevel: levels.get(f.id) || 0,
  }));

  // Sort by level, then by name for stability
  return formulasWithLevel.sort((a, b) => {
    if (a.executionLevel !== b.executionLevel) {
      return a.executionLevel - b.executionLevel;
    }
    return a.name.localeCompare(b.name);
  });
}

// Group formulas by execution level
function groupByLevel(
  formulas: FormulaWithLevel[],
): Map<number, FormulaWithLevel[]> {
  const groups = new Map<number, FormulaWithLevel[]>();
  formulas.forEach((f) => {
    const level = f.executionLevel;
    if (!groups.has(level)) {
      groups.set(level, []);
    }
    groups.get(level)!.push(f);
  });
  return groups;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: "Active",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  draft: {
    label: "Draft",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3" />,
  },
  deprecated: {
    label: "Deprecated",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: <Archive className="w-3 h-3" />,
  },
  immutable: {
    label: "Immutable",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Lock className="w-3 h-3" />,
  },
};

// Syntax highlighting for formula expressions
function HighlightedExpression({
  expression,
  dependencies,
}: {
  expression: string;
  dependencies?: Formula["dependencies"];
}) {
  const emissionParams = new Set(dependencies?.emission_params || []);
  const outputParams = new Set(dependencies?.output_params || []);
  const conversionFactors = new Set(dependencies?.conversion_factors || []);

  // Tokenize the expression
  const tokens: { type: string; value: string }[] = [];
  let remaining = expression;

  while (remaining.length > 0) {
    // Skip whitespace
    const wsMatch = remaining.match(/^\s+/);
    if (wsMatch) {
      tokens.push({ type: "whitespace", value: wsMatch[0] });
      remaining = remaining.slice(wsMatch[0].length);
      continue;
    }

    // Match operators
    const opMatch = remaining.match(/^[+\-*/()^,]/);
    if (opMatch) {
      tokens.push({ type: "operator", value: opMatch[0] });
      remaining = remaining.slice(1);
      continue;
    }

    // Match numbers
    const numMatch = remaining.match(/^\d+\.?\d*/);
    if (numMatch) {
      tokens.push({ type: "number", value: numMatch[0] });
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // Match identifiers (parameters) - including dot notation for asset params
    const idMatch = remaining.match(/^[A-Za-z_][A-Za-z0-9_.]*/);
    if (idMatch) {
      const id = idMatch[0];
      let type = "identifier";
      if (emissionParams.has(id)) type = "emission";
      else if (outputParams.has(id)) type = "output";
      else if (conversionFactors.has(id)) type = "conversion";
      tokens.push({ type, value: id });
      remaining = remaining.slice(id.length);
      continue;
    }

    // Fallback: take one character
    tokens.push({ type: "unknown", value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return (
    <code className="font-mono text-sm leading-relaxed">
      {tokens.map((token, i) => {
        switch (token.type) {
          case "operator":
            return (
              <span key={i} className="text-purple-600 font-semibold">
                {token.value}
              </span>
            );
          case "number":
            return (
              <span key={i} className="text-blue-600">
                {token.value}
              </span>
            );
          case "emission":
            return (
              <span
                key={i}
                className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs"
              >
                {token.value}
              </span>
            );
          case "output":
            return (
              <span
                key={i}
                className="bg-teal-100 text-teal-800 px-1 py-0.5 rounded text-xs"
              >
                {token.value}
              </span>
            );
          case "conversion":
            return (
              <span
                key={i}
                className="bg-violet-100 text-violet-800 px-1 py-0.5 rounded text-xs"
              >
                {token.value}
              </span>
            );
          case "identifier":
            return (
              <span key={i} className="text-slate-700">
                {token.value}
              </span>
            );
          default:
            return <span key={i}>{token.value}</span>;
        }
      })}
    </code>
  );
}

// Dependency flow visualization
function DependencyFlow({ formula }: { formula: Formula }) {
  const deps = formula.dependencies;
  const hasInputs =
    (deps?.emission_params?.length || 0) > 0 ||
    (deps?.conversion_factors?.length || 0) > 0;
  const hasOutputDeps = (deps?.output_params?.length || 0) > 0;

  if (!hasInputs && !hasOutputDeps) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Input parameters */}
      {hasInputs && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {deps?.emission_params?.slice(0, 3).map((p) => (
            <span
              key={p}
              className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200"
            >
              {p}
            </span>
          ))}
          {deps?.conversion_factors?.slice(0, 2).map((p) => (
            <span
              key={p}
              className="px-2 py-1 bg-violet-50 text-violet-700 text-xs rounded border border-violet-200"
            >
              {p}
            </span>
          ))}
          {((deps?.emission_params?.length || 0) > 3 ||
            (deps?.conversion_factors?.length || 0) > 2) && (
            <span className="text-xs text-slate-400">
              +
              {(deps?.emission_params?.length || 0) -
                3 +
                ((deps?.conversion_factors?.length || 0) - 2)}{" "}
              more
            </span>
          )}
        </div>
      )}

      {/* Arrow */}
      {hasInputs && (
        <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
      )}

      {/* Formula indicator */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded border border-slate-200">
        <Layers className="w-3 h-3 text-slate-500" />
        <span className="text-xs font-medium text-slate-600">Formula</span>
      </div>

      {/* Arrow to output */}
      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />

      {/* Output parameter */}
      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-200 font-medium">
        {formula.output_param}
      </span>

      {/* Output dependencies indicator */}
      {hasOutputDeps && (
        <>
          <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
          <span className="text-xs text-slate-400">
            feeds {deps?.output_params?.length} other formula
            {(deps?.output_params?.length || 0) > 1 ? "s" : ""}
          </span>
        </>
      )}
    </div>
  );
}

// Formula card component
function FormulaCard({ formula }: { formula: FormulaWithLevel }) {
  const config =
    STATUS_CONFIG[formula.status.toLowerCase()] || STATUS_CONFIG.draft;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">
            {formula.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            v{formula.version || 1} &middot; {formula.scope} &middot; Updated{" "}
            {formatDate(formula.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <Badge variant="outline" className={`gap-1 ${config.color}`}>
            {config.icon}
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Expression with syntax highlighting */}
      <div className="bg-slate-50 border border-slate-100 rounded-md p-3 mb-4 overflow-x-auto">
        <HighlightedExpression
          expression={formula.expression}
          dependencies={formula.dependencies}
        />
      </div>

      {/* Dependency flow visualization */}
      <DependencyFlow formula={formula} />

      {/* Description if present */}
      {formula.description && (
        <p className="text-sm text-slate-600 mt-4 pt-3 border-t border-slate-100">
          {formula.description}
        </p>
      )}

      {/* Legend for first-time understanding */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-slate-400">Input</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          <span className="text-[10px] text-slate-400">Factor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-400" />
          <span className="text-[10px] text-slate-400">Output Dep</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-slate-400">Result</span>
        </div>
      </div>
    </div>
  );
}

const LEVEL_LABELS: Record<number, { label: string; description: string }> = {
  0: {
    label: "Base Layer",
    description: "No formula dependencies - uses only raw input data",
  },
  1: { label: "Level 1", description: "Depends on base layer formulas" },
  2: { label: "Level 2", description: "Depends on level 1 formulas" },
  3: { label: "Level 3", description: "Depends on level 2 formulas" },
};

export function FormulaList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAppStore();

  // Fetch formulas
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["formulas", statusFilter, user?.plantId],
    queryFn: () =>
      formulasApi.list(
        statusFilter === "all" ? undefined : statusFilter,
        user?.plantId ?? undefined,
      ),
  });

  const formulas: Formula[] = data?.data || [];

  // Sort formulas by execution order and group by level
  const sortedFormulas = useMemo(() => getExecutionOrder(formulas), [formulas]);
  const groupedFormulas = useMemo(
    () => groupByLevel(sortedFormulas),
    [sortedFormulas],
  );
  const levels = Array.from(groupedFormulas.keys()).sort((a, b) => a - b);

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100/50 rounded-full">
              <Code2 className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-slate-700">
                Formula Library
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {formulas.length} formula{formulas.length !== 1 ? "s" : ""}{" "}
                &middot; Sorted by execution order
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-slate-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                  <SelectItem value="immutable">Immutable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Failed to load formulas. Please try again.
          </div>
        ) : formulas.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No formulas found. Create your first formula using the "Build
            Formula" tab.
          </div>
        ) : (
          <div className="space-y-8">
            {levels.map((level) => {
              const levelFormulas = groupedFormulas.get(level) || [];
              const levelInfo = LEVEL_LABELS[level] || {
                label: `Level ${level}`,
                description: `Depends on level ${level - 1} formulas`,
              };

              return (
                <div key={level}>
                  {/* Level header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-indigo-700">
                          {level}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          {levelInfo.label}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {levelInfo.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 border-t border-dashed border-slate-200" />
                    <Badge variant="secondary" className="text-xs">
                      {levelFormulas.length} formula
                      {levelFormulas.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Formulas in this level */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {levelFormulas.map((formula) => (
                      <FormulaCard key={formula.id} formula={formula} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
