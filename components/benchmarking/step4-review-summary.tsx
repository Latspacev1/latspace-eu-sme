import { Badge } from "@/components/ui/badge";
import { CustomPeer, SelectedPeer } from "./step2-peer-picker";
import {
  DEFAULT_ESG_CRITERIA,
  GHG_FOCUS_CRITERIA,
} from "./step3-criteria-selector";

const SEGMENT_LABELS: Record<string, string> = {
  real_estate: "Real Estate",
  cement: "Cement",
  hospitality: "Hospitality",
  custom: "Custom",
};

const CRITERIA_LABELS: Record<string, string> = {
  default_esg: "Default ESG (20 criteria)",
  ghg_focus: "GHG Focus (7 criteria)",
  custom: "Custom",
};

interface ReviewSummaryProps {
  name: string;
  segment: string;
  selectedPeers: SelectedPeer[];
  customPeers: CustomPeer[];
  criteriaSet: string;
  customCriteria: string[];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]/40 mb-2">
      {children}
    </p>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#0A0A0A]/5 last:border-0">
      <span className="text-sm text-[#0A0A0A]/60">{label}</span>
      <span className="text-sm font-medium text-[#0A0A0A]">{value}</span>
    </div>
  );
}

export function Step4ReviewSummary({
  name,
  segment,
  selectedPeers,
  customPeers,
  criteriaSet,
  customCriteria,
}: ReviewSummaryProps) {
  const totalPeers = selectedPeers.length + customPeers.length;

  const activeCriteria =
    criteriaSet === "default_esg"
      ? DEFAULT_ESG_CRITERIA
      : criteriaSet === "ghg_focus"
        ? GHG_FOCUS_CRITERIA
        : customCriteria;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#0A0A0A] mb-1">
          Review & Start
        </h2>
        <p className="text-sm text-[#0A0A0A]/60">
          Confirm the details below before starting analysis.
        </p>
      </div>

      {/* Project details */}
      <div className="border border-[#0A0A0A]/10 rounded-lg p-4">
        <SectionTitle>Project</SectionTitle>
        <Row label="Name" value={name} />
        <Row
          label="Segment"
          value={
            segment ? (
              <span className="capitalize">
                {SEGMENT_LABELS[segment] ?? segment.replace(/_/g, " ")}
              </span>
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* Peers */}
      <div className="border border-[#0A0A0A]/10 rounded-lg p-4">
        <SectionTitle>Peers ({totalPeers})</SectionTitle>
        {totalPeers === 0 ? (
          <p className="text-sm text-[#0A0A0A]/40 italic">No peers selected.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedPeers.map((peer) => (
              <Badge key={peer.id} variant="secondary">
                {peer.name}
              </Badge>
            ))}
            {customPeers.map((p, i) => (
              <Badge key={`custom-${i}`} variant="outline">
                {p.name} (custom)
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Criteria */}
      <div className="border border-[#0A0A0A]/10 rounded-lg p-4">
        <SectionTitle>Criteria</SectionTitle>
        <Row
          label="Set"
          value={criteriaSet ? (CRITERIA_LABELS[criteriaSet] ?? criteriaSet) : "—"}
        />
        {criteriaSet === "custom" && (
          <div className="mt-3">
            <p className="text-xs text-[#0A0A0A]/50 mb-2">
              {activeCriteria.length} selected
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeCriteria.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px]">
                  {c.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
