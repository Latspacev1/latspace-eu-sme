// frontend/lib/reporting/frameworks.ts
import { sections as cctsSections } from "./cctsSections";
import { sections as rcoSections } from "./rcoSections";
import { sections as cbamSections } from "./cbamSections";
import { sections as brsrSections } from "./brsrSections";
import { sections as cdpSections } from "./cdpSections";
import type { Section } from "./frameworkTypes";
import {
  BRSR_ANSWERS_KEY,
  CBAM_ANSWERS_KEY,
  CDP_ANSWERS_KEY,
} from "./storage";

export type FrameworkStatus = "active" | "coming-soon";
export type FrameworkCategory = "Climate" | "Sustainability" | "Regulatory";
// "questionnaire" — structured Q&A template (CCTS, RCO, CBAM CT, BRSR, CDP).
// "qualitative" — narrative document with embedded requirements (CBAM MMD).
export type FrameworkVariant = "questionnaire" | "qualitative";

export interface FrameworkDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  cadence: string;
  category: FrameworkCategory;
  status: FrameworkStatus;
  sections: Section[];
  logoSrc?: string;
  logoInitials: string;
  logoColor: string;
  isParent?: true;
  children?: FrameworkDef[];
  // Frameworks with `storageKey` use localStorage (hybrid mode).
  // Frameworks without it go through reportingApi (API-backed).
  storageKey?: string;
  variant?: FrameworkVariant;
}

export const FRAMEWORKS: FrameworkDef[] = [
  {
    id: "cbam",
    isParent: true,
    name: "Carbon Border Adjustment Mechanism",
    shortName: "CBAM",
    description:
      "EU regulation requiring importers to report — and from 2026, pay for — embedded emissions in carbon-intensive imports.",
    cadence: "Quarterly",
    category: "Regulatory",
    status: "active",
    sections: [],
    logoSrc: "/EU-logo.png",
    logoInitials: "EU",
    logoColor: "bg-blue-100 text-blue-700",
    children: [
      {
        id: "cbam",
        name: "CBAM Communication Template",
        shortName: "Communication Template",
        description:
          "EU communication template for installations — per-product embedded emissions reported by operators outside the EU.",
        cadence: "Quarterly",
        category: "Regulatory",
        status: "active",
        sections: cbamSections,
        storageKey: CBAM_ANSWERS_KEY,
        logoSrc: "/EU-logo.png",
        logoInitials: "EU",
        logoColor: "bg-blue-100 text-blue-700",
      },
      {
        id: "cbam-mmd",
        name: "Monitoring Methodology Document",
        shortName: "MMD (Monitoring Methodology Document)",
        description:
          "Installation-level methodology describing system boundaries, data sources, and calculation approach used to determine embedded emissions.",
        cadence: "Annual",
        category: "Regulatory",
        status: "active",
        sections: [],
        variant: "qualitative",
        logoSrc: "/EU-logo.png",
        logoInitials: "EU",
        logoColor: "bg-blue-100 text-blue-700",
      },
    ],
  },
  {
    id: "rco",
    name: "Renewable Consumption Obligation",
    shortName: "RCO — DCs with CPP & Open Access",
    description:
      "MoP RCO compliance return for Designated Consumers operating Captive Power Plants and consuming Open-Access power.",
    cadence: "Quarterly",
    category: "Regulatory",
    status: "active",
    sections: rcoSections,
    logoSrc: "/bee-logo.jpg",
    logoInitials: "RCO",
    logoColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "ccts",
    isParent: true,
    name: "Carbon Credit Trading Scheme",
    shortName: "CCTS",
    description:
      "India's domestic carbon market — sector-wise compliance and offset mechanism administered by BEE under the Energy Conservation Act.",
    cadence: "Annual",
    category: "Regulatory",
    status: "active",
    sections: [],
    logoSrc: "/bee-logo.jpg",
    logoInitials: "CC",
    logoColor: "bg-amber-100 text-amber-700",
    children: [
      {
        id: "ccts",
        name: "CCTS Pro-Forma (Cement Sector)",
        shortName: "Pro-Forma (Cement Sector)",
        description:
          "BEE Cement-Sector pro-forma capturing production and energy consumption for CCTS baseline / target-year reporting (Form-Sb).",
        cadence: "Annual",
        category: "Regulatory",
        status: "active",
        sections: cctsSections,
        logoSrc: "/bee-logo.jpg",
        logoInitials: "CC",
        logoColor: "bg-amber-100 text-amber-700",
      },
      {
        id: "ccts-monitoring-plan",
        name: "CCTS Monitoring Plan",
        shortName: "Monitoring Plan",
        description:
          "Entity-level monitoring plan defining data flows, measurement equipment, and QA/QC procedures used to support CCTS compliance reports.",
        cadence: "Annual",
        category: "Regulatory",
        status: "coming-soon",
        sections: [],
        logoSrc: "/bee-logo.jpg",
        logoInitials: "CC",
        logoColor: "bg-amber-100 text-amber-700",
      },
      {
        id: "ccts-ghg-reduction",
        name: "CCTS GHG Reduction Action Plans",
        shortName: "GHG Reduction Action Plans",
        description:
          "Forward-looking abatement plans listing identified GHG reduction levers, expected savings, capex, and implementation timelines.",
        cadence: "Annual",
        category: "Regulatory",
        status: "coming-soon",
        sections: [],
        logoSrc: "/bee-logo.jpg",
        logoInitials: "CC",
        logoColor: "bg-amber-100 text-amber-700",
      },
    ],
  },
  {
    id: "brsr",
    name: "Business Responsibility & Sustainability Report",
    shortName: "BRSR",
    description:
      "SEBI Annexure I — annual ESG disclosure covering general entity information, NGRBC management & process disclosures, and principle-wise performance against the nine NGRBC principles (Essential + Leadership indicators).",
    cadence: "Annual",
    category: "Sustainability",
    status: "active",
    sections: brsrSections,
    storageKey: BRSR_ANSWERS_KEY,
    logoSrc: "/SEBI_logo.png",
    logoInitials: "BR",
    logoColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "cdp",
    name: "CDP Climate Change Questionnaire",
    shortName: "CDP",
    description:
      "Annual environmental disclosure to CDP — covers governance, strategy, risks & opportunities, value-chain engagement, scenario analysis, and detailed Scope 1/2/3 emissions, energy, targets, initiatives and project-based credits.",
    cadence: "Annual",
    category: "Climate",
    status: "active",
    sections: cdpSections,
    storageKey: CDP_ANSWERS_KEY,
    logoSrc: "/cdp-logo.png",
    logoInitials: "CD",
    logoColor: "bg-rose-100 text-rose-700",
  },
];

export function getFramework(id: string): FrameworkDef | undefined {
  for (const f of FRAMEWORKS) {
    // Search children first so that a parent and child sharing the same id
    // returns the child (the actual questionnaire).
    if (f.children) {
      const child = f.children.find((c) => c.id === id);
      if (child) return child;
    }
    if (f.id === id) return f;
  }
  return undefined;
}

// Local-mode frameworks are persisted to localStorage and skip the
// reportingApi instance machinery.
export function isLocalMode(fw: FrameworkDef): boolean {
  return !!fw.storageKey || fw.variant === "qualitative";
}
