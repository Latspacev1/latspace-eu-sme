// LocalStorage persistence for the reporting frameworks (CDP, VSME Digital
// Template). The VSME Narrative report uses its own qualitative storage layer
// (lib/reporting/qualitative).

export const CDP_ANSWERS_KEY = "cdp-app/v1";
export const VSME_ANSWERS_KEY = "vsme-app/v1";

export type Status = "not-started" | "in-progress" | "completed";

// Per-field marker written by the "Fill with AI" flow. Optional → backward
// compatible with answers saved before the feature existed.
export interface AiFillMarker {
  confidence?: number;
  code?: string;
  at: string;
}

export interface SavedAnswer {
  values: Record<string, unknown>;
  rows: Record<string, unknown>[];
  status: Status;
  updatedAt?: string;
  /** Keyed by fieldId — fields whose value was placed by the AI fill agent. */
  aiFilled?: Record<string, AiFillMarker>;
}

export type Answers = Record<string, SavedAnswer>;

export function readAnswers(key: string): Answers {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

