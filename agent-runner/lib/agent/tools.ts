// In-process function tools exposed to the OpenAI Agents SDK. Each request
// builds its own tool array via createAgentTools() so the tool handlers can
// close over per-request callbacks (forwarding retrieved sources / proposals to
// the runner's NDJSON stream) and the active framework's RAG index.
//
// Tool names registered here (search_guidance, propose_insert, …) are passed to
// the agent verbatim — there is no MCP server prefix.

import { tool, type Tool } from "@openai/agents";
import { z } from "zod";
import { search, type Framework, type RetrievedChunk } from "../retrieval.ts";
import { ALLOWED_SECTIONS } from "./param-sections.ts";
import { CATEGORIES, SUBCATEGORIES, type DocumentClassification } from "./classification.ts";

export interface RetrievedSource {
  section: string;
  title: string;
  pages: string;
  score: number;
}

export interface ProposalBlocks {
  after_block_id: string | null;
  blocks: Array<
    | { kind: "heading"; level: 1 | 2 | 3; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "table"; columns: string[]; rows: string[][] }
    | { kind: "diagram"; format: "mermaid"; source: string; caption?: string }
  >;
  rationale: string;
}

// ── Extraction proposal contract (extract mode) ──────────────────────────────
// Mirrored app-side by the /api/extract/commit validator. The agent calls
// propose_extraction exactly once with this shape.
export interface ProposedParameter {
  code: string;
  display_name: string;
  unit: string;
  category: "input" | "emission_factor" | "output";
  section: string;
  is_monthly: boolean;
  is_calculated: boolean;
}

export interface ProposedDataPoint {
  parameter_code: string;
  value_annual: number | null;
  values_monthly: (number | null)[] | null;
  source_file: string;
  source_excerpt: string;
  source_page?: number;
  source_sheet?: string;
  source_cell?: string;
  confidence?: number;
}

export interface ExtractionProposal {
  period: { code: string; label: string; start_date?: string; end_date?: string };
  classification: DocumentClassification;
  parameters: ProposedParameter[];
  data_points: ProposedDataPoint[];
  notes?: string;
}

// ── Fill proposal contract (fill mode) ───────────────────────────────────────
// The agent derives VSME output metrics from the org's measured inputs. It
// proposes the output parameters to create (each pinned to a VSME cell) and the
// formula that produces each, expressed over input parameter codes. Mirrored
// app-side by lib/metrics/commitProposal.ts.
export interface ProposedOutputParameter {
  code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string; // "<Sheet>!<Cell>" — the template cell this metric fills
}

export interface ProposedFillFormula {
  output_param_code: string;
  expression: string; // arithmetic over input parameter codes, e.g. "kwh * factor"
  dependencies: string[]; // every identifier used in `expression`
  expression_human?: string;
  description?: string;
  confidence?: number; // 0–1, the agent's confidence in this derivation
}

export interface FillProposal {
  period: { code: string; label: string };
  output_parameters: ProposedOutputParameter[];
  formulas: ProposedFillFormula[];
  skipped?: { vsme_cell: string; reason: string }[];
  notes?: string;
}

interface AgentMcpOptions {
  // Called once per `search_guidance` invocation with the surfaced sources, so
  // the runner can stream them to the client as a `retrieved` NDJSON event.
  onSearchHit?: (sources: RetrievedSource[]) => void;
  // Write mode only. When provided, the propose_insert tool is registered.
  // Outline IDs are validated against this set; the proposal is forwarded via
  // onProposal for the runner to emit as a `proposal` NDJSON event.
  outlineIds?: Set<string>;
  onProposal?: (proposal: ProposalBlocks) => void;
  // Extract mode only. When provided, the propose_extraction tool is
  // registered and forwards the proposal for the runner to emit.
  onExtraction?: (proposal: ExtractionProposal) => void;
  // Fill mode only. When provided, the propose_fill tool is registered and
  // forwards the proposal for the runner to emit.
  onFill?: (proposal: FillProposal) => void;
}

// Per-framework descriptors used to build the `search_guidance` tool's
// description. Knowing what the agent is actually retrieving from helps the
// model decide when to call the tool and what to query for.
const FRAMEWORK_INFO: Record<Framework, { docName: string; sectionExample: string }> = {
  cdp: {
    docName: "the official CDP 2026 questionnaire guidance document",
    sectionExample: "§C2.2a",
  },
  vsme: {
    docName:
      "the official EFRAG Voluntary Sustainability Reporting Standard for non-listed SMEs (VSME) guidance",
    sectionExample: "§B3",
  },
};

function formatRetrievedExcerpts(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const pages =
        c.firstPage === c.lastPage ? `page ${c.firstPage}` : `pages ${c.firstPage}-${c.lastPage}`;
      const path = c.sectionPath.join(" › ");
      return `<excerpt id="${i + 1}" section="§${c.sectionNumber}" pages="${pages}">
Section path: ${path}

${c.text}
</excerpt>`;
    })
    .join("\n\n");
}

function chunkToSource(c: RetrievedChunk): RetrievedSource {
  return {
    section: `§${c.sectionNumber}`,
    title: c.sectionTitle,
    pages: c.firstPage === c.lastPage ? `p${c.firstPage}` : `p${c.firstPage}-${c.lastPage}`,
    score: Number(c.fusedScore.toFixed(4)),
  };
}

export function createAgentTools(framework: Framework, opts: AgentMcpOptions): Tool[] {
  const info = FRAMEWORK_INFO[framework];

  const searchGuidance = tool({
    name: "search_guidance",
    description: `Search ${info.docName} and return the most relevant excerpts. Each excerpt is tagged with a section number (e.g. ${info.sectionExample}) and page range that you must cite verbatim in your reply. Call this whenever the user asks a substantive regulatory question. You may call it multiple times with different queries to cover compound questions.`,
    strict: true,
    parameters: z.object({
      query: z
        .string()
        .min(2)
        .describe("Natural-language search query. Be specific — e.g., 'system boundaries for embedded emissions' beats 'emissions'."),
      k: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .describe("Number of excerpts to return. Defaults to 6. Pass null for the default."),
    }),
    execute: async (args) => {
      try {
        const k = args.k ?? 6;
        const chunks = await search(args.query, framework, { k });
        const sources = chunks.map(chunkToSource);
        opts.onSearchHit?.(sources);
        return chunks.length
          ? formatRetrievedExcerpts(chunks)
          : "No matching excerpts found in the guidance document for this query.";
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return `search_guidance failed: ${message}`;
      }
    },
  });

  const tools: Tool[] = [searchGuidance];

  if (opts.outlineIds && opts.onProposal) {
    const outlineIds = opts.outlineIds;
    const onProposal = opts.onProposal;

    const headingBlock = z.object({
      kind: z.literal("heading"),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: z.string().min(1),
    });
    const paragraphBlock = z.object({
      kind: z.literal("paragraph"),
      text: z.string().min(1),
    });
    const tableBlock = z.object({
      kind: z.literal("table"),
      columns: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())),
    });
    const diagramBlock = z.object({
      kind: z.literal("diagram"),
      format: z.literal("mermaid"),
      source: z
        .string()
        .min(1)
        .describe(
          "Mermaid source. Prefer flowchart TD or LR for system boundaries / process flows; sequenceDiagram for monitoring/data exchange flows. Keep node labels short."
        ),
      caption: z
        .string()
        .nullable()
        .describe(
          `Optional caption shown beneath the diagram (null if none). Good place to put a citation like 'Source: ${info.sectionExample} (page N)'.`
        ),
    });

    const proposeInsert = tool({
      name: "propose_insert",
      description: "Insert one or more blocks into the user's report at a specific location. Call this exactly once per writing task, after you have searched the guidance for any factual claims you intend to make. The insertion appears to the user as a highlighted preview that they can accept or reject — do not call this for ordinary chat answers.",
      strict: true,
      parameters: z.object({
        after_block_id: z
          .string()
          .nullable()
          .describe(
            "ID of the existing block to insert AFTER, taken verbatim from the outline provided in the user message. Use null to prepend at the very top of the document."
          ),
        blocks: z
          .array(z.union([headingBlock, paragraphBlock, tableBlock, diagramBlock]))
          .min(1)
          .describe("Ordered list of blocks to insert. Use heading + paragraph for new sections; use table only if the user explicitly asked for tabular content; use diagram when the user asks for a flow/system-boundary/process visualization or when a diagram clearly aids comprehension."),
        rationale: z
          .string()
          .min(1)
          .describe("1-3 sentences explaining what was drafted and where it goes. Do not duplicate the block text here."),
      }),
      execute: async (args) => {
        if (args.after_block_id !== null && !outlineIds.has(args.after_block_id)) {
          return `after_block_id "${args.after_block_id}" is not in the outline. Pick one of the IDs in square brackets, or use null to prepend.`;
        }
        onProposal({
          after_block_id: args.after_block_id,
          blocks: args.blocks,
          rationale: args.rationale,
        });
        return "Proposal accepted into the editor. The user will review it.";
      },
    });

    tools.push(proposeInsert);
  }

  if (opts.onExtraction) {
    const onExtraction = opts.onExtraction;

    const proposedParameter = z.object({
      code: z.string().min(1).describe("snake_case identifier, e.g. 'electricity_kwh'. Reuse an existing code verbatim when the metric already exists."),
      display_name: z.string().min(1),
      unit: z.string().describe("e.g. 'kWh', 'm3', 'tCO2e', '%'. Empty string if unitless."),
      category: z.enum(["input", "emission_factor", "output"]),
      section: z.enum(ALLOWED_SECTIONS).describe("Pick the closest section from the allowed list; use 'other' only if nothing fits."),
      is_monthly: z.boolean().describe("true only if you have a value per month (a 12-length array)."),
      is_calculated: z.boolean().describe("true only if this is derived by a formula rather than read from the document."),
    });

    const proposedDataPoint = z.object({
      parameter_code: z.string().min(1).describe("Must match a parameter's code (proposed here or an existing one)."),
      value_annual: z.number().nullable().describe("The single annual value, or null when only monthly values exist."),
      values_monthly: z.array(z.number().nullable()).length(12).nullable().describe("Jan..Dec, exactly 12 entries, or null when annual-only."),
      source_file: z.string().describe("The document filename this value came from."),
      source_excerpt: z.string().min(1).describe("Verbatim text from the document supporting this value. Never paraphrase."),
      source_page: z.number().int().nullable().describe("1-based page number where the value appears (null if unknown)."),
      source_sheet: z.string().nullable().describe("For spreadsheet sources: the sheet/tab name the value came from (null otherwise)."),
      source_cell: z.string().nullable().describe("For spreadsheet sources: the cell or range reference, e.g. 'B4' or 'C4:N4' (null otherwise)."),
      confidence: z.number().min(0).max(1).nullable().describe("0–1 confidence in this value, or null."),
    });

    const subcatList = CATEGORIES.flatMap((c) => [...SUBCATEGORIES[c]]);
    const classificationSchema = z
      .object({
        category: z
          .enum(CATEGORIES)
          .describe(
            "Top-level subject of the document: general_information (company/entity info), environmental (energy, water, waste, fuel, feedstock, logistics, packaging, purchased goods, biodiversity), social (employees, turnover, health & safety, worker representation), or governance (ownership, conduct policies, legal proceedings, certifications/audits/permits).",
          ),
        subcategory: z
          .enum(subcatList as [string, ...string[]])
          .describe(
            "The specific subcategory WITHIN the chosen category. Must belong to that category's list. For general_information always use 'General'.",
          ),
      })
      .superRefine((val, ctx) => {
        const allowed = SUBCATEGORIES[val.category] as readonly string[];
        if (!allowed.includes(val.subcategory)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["subcategory"],
            message: `subcategory "${val.subcategory}" is not valid for category "${val.category}". Allowed: ${allowed.join(", ")}.`,
          });
        }
      });

    const proposeExtraction = tool({
      name: "propose_extraction",
      description: "Submit the metrics you extracted from the document. Call this EXACTLY ONCE, at the end, after you have read the whole document. Classify the document, then list every metric. Every data point must cite a verbatim source_excerpt. Never invent values that are not present in the document.",
      strict: true,
      parameters: z.object({
        period: z.object({
          code: z.string().min(1).describe("Short period code, e.g. 'FY2025' or '2025-03'."),
          label: z.string().min(1).describe("Human label, e.g. 'Fiscal Year 2025'."),
          start_date: z.string().nullable().describe("ISO date if determinable, else null."),
          end_date: z.string().nullable().describe("ISO date if determinable, else null."),
        }),
        classification: classificationSchema.describe(
          "Classify the document into one category and one subcategory based on its primary subject.",
        ),
        parameters: z.array(proposedParameter).describe("Every distinct metric found. Reuse existing codes; do not duplicate."),
        data_points: z.array(proposedDataPoint).describe("One per parameter per period, with provenance."),
        notes: z.string().nullable().describe("Anything ambiguous the reviewer should know, or null."),
      }),
      execute: async (args) => {
        const codes = new Set(args.parameters.map((p) => p.code));
        const orphans = args.data_points
          .map((d) => d.parameter_code)
          .filter((c) => !codes.has(c));
        // Orphans are allowed only if they reference an existing org parameter —
        // we can't verify that here, so warn rather than reject. The app-side
        // commit route re-validates against the org catalogue.
        onExtraction({
          period: args.period,
          classification: args.classification as DocumentClassification,
          parameters: args.parameters,
          data_points: args.data_points,
          notes: args.notes ?? undefined,
        });
        const warn = orphans.length
          ? ` Note: ${orphans.length} data point(s) reference codes not in the parameters list — make sure those are existing parameters.`
          : "";
        return `Extraction proposal accepted (${args.parameters.length} parameters, ${args.data_points.length} data points). The user will review it.${warn}`;
      },
    });

    tools.push(proposeExtraction);
  }

  if (opts.onFill) {
    const onFill = opts.onFill;

    const proposedOutputParameter = z.object({
      code: z.string().min(1).describe("snake_case identifier for the output metric, e.g. 'vsme_b3_scope2_location'. Reuse an existing output code verbatim if one matches."),
      display_name: z.string().min(1),
      unit: z.string().describe("Unit of the computed metric, e.g. 'kWh', 'tCO2e', 'm3', '%'. Must be consistent with the formula."),
      section: z.enum(ALLOWED_SECTIONS).describe("The output param_section this metric belongs to (e.g. vsme_b3_scope2, vsme_b6_water)."),
      vsme_cell: z.string().regex(/^.+!.+$/, "must be '<Sheet>!<Cell>'").describe("The VSME template cell this metric fills, taken verbatim from a target's vsme_cell (e.g. 'Environmental Disclosures!D42')."),
    });

    const proposedFillFormula = z.object({
      output_param_code: z.string().min(1).describe("Must match a code in output_parameters (proposed here) or an existing output parameter."),
      expression: z.string().min(1).describe("Arithmetic over INPUT parameter codes only, using + - * / ( ) — NO functions, conditionals, or units. e.g. 'electricity_kwh * grid_emission_factor'. Every identifier must be an existing input/emission_factor code or another defined output code."),
      dependencies: z.array(z.string()).describe("Every identifier used in `expression`. The platform marks dependent metrics stale when any of these inputs change."),
      expression_human: z.string().nullable().describe("Human-readable form, e.g. '638,724 kWh × 0.233 kgCO2e/kWh' (null if none)."),
      description: z.string().nullable().describe("1-2 sentence methodology note, ideally citing the VSME guidance section (null if none)."),
      confidence: z.number().min(0).max(1).nullable().describe("Your confidence (0–1) that this derivation is correct, or null."),
    });

    const proposeFill = tool({
      name: "propose_fill",
      description: "Submit the VSME output metrics you derived from the org's measured inputs. Call this EXACTLY ONCE, at the end, after you have searched the guidance for the methodology behind each metric. For every target you can derive, provide an output parameter (pinned to its vsme_cell) and a formula expressed over input parameter codes. Skip targets you cannot derive and list them in `skipped`. Never invent input values.",
      strict: true,
      parameters: z.object({
        period: z.object({
          code: z.string().min(1),
          label: z.string().min(1),
        }),
        output_parameters: z.array(proposedOutputParameter).describe("One per derivable target. Pin each to the target's vsme_cell."),
        formulas: z.array(proposedFillFormula).describe("One per output parameter, expressed over input codes."),
        skipped: z
          .array(z.object({ vsme_cell: z.string(), reason: z.string() }))
          .nullable()
          .describe("Targets you could not derive (missing inputs, no methodology, etc.) with a short reason, or null."),
        notes: z.string().nullable().describe("Anything ambiguous the reviewer should know, or null."),
      }),
      execute: async (args) => {
        // Warn (don't reject) when a formula references an output not declared
        // here — it may be an existing org parameter. The app-side commit route
        // re-validates against the catalogue and topologically sorts.
        const outputCodes = new Set(args.output_parameters.map((p) => p.code));
        const formulaCodes = new Set(args.formulas.map((f) => f.output_param_code));
        const paramsWithoutFormula = [...outputCodes].filter((c) => !formulaCodes.has(c));
        onFill({
          period: args.period,
          output_parameters: args.output_parameters,
          formulas: args.formulas.map((f) => ({
            ...f,
            expression_human: f.expression_human ?? undefined,
            description: f.description ?? undefined,
            confidence: f.confidence ?? undefined,
          })),
          skipped: args.skipped ?? undefined,
          notes: args.notes ?? undefined,
        });
        const warn = paramsWithoutFormula.length
          ? ` Note: ${paramsWithoutFormula.length} output parameter(s) have no formula and will not produce a value.`
          : "";
        return `Fill proposal accepted (${args.output_parameters.length} output parameters, ${args.formulas.length} formulas, ${args.skipped?.length ?? 0} skipped). The platform will compute and place the values.${warn}`;
      },
    });

    tools.push(proposeFill);
  }

  return tools;
}
