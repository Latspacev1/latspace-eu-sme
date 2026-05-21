"use client";

import { useState } from "react";
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
import {
  EmissionSourceFormData,
  GasType,
  InputParameter,
  Methodology,
  EmissionType,
  EmissionTypeCategory,
  EmissionFactorSource,
  EmissionsAdjusted,
} from "@/lib/types";

interface AddEmissionSourceFormProps {
  plantId: string;
  plantName: string;
  onSubmit: (data: EmissionSourceFormData) => void;
  onCancel: () => void;
}

export function AddEmissionSourceForm({
  plantId,
  plantName,
  onSubmit,
  onCancel,
}: AddEmissionSourceFormProps) {
  const [formData, setFormData] = useState<EmissionSourceFormData>({
    name: "",
    gases: [],
    inputParameter: "Clinker Production",
    methodology: "Standard Methodology",
    emissionsAdjusted: [],
  });

  const handleGasToggle = (gas: GasType) => {
    setFormData((prev) => ({
      ...prev,
      gases: prev.gases.includes(gas)
        ? prev.gases.filter((g) => g !== gas)
        : [...prev.gases, gas],
    }));
  };

  const handleEmissionsAdjustedToggle = (adjusted: EmissionsAdjusted) => {
    setFormData((prev) => ({
      ...prev,
      emissionsAdjusted: prev.emissionsAdjusted?.includes(adjusted)
        ? prev.emissionsAdjusted.filter((a) => a !== adjusted)
        : [...(prev.emissionsAdjusted || []), adjusted],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const showStandardMethodologyFields =
    formData.methodology === "Standard Methodology";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name of Emission Source */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium text-[#0A0A0A]">
          Name of Emission Source
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Enter emission source name"
          required
          className="border-[#0A0A0A]/20"
        />
      </div>

      {/* Choose Gases */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-[#0A0A0A]">
          Choose Gases
        </Label>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="co2"
              checked={formData.gases.includes("CO2")}
              onCheckedChange={() => handleGasToggle("CO2")}
            />
            <Label htmlFor="co2" className="text-sm cursor-pointer">
              CO2
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="pfcs"
              checked={formData.gases.includes("PFCs")}
              onCheckedChange={() => handleGasToggle("PFCs")}
            />
            <Label htmlFor="pfcs" className="text-sm cursor-pointer">
              PFCs
            </Label>
          </div>
        </div>
      </div>

      {/* Choose Input Parameter */}
      <div className="space-y-2">
        <Label
          htmlFor="inputParameter"
          className="text-sm font-medium text-[#0A0A0A]"
        >
          Choose Input Parameter
        </Label>
        <Select
          value={formData.inputParameter}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              inputParameter: value as InputParameter,
            }))
          }
        >
          <SelectTrigger className="border-[#0A0A0A]/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Clinker Production">
              Clinker Production
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Choose Methodology */}
      <div className="space-y-2">
        <Label
          htmlFor="methodology"
          className="text-sm font-medium text-[#0A0A0A]"
        >
          Choose Methodology
        </Label>
        <Select
          value={formData.methodology}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              methodology: value as Methodology,
              // Reset conditional fields when methodology changes
              emissionType: undefined,
              emissionTypeCategory: undefined,
              emissionFactorSource: undefined,
            }))
          }
        >
          <SelectTrigger className="border-[#0A0A0A]/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Standard Methodology">
              Standard Methodology
            </SelectItem>
            <SelectItem value="Mass Balance Method">
              Mass Balance Method
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditional Fields - Only show if Standard Methodology */}
      {showStandardMethodologyFields && (
        <div className="space-y-6 pt-4 border-t border-[#0A0A0A]/10">
          {/* Choose Emission Type */}
          <div className="space-y-2">
            <Label
              htmlFor="emissionType"
              className="text-sm font-medium text-[#0A0A0A]"
            >
              Choose Emission Type
            </Label>
            <Select
              value={formData.emissionType}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  emissionType: value as EmissionType,
                  emissionTypeCategory: undefined, // Reset when emission type changes
                }))
              }
            >
              <SelectTrigger className="border-[#0A0A0A]/20">
                <SelectValue placeholder="Select emission type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Direct Emission">Direct Emission</SelectItem>
                <SelectItem value="Indirect Emission">
                  Indirect Emission
                </SelectItem>
                <SelectItem value="Process Emission">
                  Process Emission
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Choose Type I or Type II */}
          {formData.emissionType && (
            <div className="space-y-2">
              <Label
                htmlFor="emissionTypeCategory"
                className="text-sm font-medium text-[#0A0A0A]"
              >
                Choose Type
              </Label>
              <Select
                value={formData.emissionTypeCategory}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    emissionTypeCategory: value as EmissionTypeCategory,
                  }))
                }
              >
                <SelectTrigger className="border-[#0A0A0A]/20">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Type I">Type I</SelectItem>
                  <SelectItem value="Type II">Type II</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Emission Factor Source */}
          {formData.emissionTypeCategory && (
            <div className="space-y-2">
              <Label
                htmlFor="emissionFactorSource"
                className="text-sm font-medium text-[#0A0A0A]"
              >
                Emission Factor Source
              </Label>
              <Select
                value={formData.emissionFactorSource}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    emissionFactorSource: value as EmissionFactorSource,
                  }))
                }
              >
                <SelectTrigger className="border-[#0A0A0A]/20">
                  <SelectValue placeholder="Select emission factor source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IPCC">IPCC</SelectItem>
                  <SelectItem value="DEFRA">DEFRA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Choose Emissions Adjusted */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-[#0A0A0A]">
              Choose Emissions Adjusted
            </Label>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ccus"
                  checked={formData.emissionsAdjusted?.includes("CCUS")}
                  onCheckedChange={() => handleEmissionsAdjustedToggle("CCUS")}
                />
                <Label htmlFor="ccus" className="text-sm cursor-pointer">
                  CCUS
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exportedElectricity"
                  checked={formData.emissionsAdjusted?.includes(
                    "Exported Electricity",
                  )}
                  onCheckedChange={() =>
                    handleEmissionsAdjustedToggle("Exported Electricity")
                  }
                />
                <Label
                  htmlFor="exportedElectricity"
                  className="text-sm cursor-pointer"
                >
                  Exported Electricity
                </Label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[#0A0A0A]/10">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-[#0A0A0A]/20"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-[#074D47] hover:bg-[#074D47]/90 text-white"
        >
          Add Emission Source
        </Button>
      </div>
    </form>
  );
}
