"use client";

import { CRITERION_LABELS, CriterionScore, MaturityBand } from "@/lib/api/benchmarking";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ExternalLink } from "lucide-react";

// ── Band config ───────────────────────────────────────────────────────────────

interface BandConfig {
  label: string;
  chipClass: string;
}

const BAND_CONFIG: Record<MaturityBand, BandConfig> = {
  basic: {
    label: "Basic",
    chipClass: "bg-gray-100 text-gray-600",
  },
  defined: {
    label: "Defined",
    chipClass: "bg-yellow-100 text-yellow-700",
  },
  comprehensive: {
    label: "Comprehensive",
    chipClass: "bg-blue-100 text-blue-700",
  },
  leading: {
    label: "Leading",
    chipClass: "bg-green-100 text-green-700",
  },
  not_disclosed: {
    label: "N/D",
    chipClass: "bg-muted text-muted-foreground line-through",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface MaturityCellProps {
  score: CriterionScore | undefined;
  ariaLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaturityCell({ score, ariaLabel }: MaturityCellProps) {
  if (!score) {
    return (
      <td className="px-2 py-2 text-center">
        <span className="inline-block px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
          —
        </span>
      </td>
    );
  }

  const cfg = BAND_CONFIG[score.maturity_band] ?? BAND_CONFIG.not_disclosed;
  const label = ariaLabel ?? `${score.criterion}: ${cfg.label}`;

  return (
    <td className="px-2 py-2 text-center">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${cfg.label}`}
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#074D47] ${cfg.chipClass}`}
          >
            {cfg.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4 text-sm space-y-3" side="top">
          <div>
            <p className="font-semibold text-[#0A0A0A] capitalize mb-0.5">
              {CRITERION_LABELS[score.criterion] ?? score.criterion.replace(/_/g, " ")}
            </p>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cfg.chipClass}`}
            >
              {cfg.label}
            </span>
          </div>
          {score.evidence && (
            <p className="text-[#0A0A0A]/70 leading-relaxed">{score.evidence}</p>
          )}
          {score.notes && (
            <p className="text-[#0A0A0A]/50 italic text-xs">{score.notes}</p>
          )}
          {score.source_url && (
            <a
              href={score.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#074D47] hover:underline text-xs"
            >
              <ExternalLink className="w-3 h-3" />
              Source
            </a>
          )}
        </PopoverContent>
      </Popover>
    </td>
  );
}
