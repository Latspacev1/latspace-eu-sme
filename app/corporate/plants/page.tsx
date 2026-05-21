"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SiteCard } from "@/components/shared/site-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Settings, Edit2, Plus } from "lucide-react";
import { AddEmissionSourceForm } from "@/components/forms/add-emission-source-form";
import { AddPlantDialog } from "@/components/dialogs/add-plant-dialog";
import { EmissionSourceFormData, Site } from "@/lib/types";
import { toast } from "sonner";
import { plantsApi } from "@/lib/api/plants";
import { organizationsApi } from "@/lib/api/organizations";
import { useAppStore } from "@/lib/store/useAppStore";

export default function SitesPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Site | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPlantDialogOpen, setAddPlantDialogOpen] = useState(false);

  // Fetch plants filtered by user's organization
  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ["sites", user?.orgId],
    queryFn: async () => {
      if (!user?.orgId) return [];
      const response = await plantsApi.getAll({
        organization_id: user.orgId,
      });
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    enabled: !!user?.orgId,
  });

  // Fetch organizations for company names
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await organizationsApi.getAll();
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
  });

  const companyMap =
    companies?.reduce(
      (acc, company) => {
        acc[company.id] = company.name;
        return acc;
      },
      {} as Record<string, string>,
    ) || {};

  const handleAddEmissionSource = () => {
    setShowAddForm(true);
  };

  const handleChangeEmissionSource = () => {
    toast.info("Change Existing Emission Source - Coming Soon");
    // TODO: Implement change emission source functionality
  };

  const handleFormSubmit = async (data: EmissionSourceFormData) => {
    try {
      // Note: Emission source API doesn't exist yet, using MSW mock
      const response = await fetch(
        `/api/sites/${selectedPlant?.id}/emission-sources`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) throw new Error("Failed to add emission source");

      toast.success(`Emission source added to ${selectedPlant?.name}`);
      setShowAddForm(false);
      setEditDialogOpen(false);
    } catch (error) {
      toast.error("Failed to add emission source");
      console.error(error);
    }
  };

  const handleFormCancel = () => {
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Main container */}
      <div className="container mx-auto px-12 py-16">
        {/* Page Header */}
        <div className="mb-12 flex items-start justify-between">
          <div className="max-w-2xl">
            <h1 className="text-[#0A0A0A] mb-4 text-5xl font-semibold tracking-tight">
              Plants
            </h1>
            <p className="text-[#0A0A0A]/60 text-base leading-relaxed">
              Overview of all manufacturing plants
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setAddPlantDialogOpen(true)}
              className="gap-2 bg-[#074D47] hover:bg-[#074D47]/90"
            >
              <Plus className="h-4 w-4" />
              Add Plant
            </Button>
            <Button
              variant={isConfiguring ? "default" : "outline"}
              onClick={() => setIsConfiguring(!isConfiguring)}
              className={`gap-2 ${isConfiguring ? "bg-[#074D47] hover:bg-[#074D47]/90" : ""}`}
            >
              <Settings className="h-4 w-4" />
              {isConfiguring ? "Done Configuring" : "Configure Plants"}
            </Button>
          </div>
        </div>

        {/* 3x2 Grid of Site Cards */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-[#0A0A0A]/5 animate-pulse rounded"
              />
            ))}
          </div>
        ) : sites && sites.length > 0 ? (
          <div className="grid grid-cols-3 gap-8">
            {sites.map((site) => (
              <div
                key={site.id}
                className="relative"
                onClick={() =>
                  !isConfiguring && router.push(`/corporate/plants/${site.id}`)
                }
              >
                <SiteCard
                  name={site.name}
                  region={site.region}
                  capacity="N/A"
                  type={site.sector}
                  manager="N/A"
                  updated="N/A"
                  companyName={companyMap[site.companyId]}
                />

                {/* Edit Icon - Only visible when configuring */}
                {isConfiguring && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlant(site);
                      setEditDialogOpen(true);
                    }}
                    className="absolute top-4 right-4 p-2 bg-white border border-[#0A0A0A]/20 rounded-md hover:bg-[#074D47] hover:text-white hover:border-[#074D47] transition-colors shadow-sm"
                    aria-label={`Edit ${site.name}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[#0A0A0A]/40">
            No plants found
          </div>
        )}

        {/* Edit Plant Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="text-2xl font-light">
                Edit {selectedPlant?.name}
              </DialogTitle>
              <DialogDescription>
                Configure emission sources for this plant
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 px-6">
              {!showAddForm ? (
                <div className="py-8 space-y-4">
                  <p className="text-sm text-[#0A0A0A]/60 mb-6">
                    Choose an action to configure emission sources for this
                    plant:
                  </p>

                  <div className="grid gap-4">
                    <Button
                      onClick={handleAddEmissionSource}
                      className="justify-start h-auto py-4 px-6 bg-white hover:bg-[#074D47]/5 text-[#0A0A0A] border border-[#0A0A0A]/20 hover:border-[#074D47] w-full"
                      variant="outline"
                    >
                      <div className="text-left w-full">
                        <div className="font-medium text-base mb-1">
                          Add Emission Source
                        </div>
                        <div className="text-sm text-[#0A0A0A]/60 font-normal whitespace-normal">
                          Configure a new emission source with methodology and
                          parameters
                        </div>
                      </div>
                    </Button>

                    <Button
                      onClick={handleChangeEmissionSource}
                      className="justify-start h-auto py-4 px-6 bg-white hover:bg-[#074D47]/5 text-[#0A0A0A] border border-[#0A0A0A]/20 hover:border-[#074D47] w-full"
                      variant="outline"
                    >
                      <div className="text-left w-full">
                        <div className="font-medium text-base mb-1">
                          Change Existing Emission Source
                        </div>
                        <div className="text-sm text-[#0A0A0A]/60 font-normal whitespace-normal">
                          Modify or update an existing emission source
                          configuration
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-6 pb-8">
                  <AddEmissionSourceForm
                    plantId={selectedPlant?.id || ""}
                    plantName={selectedPlant?.name || ""}
                    onSubmit={handleFormSubmit}
                    onCancel={handleFormCancel}
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Plant Dialog */}
        <AddPlantDialog
          open={addPlantDialogOpen}
          onOpenChange={setAddPlantDialogOpen}
          organizationId={user?.orgId || ""}
        />
      </div>
    </div>
  );
}
