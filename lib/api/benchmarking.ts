/**
 * Benchmarking API methods
 */
import { apiClient, APIResponse } from "./client";

// ── Segment ──────────────────────────────────────────────────────────────────

export type BenchmarkingSegment =
  | "real_estate"
  | "cement"
  | "hospitality"
  | "custom";

export type ProjectStatus = "draft" | "running" | "complete" | "failed";

export type CriteriaSet = "default_esg" | "ghg_focus" | "custom";

export type MaturityBand =
  | "basic"
  | "defined"
  | "comprehensive"
  | "leading"
  | "not_disclosed";

export type ThemeKey =
  | "reporting_disclosures"
  | "ghg_net_zero"
  | "scores_certifications";

// ── Domain types ─────────────────────────────────────────────────────────────

export interface BenchmarkingProjectListItem {
  project_id: string;
  name: string;
  segment: BenchmarkingSegment;
  status: ProjectStatus;
  peer_count: number;
  created_at: string;
}

export interface BenchmarkingProject extends BenchmarkingProjectListItem {
  peer_ids: string[];
  criteria_set: CriteriaSet;
  custom_criteria: string[];
  results?: BenchmarkingResults;
}

export interface BenchmarkingResults {
  peers: PeerResult[];
  summary: Record<string, unknown>;
}

export interface PeerResult {
  peer_id: string;
  peer_name: string;
  scores: Record<string, number | null>;
}

export interface CriterionScore {
  criterion: string;
  category: string;
  theme: ThemeKey;
  maturity_band: MaturityBand;
  evidence: string;
  source_url: string;
  notes?: string | null;
}

export interface BenchmarkingResult {
  id: string;
  project_id: string;
  peer_id: string;
  scores: CriterionScore[];
  overall_band: MaturityBand;
  run_at: string;
  agent_model: string;
}

export interface Recommendation {
  id?: string;
  priority: "short_term" | "long_term";
  category: "E" | "S" | "G";
  text: string;
  rationale: string;
}

/** Shape returned by GET /api/benchmarking/projects/{id} */
export interface BenchmarkingProjectDetail {
  project: {
    id: string;
    name: string;
    segment: string;
    status: ProjectStatus;
    peer_ids: string[];
    criteria_set: CriteriaSet;
    custom_criteria: string[];
    created_at: string;
  };
  results: BenchmarkingResult[];
  recommendations?: Recommendation[];
}

export interface PeerLibraryItem {
  peer_id: string;
  name: string;
  segment: BenchmarkingSegment;
  report_url?: string;
}

// ── Request / Response shapes ─────────────────────────────────────────────────

export interface CreateProjectRequest {
  name: string;
  segment: BenchmarkingSegment;
  peer_ids: string[];
  criteria_set: CriteriaSet;
  custom_criteria?: string[];
}

export interface CreateProjectResponse {
  project_id: string;
  status: ProjectStatus;
}

export interface RunProjectResponse {
  status: "running";
}

export interface ProjectStatusResponse {
  status: ProjectStatus;
  run_started_at: string | null;
  run_completed_at: string | null;
  peers_completed: number;
  peers_total: number;
}

// ── Criterion display labels ──────────────────────────────────────────────────

export const CRITERION_LABELS: Record<string, string> = {
  ghg_scope1_2_disclosure: "GHG Scope 1 & 2 Disclosure",
  ghg_scope3_disclosure: "GHG Scope 3 Disclosure",
  ghg_methodology: "GHG Methodology",
  external_assurance: "External Assurance",
  net_zero_target: "Net Zero Target",
  sbti_alignment: "SBTi Alignment",
  renewable_energy_pct: "Renewable Energy %",
  climate_risk_assessment: "Climate Risk Assessment",
  internal_carbon_price: "Internal Carbon Price",
  carbon_offsets_recs: "Carbon Offsets / RECs",
  digital_ghg_platform: "Digital GHG Platform",
  gresb_score: "GRESB Score",
  cdp_disclosure: "CDP Disclosure",
  green_building_certs: "Green Building Certifications",
  esg_report_published: "ESG Report Published",
  board_esg_oversight: "Board ESG Oversight",
  supplier_esg_screening: "Supplier ESG Screening",
  esg_investment_criteria: "ESG Investment Criteria",
  integrated_reporting: "Integrated Reporting",
};

// ── API object ────────────────────────────────────────────────────────────────

const API_BASE = "/api/benchmarking";

export const benchmarkingApi = {
  /**
   * List all benchmarking projects for the current organisation.
   */
  async listProjects(): Promise<APIResponse<BenchmarkingProjectListItem[]>> {
    return apiClient.get<BenchmarkingProjectListItem[]>(
      `${API_BASE}/projects`,
    );
  },

  /**
   * Create a new benchmarking project.
   */
  async createProject(
    request: CreateProjectRequest,
  ): Promise<APIResponse<CreateProjectResponse>> {
    return apiClient.post<CreateProjectResponse>(
      `${API_BASE}/projects`,
      request,
    );
  },

  /**
   * Get a single project with its results (if complete).
   */
  async getProject(
    projectId: string,
  ): Promise<APIResponse<BenchmarkingProjectDetail>> {
    return apiClient.get<BenchmarkingProjectDetail>(
      `${API_BASE}/projects/${projectId}`,
    );
  },

  /**
   * Trigger analysis run for a project.
   */
  async runProject(
    projectId: string,
  ): Promise<APIResponse<RunProjectResponse>> {
    return apiClient.post<RunProjectResponse>(
      `${API_BASE}/projects/${projectId}/run`,
    );
  },

  /**
   * Get the live run status of a project.
   */
  async getStatus(
    projectId: string,
  ): Promise<APIResponse<ProjectStatusResponse>> {
    return apiClient.get<ProjectStatusResponse>(
      `${API_BASE}/projects/${projectId}/status`,
    );
  },

  /**
   * List peers available in the peer library.
   */
  async listPeerLibrary(): Promise<APIResponse<PeerLibraryItem[]>> {
    return apiClient.get<PeerLibraryItem[]>(`${API_BASE}/peer-library`);
  },
};
