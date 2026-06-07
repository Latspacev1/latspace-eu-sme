// Shared types between runner.ts and the per-mode handlers. The chat and
// write request shapes mirror the dispatcher routes one-to-one — keeping the
// JSON contract stable means we don't have to coordinate two parsers when the
// frontend evolves.

export type EmitFn = (event: string, data: unknown) => void;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QuestionContext {
  kind: "question";
  question: {
    id: string;
    label: string;
    sectionId: string;
    sectionTitle: string;
    questionKind: "fields" | "table";
    description?: string;
  };
  answer?: {
    status: "not-started" | "in-progress" | "completed";
    filledCount: number;
    totalFields: number;
    preview?: string;
  };
}

export interface DocumentContext {
  kind: "document";
  title: string;
  outline: Array<{
    id: string;
    kind: string;
    level?: 1 | 2 | 3;
    heading?: string;
    preview?: string;
  }>;
}

export type ChatContext = QuestionContext | DocumentContext;

export interface ChatJob {
  mode: "chat";
  messages: ChatMessage[];
  framework?: string;
  context?: ChatContext | null;
  // The reporting org's self-authored business context (from the AI Context
  // page). Injected into the system prompt to ground answers in company
  // specifics. Optional/nullable so older payloads and the local stub work.
  businessContext?: string | null;
}

export interface OutlineItem {
  id: string;
  kind:
    | "heading"
    | "paragraph"
    | "table"
    | "requirement-ref"
    | "data-ref"
    | "section-marker"
    | "diagram";
  level?: 1 | 2 | 3;
  heading?: string;
  preview?: string;
}

export interface WriteJob {
  mode: "write";
  instruction: string;
  outline: OutlineItem[];
  framework?: string;
  // See ChatJob.businessContext — same grounding context, injected into the
  // write-mode system prompt.
  businessContext?: string | null;
}

// A parameter the org already has — passed in so the extraction agent reuses
// existing codes instead of proposing duplicates.
export interface ExistingParameter {
  code: string;
  display_name: string;
  unit: string;
  section: string;
}

export interface ExtractJob {
  mode: "extract";
  // Short-TTL signed URL to the uploaded document in Supabase Storage. The
  // runner fetches the bytes itself — they are never inlined into JOB_JSON.
  documentUrl: string;
  filename: string;
  mimeType: string;
  framework?: string;
  // Optional hint about the reporting period the document covers.
  periodHint?: string;
  existingParameters?: ExistingParameter[];
}

// ── Fill mode ────────────────────────────────────────────────────────────────
// The agent reads the org's measured inputs (passed in — the sandbox has no DB
// key) and authors formulas that derive VSME output metrics, pinning each to a
// VSME template cell so the app can place the value in the right question/field.

// An input or emission-factor parameter the org already has. `value_annual` is
// the measured figure for the active period; `has_value` is false when no data
// point exists (so the agent knows not to build formulas that depend on it).
export interface FillInputParameter {
  code: string;
  display_name: string;
  unit: string;
  category: "input" | "emission_factor";
  section: string;
  value_annual: number | null;
  has_value: boolean;
}

// An output parameter the org already has. `has_active_formula` tells the agent
// it's already wired up — reuse the code, don't re-author its formula.
export interface FillExistingOutput {
  code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string | null;
  has_active_formula: boolean;
}

// A derivable VSME cell the agent may target. Derived from the export bindings
// (lib/reporting/vsmeFillTargets.ts). `occupied` is true when the user has
// already filled that field by hand — the agent skips it.
export interface FillTargetCell {
  vsme_cell: string; // "<Sheet>!<Cell>"
  question_id: string;
  question_label: string;
  section_id: string;
  section_title: string;
  field_id: string;
  methodology_hint?: string;
  occupied: boolean;
}

export interface FillJob {
  mode: "fill";
  framework?: string;
  period: { code: string; label: string };
  inputs: FillInputParameter[];
  existingOutputs: FillExistingOutput[];
  targets: FillTargetCell[];
  // See ChatJob.businessContext — same grounding context.
  businessContext?: string | null;
}
