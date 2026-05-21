"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  plantOnboardingApi,
  PlantOnboardingResult,
} from "@/lib/api/plant-onboarding";
import {
  CCTSOnboardingEntity,
  TargetYear,
  parseBaselineYear,
  getTargetYearOptions,
  searchByRegistrationNumber,
  findByRegistrationNumber,
} from "@/lib/types/ccts-onboarding";
import {
  Building2,
  User,
  Mail,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Search,
  Target,
  BarChart3,
  FileText,
} from "lucide-react";

interface AddPlantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

type Step =
  | "registration-lookup"
  | "plant-details"
  | "manager-credentials"
  | "success";

export function AddPlantDialog({
  open,
  onOpenChange,
  organizationId,
}: AddPlantDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("registration-lookup");
  const [createManager, setCreateManager] = useState(true);
  const [result, setResult] = useState<PlantOnboardingResult | null>(null);

  // Registration lookup state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] =
    useState<CCTSOnboardingEntity | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);

  // Form state
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [plantName, setPlantName] = useState("");
  const [plantDescription, setPlantDescription] = useState("");
  const [plantAddress, setPlantAddress] = useState("");
  const [sector, setSector] = useState("");
  const [subSector, setSubSector] = useState("");

  // Baseline state (decoupled from DB)
  const [baselineYear, setBaselineYear] = useState<string>("");
  const [baselineGei, setBaselineGei] = useState<string>("");
  const [baselineProductOutput, setBaselineProductOutput] =
    useState<string>("");

  // Target state (single selection)
  const [selectedTargetYear, setSelectedTargetYear] = useState<TargetYear | "">(
    "",
  );
  const [targetGei, setTargetGei] = useState<string>("");

  // Manager state
  const [managerUsername, setManagerUsername] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  // Fetch CCTS onboarding data
  const { data: cctsEntities = [] } = useQuery<CCTSOnboardingEntity[]>({
    queryKey: ["ccts-onboarding-data"],
    queryFn: async () => {
      const response = await fetch("/CCTS_GEI_ONBOARDING.json");
      if (!response.ok) {
        throw new Error("Failed to load CCTS onboarding data");
      }
      return response.json();
    },
    staleTime: Infinity, // Data doesn't change
  });

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    return searchByRegistrationNumber(cctsEntities, searchQuery).slice(0, 10);
  }, [cctsEntities, searchQuery]);

  // Target year options based on selected entity
  const targetYearOptions = useMemo(() => {
    if (!selectedEntity) return [];
    return getTargetYearOptions(selectedEntity);
  }, [selectedEntity]);

  // Update target GEI when target year changes
  useEffect(() => {
    if (selectedEntity && selectedTargetYear) {
      const option = targetYearOptions.find(
        (o) => o.value === selectedTargetYear,
      );
      if (option && option.geiValue !== null) {
        setTargetGei(option.geiValue.toString());
      }
    }
  }, [selectedEntity, selectedTargetYear, targetYearOptions]);

  const onboardMutation = useMutation({
    mutationFn: plantOnboardingApi.onboardPlant,
    onSuccess: (response) => {
      if (response.success && response.data) {
        setResult(response.data);
        setStep("success");
        queryClient.invalidateQueries({ queryKey: ["sites"] });
        toast.success("Plant onboarded successfully!");
      } else {
        toast.error(response.message || "Failed to onboard plant");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to onboard plant");
    },
  });

  const handleSelectEntity = (entity: CCTSOnboardingEntity) => {
    setSelectedEntity(entity);
    setRegistrationNumber(entity.obligated_entity_registration_number);
    setPlantName(entity.obligated_entity_name);
    setPlantAddress(entity.address);
    setSector(entity.sector);
    setSubSector(entity.sub_sector);
    setBaselineYear(
      parseBaselineYear(entity.confirmation_of_baseline_year).toString(),
    );
    setBaselineGei(entity.baseline_gei_tco2e_per_tonne.toString());
    setBaselineProductOutput(entity.baseline_product_output_tonne.toString());
    setSearchQuery("");

    // Auto-select first target year if available
    const options = getTargetYearOptions(entity);
    if (options.length > 0) {
      setSelectedTargetYear(options[0].value);
      if (options[0].geiValue !== null) {
        setTargetGei(options[0].geiValue.toString());
      }
    }

    setStep("plant-details");
  };

  const handleManualEntry = () => {
    setIsManualEntry(true);
    setSelectedEntity(null);
    setStep("plant-details");
  };

  const handleSubmit = () => {
    if (step === "registration-lookup") {
      // Should not happen, but handle gracefully
      setStep("plant-details");
      return;
    }

    if (step === "plant-details") {
      if (!plantName.trim()) {
        toast.error("Plant name is required");
        return;
      }
      if (!organizationId) {
        toast.error("Organization ID is missing. Please re-login.");
        return;
      }
      if (!baselineYear || !baselineGei) {
        toast.error("Baseline year and GEI are required");
        return;
      }
      if (!selectedTargetYear || !targetGei) {
        toast.error("Please select a target year and GEI value");
        return;
      }

      if (createManager) {
        setStep("manager-credentials");
      } else {
        // Submit without manager
        submitOnboarding();
      }
    } else if (step === "manager-credentials") {
      if (!managerEmail.trim()) {
        toast.error("Manager email is required");
        return;
      }
      submitOnboarding();
    }
  };

  const submitOnboarding = () => {
    // Parse target year to number (25-26 -> 2025, 26-27 -> 2026)
    const targetYearNum = selectedTargetYear === "25-26" ? 2025 : 2026;

    onboardMutation.mutate({
      plant_name: plantName,
      plant_description: plantDescription,
      plant_address: plantAddress,
      organization_id: organizationId,
      registration_number: registrationNumber || undefined,
      sector: sector || undefined,
      sub_sector: subSector || undefined,
      baseline_year: parseInt(baselineYear),
      baseline_gei: parseFloat(baselineGei),
      baseline_product_output: baselineProductOutput
        ? parseFloat(baselineProductOutput)
        : undefined,
      target_year: targetYearNum,
      target_gei: parseFloat(targetGei),
      manager_email: createManager ? managerEmail : undefined,
      manager_username: createManager
        ? managerUsername || undefined
        : undefined,
    });
  };

  const handleClose = () => {
    // Reset form state
    setStep("registration-lookup");
    setSearchQuery("");
    setSelectedEntity(null);
    setIsManualEntry(false);
    setRegistrationNumber("");
    setPlantName("");
    setPlantDescription("");
    setPlantAddress("");
    setSector("");
    setSubSector("");
    setBaselineYear("");
    setBaselineGei("");
    setBaselineProductOutput("");
    setSelectedTargetYear("");
    setTargetGei("");
    setManagerUsername("");
    setManagerEmail("");
    setCreateManager(true);
    setResult(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === "plant-details") {
      if (isManualEntry) {
        setIsManualEntry(false);
      }
      setStep("registration-lookup");
    } else if (step === "manager-credentials") {
      setStep("plant-details");
    }
  };

  const downloadCredentials = () => {
    if (!result?.credentials?.password) return;

    const credentials = result.credentials;
    const content = `========================================
PLANT MANAGER LOGIN CREDENTIALS
========================================

Plant Name: ${result.plant.name}
Registration: ${registrationNumber || "N/A"}
Created: ${new Date().toLocaleString()}

----------------------------------------
LOGIN DETAILS
----------------------------------------

Email: ${credentials.email}
Username: ${credentials.username}
Temporary Password: ${credentials.password}

----------------------------------------
PLANT CONFIGURATION
----------------------------------------

Baseline Year: FY ${baselineYear}-${(parseInt(baselineYear) + 1).toString().slice(-2)}
Baseline GEI: ${baselineGei} tCO₂e/ton
Target Year: FY 20${selectedTargetYear}
Target GEI: ${targetGei} tCO₂e/ton

----------------------------------------
IMPORTANT
----------------------------------------

• Please share these credentials securely
• The plant manager should change their
  password after first login
• Keep this file in a secure location

========================================
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.plant.name.replace(/[^a-zA-Z0-9]/g, "_")}_credentials.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Credentials downloaded!");
  };

  const renderRegistrationLookupStep = () => (
    <div className="space-y-6">
      <div className="bg-[#074D47]/5 border border-[#074D47]/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Search className="h-5 w-5 text-[#074D47] mt-0.5" />
          <div>
            <h4 className="font-medium text-[#074D47]">
              CCTS Registration Lookup
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Search by registration number or entity name to auto-populate
              plant data from CCTS database.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="search-registration"
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4 text-[#074D47]" />
            Registration Number / Entity Name
          </Label>
          <Input
            id="search-registration"
            placeholder="e.g., CMTOE001KA or JK Cement"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-base"
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {searchResults.map((entity) => (
              <button
                key={entity.obligated_entity_registration_number}
                onClick={() => handleSelectEntity(entity)}
                className="w-full text-left px-4 py-3 hover:bg-[#074D47]/5 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {entity.obligated_entity_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {entity.obligated_entity_registration_number} •{" "}
                      {entity.address}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-[#074D47] font-medium">
                      {entity.sector}
                    </div>
                    <div className="text-gray-500">{entity.sub_sector}</div>
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>
                    Baseline GEI:{" "}
                    <span className="font-medium text-gray-700">
                      {entity.baseline_gei_tco2e_per_tonne.toFixed(4)}
                    </span>
                  </span>
                  {entity.annual_gei_targets_25_26[0] && (
                    <span>
                      Target 25-26:{" "}
                      <span className="font-medium text-gray-700">
                        {entity.annual_gei_targets_25_26[0].toFixed(4)}
                      </span>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-6 text-gray-500 border border-dashed border-gray-300 rounded-lg">
            <p>No matching entities found.</p>
            <p className="text-sm mt-1">
              Try a different search term or enter data manually.
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={handleManualEntry}
          className="w-full justify-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          Enter Plant Details Manually
        </Button>
      </div>
    </div>
  );

  const renderPlantDetailsStep = () => (
    <div className="space-y-6">
      {/* Selected Entity Banner */}
      {selectedEntity && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              Data populated from CCTS:{" "}
              {selectedEntity.obligated_entity_registration_number}
            </span>
          </div>
        </div>
      )}

      {/* Plant Details Section */}
      <div className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registration-number">Registration Number</Label>
            <Input
              id="registration-number"
              placeholder="e.g., CMTOE001KA"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              disabled={!!selectedEntity}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <Input
                id="sector"
                placeholder="e.g., Cement"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                disabled={!!selectedEntity}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subsector">Subsector</Label>
              <Input
                id="subsector"
                placeholder="e.g., Grey Cement"
                value={subSector}
                onChange={(e) => setSubSector(e.target.value)}
                disabled={!!selectedEntity}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plant-name" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#074D47]" />
            Plant Name *
          </Label>
          <Input
            id="plant-name"
            placeholder="e.g., Mumbai Manufacturing Plant"
            value={plantName}
            onChange={(e) => setPlantName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="plant-address">Address</Label>
          <Input
            id="plant-address"
            placeholder="Plant location/address"
            value={plantAddress}
            onChange={(e) => setPlantAddress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="plant-description">Description</Label>
          <Input
            id="plant-description"
            placeholder="Brief description of the plant"
            value={plantDescription}
            onChange={(e) => setPlantDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Baseline Configuration */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-[#074D47]" />
          <h4 className="font-medium text-gray-900">Baseline Configuration</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="baseline-year">Baseline Year *</Label>
            <Input
              id="baseline-year"
              type="number"
              placeholder="e.g., 2023"
              value={baselineYear}
              onChange={(e) => setBaselineYear(e.target.value)}
              min={2015}
              max={2030}
            />
            {baselineYear && (
              <p className="text-xs text-gray-500">
                FY {baselineYear}-
                {(parseInt(baselineYear) + 1).toString().slice(-2)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseline-gei">Baseline GEI (tCO₂e/ton) *</Label>
            <Input
              id="baseline-gei"
              type="number"
              step="0.0001"
              placeholder="e.g., 0.4455"
              value={baselineGei}
              onChange={(e) => setBaselineGei(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="space-y-2">
            <Label htmlFor="baseline-output">
              Baseline Production (tonnes)
            </Label>
            <Input
              id="baseline-output"
              type="number"
              placeholder="e.g., 3532948"
              value={baselineProductOutput}
              onChange={(e) => setBaselineProductOutput(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Target Configuration */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-[#074D47]" />
          <h4 className="font-medium text-gray-900">Target Configuration</h4>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-year">Target Year *</Label>
            {selectedEntity && targetYearOptions.length > 0 ? (
              <Select
                value={selectedTargetYear}
                onValueChange={(value) =>
                  setSelectedTargetYear(value as TargetYear)
                }
              >
                <SelectTrigger id="target-year">
                  <SelectValue placeholder="Select target year" />
                </SelectTrigger>
                <SelectContent>
                  {targetYearOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} (GEI: {option.geiValue?.toFixed(4)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={selectedTargetYear}
                onValueChange={(value) =>
                  setSelectedTargetYear(value as TargetYear)
                }
              >
                <SelectTrigger id="target-year">
                  <SelectValue placeholder="Select target year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25-26">FY 2025-26</SelectItem>
                  <SelectItem value="26-27">FY 2026-27</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-gei">Target GEI (tCO₂e/ton) *</Label>
            <Input
              id="target-gei"
              type="number"
              step="0.0001"
              placeholder="e.g., 0.4417"
              value={targetGei}
              onChange={(e) => setTargetGei(e.target.value)}
              disabled={!!selectedEntity && !!selectedTargetYear}
            />
            {selectedEntity && selectedTargetYear && (
              <p className="text-xs text-green-600">
                Auto-populated from CCTS data
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Manager Checkbox */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="create-manager"
            checked={createManager}
            onCheckedChange={(checked) => setCreateManager(checked as boolean)}
          />
          <div className="space-y-1">
            <label
              htmlFor="create-manager"
              className="text-sm font-medium cursor-pointer"
            >
              Create Plant Manager credentials
            </label>
            <p className="text-xs text-gray-500">
              Create login credentials for a plant manager to access and
              populate data for this plant
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderManagerCredentialsStep = () => (
    <div className="space-y-6">
      <div className="bg-[#074D47]/5 border border-[#074D47]/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-[#074D47] mt-0.5" />
          <div>
            <h4 className="font-medium text-[#074D47]">
              Plant Manager Account
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Create credentials for the plant manager of{" "}
              <span className="font-medium">{plantName}</span>. A temporary
              password will be generated that you can share securely.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="manager-email" className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#074D47]" />
            Manager Email *
          </Label>
          <Input
            id="manager-email"
            type="email"
            placeholder="manager@company.com"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manager-username" className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#074D47]" />
            Username (optional)
          </Label>
          <Input
            id="manager-username"
            placeholder="Will use email prefix if not provided"
            value={managerUsername}
            onChange={(e) => setManagerUsername(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        A secure temporary password will be automatically generated. You&apos;ll
        be able to copy and share the credentials after creation.
      </p>
    </div>
  );

  const renderSuccessStep = () => {
    const credentials = result?.credentials;

    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Plant Onboarded Successfully!
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {result?.plant.name} has been created and configured
          </p>
        </div>

        {/* Configuration Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">
            Configuration Summary
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Registration:</span>
              <span className="ml-2 font-medium">
                {registrationNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Sector:</span>
              <span className="ml-2 font-medium">{sector || "N/A"}</span>
            </div>
            <div>
              <span className="text-gray-500">Baseline Year:</span>
              <span className="ml-2 font-medium">
                FY {baselineYear}-
                {(parseInt(baselineYear) + 1).toString().slice(-2)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Baseline GEI:</span>
              <span className="ml-2 font-medium">
                {parseFloat(baselineGei).toFixed(4)} tCO₂e/ton
              </span>
            </div>
            <div>
              <span className="text-gray-500">Target Year:</span>
              <span className="ml-2 font-medium">
                FY 20{selectedTargetYear}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Target GEI:</span>
              <span className="ml-2 font-medium">
                {parseFloat(targetGei).toFixed(4)} tCO₂e/ton
              </span>
            </div>
          </div>
        </div>

        {credentials && credentials.password && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-800">
                  Plant Manager Credentials
                </h4>
                <p className="text-sm text-amber-700 mt-1 mb-4">
                  Share these credentials securely with the plant manager. The
                  password will only be shown once.
                </p>

                <div className="space-y-2 bg-white rounded-md p-3 border border-amber-200 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium">{credentials.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Password:</span>
                    <span className="font-medium">{credentials.password}</span>
                  </div>
                </div>

                <Button
                  onClick={downloadCredentials}
                  className="mt-3 w-full bg-[#074D47] hover:bg-[#074D47]/90"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Credentials File
                </Button>

                <p className="text-xs text-amber-700 mt-2 text-center">
                  Download and share this file securely with the plant manager
                </p>
              </div>
            </div>
          </div>
        )}

        {credentials &&
          !credentials.password &&
          credentials.is_existing_user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800">
                    Existing User Assigned
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    {credentials.email} was already registered and has been
                    assigned to this plant.
                  </p>
                </div>
              </div>
            </div>
          )}

        {!credentials && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 text-center">
              No plant manager credentials were created. You can add them later
              from the plant settings.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "registration-lookup" && "Add New Plant"}
            {step === "plant-details" && "Plant Configuration"}
            {step === "manager-credentials" && "Plant Manager Credentials"}
            {step === "success" && "Onboarding Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "registration-lookup" &&
              "Search for existing CCTS registration or enter details manually"}
            {step === "plant-details" &&
              "Configure baseline and target GEI values"}
            {step === "manager-credentials" &&
              "Create login credentials for the plant manager"}
            {step === "success" &&
              "The plant has been created and configured successfully"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "registration-lookup" && renderRegistrationLookupStep()}
          {step === "plant-details" && renderPlantDetailsStep()}
          {step === "manager-credentials" && renderManagerCredentialsStep()}
          {step === "success" && renderSuccessStep()}
        </div>

        <DialogFooter className="gap-2">
          {step === "registration-lookup" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "plant-details" && (
            <>
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={onboardMutation.isPending}
                className="bg-[#074D47] hover:bg-[#074D47]/90"
              >
                {createManager ? (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : onboardMutation.isPending ? (
                  "Creating..."
                ) : (
                  "Create Plant"
                )}
              </Button>
            </>
          )}

          {step === "manager-credentials" && (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={onboardMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={onboardMutation.isPending}
                className="bg-[#074D47] hover:bg-[#074D47]/90"
              >
                {onboardMutation.isPending
                  ? "Creating..."
                  : "Create Plant & Credentials"}
              </Button>
            </>
          )}

          {step === "success" && (
            <Button
              onClick={handleClose}
              className="bg-[#074D47] hover:bg-[#074D47]/90 w-full"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
