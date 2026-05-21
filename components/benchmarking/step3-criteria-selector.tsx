"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CRITERION_LABELS, CriteriaSet } from "@/lib/api/benchmarking";

export const GHG_FOCUS_CRITERIA: string[] = [
  "ghg_scope1_2_disclosure",
  "ghg_scope3_disclosure",
  "ghg_methodology",
  "external_assurance",
  "net_zero_target",
  "sbti_alignment",
  "renewable_energy_pct",
];

export const DEFAULT_ESG_CRITERIA: string[] = [
  "ghg_scope1_2_disclosure",
  "ghg_scope3_disclosure",
  "ghg_methodology",
  "external_assurance",
  "net_zero_target",
  "sbti_alignment",
  "renewable_energy_pct",
  "climate_risk_assessment",
  "internal_carbon_price",
  "carbon_offsets_recs",
  "digital_ghg_platform",
  "gresb_score",
  "cdp_disclosure",
  "green_building_certs",
  "esg_report_published",
  "board_esg_oversight",
  "supplier_esg_screening",
  "esg_investment_criteria",
  "integrated_reporting",
];


export interface Step3Data {
  /** Narrowed to CriteriaSet before API submission; "" when unset. */
  criteriaSet: string;
  customCriteria: string[];
}

interface Step3CriteriaProps {
  data: Step3Data;
  onChange: (data: Step3Data) => void;
}

const PRESET_OPTIONS: {
  value: CriteriaSet;
  label: string;
  description: string;
  count: number;
}[] = [
  {
    value: "default_esg",
    label: "Default ESG",
    description: "Comprehensive ESG coverage",
    count: 20,
  },
  {
    value: "ghg_focus",
    label: "GHG Focus",
    description: "Greenhouse gas metrics only",
    count: 7,
  },
  {
    value: "custom",
    label: "Custom",
    description: "Choose individual criteria",
    count: 0,
  },
];

export function Step3CriteriaSelector({ data, onChange }: Step3CriteriaProps) {
  const toggleCustomCriteria = (criterion: string) => {
    const next = data.customCriteria.includes(criterion)
      ? data.customCriteria.filter((c) => c !== criterion)
      : [...data.customCriteria, criterion];
    onChange({ ...data, customCriteria: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#0A0A0A] mb-1">
          Criteria Set
        </h2>
        <p className="text-sm text-[#0A0A0A]/60">
          Choose which ESG criteria to score peers against.
        </p>
      </div>

      <RadioGroup
        value={data.criteriaSet}
        onValueChange={(value) =>
          onChange({ ...data, criteriaSet: value })
        }
        className="space-y-3"
      >
        {PRESET_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            htmlFor={`criteria-${opt.value}`}
            className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
              data.criteriaSet === opt.value
                ? "border-[#074D47] bg-[#074D47]/5"
                : "border-[#0A0A0A]/15 hover:border-[#074D47]/40"
            }`}
          >
            <RadioGroupItem
              value={opt.value}
              id={`criteria-${opt.value}`}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#0A0A0A]">{opt.label}</span>
                {opt.count > 0 && (
                  <span className="text-xs text-[#0A0A0A]/40 bg-[#0A0A0A]/5 px-2 py-0.5 rounded-full">
                    {opt.count} criteria
                  </span>
                )}
              </div>
              <p className="text-sm text-[#0A0A0A]/50 mt-0.5">
                {opt.description}
              </p>
            </div>
          </label>
        ))}
      </RadioGroup>

      {/* Custom criteria checklist */}
      {data.criteriaSet === "custom" && (
        <div className="border border-[#0A0A0A]/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#0A0A0A]">
              Select Criteria
            </p>
            <span className="text-xs text-[#074D47]">
              {data.customCriteria.length} selected
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {DEFAULT_ESG_CRITERIA.map((criterion) => (
              <div
                key={criterion}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Checkbox
                  id={criterion}
                  checked={data.customCriteria.includes(criterion)}
                  onCheckedChange={() => toggleCustomCriteria(criterion)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label
                  htmlFor={criterion}
                  className="text-xs text-[#0A0A0A]/70 cursor-pointer group-hover:text-[#0A0A0A] transition-colors"
                >
                  {CRITERION_LABELS[criterion] ?? criterion}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
