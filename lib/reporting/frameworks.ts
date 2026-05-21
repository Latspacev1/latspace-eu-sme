// frontend/lib/reporting/frameworks.ts
import { sections as cdpSections } from "./cdpSections";
import { sections as vsmeSections } from "./vsmeSections";
import type { Section } from "./frameworkTypes";
import { CDP_ANSWERS_KEY, VSME_ANSWERS_KEY } from "./storage";

export type FrameworkStatus = "active" | "coming-soon";
export type FrameworkCategory = "Climate" | "Sustainability" | "Regulatory";
// "questionnaire" — structured Q&A template (e.g. CDP, VSME Digital Template).
// "qualitative" — narrative document with embedded requirements (e.g. VSME Narrative).
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
  // All remaining frameworks persist to localStorage (`storageKey`) or are
  // qualitative documents (`variant: "qualitative"`); both bypass the API.
  storageKey?: string;
  variant?: FrameworkVariant;
}

export const FRAMEWORKS: FrameworkDef[] = [
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
  {
    id: "vsme",
    isParent: true,
    name: "VSME Digital Template",
    shortName: "VSME",
    description:
      "EFRAG's voluntary standard for non-listed micro, small and medium-sized undertakings. Basic module (B1–B11) covers general info, environment (energy, GHG, pollution, biodiversity, water, waste), social (workforce, health & safety, remuneration), and governance (anti-corruption). Comprehensive module (C1–C9) adds strategy, climate transition, climate risks, human rights and benchmark disclosures.",
    cadence: "Annual",
    category: "Sustainability",
    status: "active",
    sections: [],
    logoSrc: "/EU-logo.png",
    logoInitials: "VS",
    logoColor: "bg-emerald-100 text-emerald-700",
    children: [
      {
        id: "vsme",
        name: "VSME Digital Template",
        shortName: "Digital Template",
        description:
          "Structured EFRAG VSME Digital Template (v1.2.0) — Basic module (B1–B11) and Comprehensive module (C1–C9) captured as a fillable questionnaire that exports back to the official workbook.",
        cadence: "Annual",
        category: "Sustainability",
        status: "active",
        sections: vsmeSections,
        storageKey: VSME_ANSWERS_KEY,
        logoSrc: "/EU-logo.png",
        logoInitials: "VS",
        logoColor: "bg-emerald-100 text-emerald-700",
      },
      {
        id: "vsme-narrative",
        name: "VSME Sustainability Report",
        shortName: "Sustainability Report",
        description:
          "Sustainability report aligned to the VSME standard — qualitative document with embedded disclosure requirements, AI drafting assistant, and DOCX export.",
        cadence: "Annual",
        category: "Sustainability",
        status: "active",
        sections: [],
        variant: "qualitative",
        logoSrc: "/EU-logo.png",
        logoInitials: "VS",
        logoColor: "bg-emerald-100 text-emerald-700",
      },
    ],
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

// All remaining frameworks are local-mode (localStorage or qualitative).
// Kept as a function rather than removed so callers don't need rewiring if
// future API-backed frameworks are reintroduced.
export function isLocalMode(fw: FrameworkDef): boolean {
  return !!fw.storageKey || fw.variant === "qualitative";
}
