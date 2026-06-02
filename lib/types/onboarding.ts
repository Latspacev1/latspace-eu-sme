// Shared contract for the onboarding profile captured when a user creates their
// organization, and edited later from the "AI Context" page.
//
// Persisted as the `onboarding_profile` JSONB column on organizations
// (migration 0006). Written by /api/onboarding (POST, at org creation) and
// /api/ai-context (PATCH, edits). Read by the AI Context page and, later, by the
// agent routes to ground the assistant in the org's reporting situation.

/** Report types the org intends to produce. */
export type ReportType = "vsme" | "cdp_sme";

/** VSME module scope. */
export type VsmeModules = "basic" | "basic_comprehensive";

export interface VsmeContext {
  /** Why the org is doing VSME (free text — e.g. bank request, customer ask). */
  purpose: string;
  /** Basic module only, or Basic + Comprehensive. */
  modules: VsmeModules;
}

export interface OnboardingProfile {
  /** Company name (mirrors organizations.name; kept here so the profile is self-contained). */
  companyName: string;
  /** Public website URL. */
  websiteUrl: string;
  /** Which reports the org is producing. */
  reports: ReportType[];
  /** VSME-specific answers. Present/meaningful only when reports includes "vsme". */
  vsme: VsmeContext | null;
  /** Reporting year, e.g. 2025. */
  reportingYear: number | null;
  /** ISO timestamp of the last edit. */
  updatedAt: string | null;
}

export const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: "vsme",
    label: "VSME",
    description: "EFRAG Voluntary Sustainability Reporting Standard for non-listed SMEs.",
  },
  {
    value: "cdp_sme",
    label: "CDP SME",
    description: "CDP climate disclosure questionnaire for small and mid-sized enterprises.",
  },
];

export const VSME_MODULE_OPTIONS: { value: VsmeModules; label: string; description: string }[] = [
  {
    value: "basic",
    label: "Basic Module only",
    description: "Disclosures B1–B11.",
  },
  {
    value: "basic_comprehensive",
    label: "Basic + Comprehensive Module",
    description: "Disclosures B1–B11 plus C1–C9.",
  },
];

/** An empty profile seeded with a company name (used as a wizard / editor default). */
export function emptyOnboardingProfile(companyName = ""): OnboardingProfile {
  return {
    companyName,
    websiteUrl: "",
    reports: [],
    vsme: null,
    reportingYear: null,
    updatedAt: null,
  };
}

/**
 * Validate and normalize an unknown value into an OnboardingProfile. Returns
 * `{ profile }` on success or `{ error }` with a human-readable message.
 * Used by the API routes so the client and server share one validation path.
 */
export function parseOnboardingProfile(
  input: unknown,
): { profile: OnboardingProfile } | { error: string } {
  if (typeof input !== "object" || input === null) {
    return { error: "Profile must be an object." };
  }
  const raw = input as Record<string, unknown>;

  const companyName = typeof raw.companyName === "string" ? raw.companyName.trim() : "";
  if (!companyName) return { error: "Company name is required." };
  if (companyName.length > 120) {
    return { error: "Company name must be 120 characters or fewer." };
  }

  const websiteUrl = typeof raw.websiteUrl === "string" ? raw.websiteUrl.trim() : "";
  if (websiteUrl.length > 300) {
    return { error: "Website URL must be 300 characters or fewer." };
  }

  const reportsRaw = Array.isArray(raw.reports) ? raw.reports : [];
  const reports = reportsRaw.filter(
    (r): r is ReportType => r === "vsme" || r === "cdp_sme",
  );
  if (reports.length === 0) {
    return { error: "Select at least one report." };
  }

  let vsme: VsmeContext | null = null;
  if (reports.includes("vsme")) {
    const v =
      typeof raw.vsme === "object" && raw.vsme !== null
        ? (raw.vsme as Record<string, unknown>)
        : {};
    const modules = v.modules === "basic_comprehensive" ? "basic_comprehensive" : "basic";
    const purpose = typeof v.purpose === "string" ? v.purpose.trim() : "";
    if (purpose.length > 1000) {
      return { error: "VSME purpose must be 1000 characters or fewer." };
    }
    vsme = { purpose, modules };
  }

  let reportingYear: number | null = null;
  if (raw.reportingYear !== null && raw.reportingYear !== undefined && raw.reportingYear !== "") {
    const year = Number(raw.reportingYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: "Reporting year must be a year between 2000 and 2100." };
    }
    reportingYear = year;
  }

  return {
    profile: {
      companyName,
      websiteUrl,
      reports,
      vsme,
      reportingYear,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    },
  };
}
