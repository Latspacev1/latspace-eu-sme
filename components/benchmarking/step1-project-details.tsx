"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BenchmarkingSegment } from "@/lib/api/benchmarking";

const SEGMENTS: { value: BenchmarkingSegment; label: string }[] = [
  { value: "real_estate", label: "Real Estate" },
  { value: "cement", label: "Cement" },
  { value: "hospitality", label: "Hospitality" },
  { value: "custom", label: "Custom" },
];

export interface Step1Data {
  name: string;
  /** Narrowed to BenchmarkingSegment before API submission; "" when unset. */
  segment: string;
}

interface Step1ProjectDetailsProps {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
}

export function Step1ProjectDetails({ data, onChange }: Step1ProjectDetailsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#0A0A0A] mb-1">
          Project Details
        </h2>
        <p className="text-sm text-[#0A0A0A]/60">
          Name your project and choose the industry segment for peer comparison.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project name */}
        <div className="space-y-2">
          <Label htmlFor="project-name" className="text-sm font-medium">
            Project Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="project-name"
            placeholder="e.g. FY2025 Peer ESG Benchmarking"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            className="border-[#0A0A0A]/20"
          />
        </div>

        {/* Segment */}
        <div className="space-y-2">
          <Label htmlFor="segment" className="text-sm font-medium">
            Industry Segment <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.segment}
            onValueChange={(value) =>
            onChange({ ...data, segment: value })
            }
          >
            <SelectTrigger id="segment" className="border-[#0A0A0A]/20">
              <SelectValue placeholder="Select segment" />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
