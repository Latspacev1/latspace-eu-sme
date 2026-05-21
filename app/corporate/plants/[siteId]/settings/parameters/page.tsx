"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store/useAppStore";
import { plantsApi } from "@/lib/api/plants";
import {
  parametersApi,
  ParamCategory,
  DynamicParameter,
} from "@/lib/api/parameters";
import {
  Settings,
  Search,
  ArrowLeft,
  Loader2,
  Link2,
  Unlink2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function PlantParametersSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ParamCategory>(
    ParamCategory.INPUT,
  );

  const isCorpHead = user?.role === "CorporateHead";

  // 1. Fetch Plant Details (to get org_id)
  const { data: plant, isLoading: plantLoading } = useQuery({
    queryKey: ["plant", siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await plantsApi.getRawById(siteId);
      return response.success ? response.data : null;
    },
    enabled: !!siteId,
  });

  // 2. Fetch All available parameters for the organization
  const { data: allParams, isLoading: allParamsLoading } = useQuery({
    queryKey: ["org-parameters", plant?.organization_id, activeCategory],
    queryFn: async () => {
      if (!plant?.organization_id) return [];
      const response = await parametersApi.getAll({
        org_id: plant.organization_id,
        category: activeCategory,
      });
      return response.success ? response.data || [] : [];
    },
    enabled: !!plant?.organization_id,
  });

  // 3. Fetch current plant parameters (for linkage status)
  const { data: linkedParams, isLoading: linkedLoading } = useQuery({
    queryKey: ["plant-parameters", siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await plantsApi.getParameters(siteId);
      return response.success ? response.data : null;
    },
    enabled: !!siteId,
  });

  const linkedIds = useMemo(() => {
    if (!linkedParams) return new Set<string>();
    const ids = new Set<string>();
    linkedParams.emission_params.forEach((p) => ids.add(p.id));
    linkedParams.output_params.forEach((p) => ids.add(p.id));
    return ids;
  }, [linkedParams]);

  // Link Mutation
  const linkMutation = useMutation({
    mutationFn: ({
      paramId,
      category,
    }: {
      paramId: string;
      category: ParamCategory;
    }) => parametersApi.linkToPlant(paramId, siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant-parameters", siteId] });
      toast.success("Parameter linked successfully");
    },
    onError: (error) => toast.error("Failed to link parameter"),
  });

  // Unlink Mutation
  const unlinkMutation = useMutation({
    mutationFn: ({
      paramId,
      category,
    }: {
      paramId: string;
      category: ParamCategory;
    }) => parametersApi.unlinkFromPlant(paramId, siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant-parameters", siteId] });
      toast.success("Parameter unlinked successfully");
    },
    onError: (error) => toast.error("Failed to unlink parameter"),
  });

  const handleToggleLink = (
    paramId: string,
    category: ParamCategory,
    isLinked: boolean,
  ) => {
    if (isLinked) {
      unlinkMutation.mutate({ paramId, category });
    } else {
      linkMutation.mutate({ paramId, category });
    }
  };

  const filteredParams = useMemo(() => {
    if (!allParams) return [];
    return allParams.filter(
      (p) =>
        p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.section?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [allParams, searchQuery]);

  if (plantLoading || allParamsLoading || linkedLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading configuration...</span>
      </div>
    );
  }

  if (!isCorpHead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-red-500">
          Access denied. Corporate Head role required.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-12 py-8">
        <Link
          href={`/corporate/plants/${siteId}/settings`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Plant Settings
        </Link>

        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-gray-700" />
              <h1 className="text-3xl font-bold text-[#0A0A0A] tracking-tight">
                Parameter Management
              </h1>
            </div>
            <p className="text-gray-600">
              Configure which measurement parameters are active for{" "}
              <span className="font-semibold">{plant?.name}</span>
            </p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <Button
              variant={
                activeCategory === ParamCategory.INPUT ? "secondary" : "ghost"
              }
              size="sm"
              onClick={() => setActiveCategory(ParamCategory.INPUT)}
              className="px-6"
            >
              Input Params
            </Button>
            <Button
              variant={
                activeCategory === ParamCategory.OUTPUT ? "secondary" : "ghost"
              }
              size="sm"
              onClick={() => setActiveCategory(ParamCategory.OUTPUT)}
              className="px-6"
            >
              Output Params
            </Button>
          </div>
        </div>

        <Card className="border-gray-200 mb-8">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">Organization Parameters</CardTitle>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search parameters..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {filteredParams.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Info className="h-10 w-10 mx-auto mb-4 opacity-20" />
                  <p>No parameters found matching your criteria</p>
                </div>
              ) : (
                filteredParams.map((param) => {
                  const isLinked = linkedIds.has(param.id);
                  const isPending =
                    linkMutation.isPending || unlinkMutation.isPending;

                  return (
                    <div
                      key={param.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            isLinked
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-400",
                          )}
                        >
                          {isLinked ? (
                            <Link2 className="h-5 w-5" />
                          ) : (
                            <Unlink2 className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {param.display_name}
                            </h4>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono"
                            >
                              {param.unit}
                            </Badge>
                            {param.is_calculated && (
                              <Badge className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 text-[10px]">
                                Formula
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">
                              {param.name}
                            </span>
                            <span className="text-xs text-gray-300">|</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {param.section || "General"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right mr-4">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isLinked ? "text-green-600" : "text-gray-400",
                            )}
                          >
                            {isLinked ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <Switch
                          checked={isLinked}
                          onCheckedChange={() =>
                            handleToggleLink(param.id, activeCategory, isLinked)
                          }
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">Impact on Operations</p>
            <p>
              Enabled parameters will immediately appear in the **Manual Data
              Entry** page for this plant and will be available for **Matrix
              Sheet Upload** validation. Disabling a parameter will hide it from
              entry forms but will not delete existing historical data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
