// In-process MCP tools exposed to the Claude Agent SDK. Each request builds
// its own server via createAgentMcpServer() so the tool handlers can close
// over per-request callbacks (forwarding retrieved sources / proposals to
// the runner's NDJSON stream) and the active framework's RAG index.
//
// Tool names registered here are surfaced to the agent as
// `mcp__<framework>__<tool_name>`; the runner adds those to allowedTools.

import { tool, createSdkMcpServer, type SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { search, type Framework, type RetrievedChunk } from "../retrieval.ts";
import { ALLOWED_SECTIONS } from "./param-sections.ts";

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
  confidence?: number;
}

export interface ExtractionProposal {
  period: { code: string; label: string; start_date?: string; end_date?: string };
  parameters: ProposedParameter[];
  data_points: ProposedDataPoint[];
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

export function createAgentMcpServer(framework: Framework, opts: AgentMcpOptions) {
  const info = FRAMEWORK_INFO[framework];

  const searchGuidance = tool(
    "search_guidance",
    `Search ${info.docName} and return the most relevant excerpts. Each excerpt is tagged with a section number (e.g. ${info.sectionExample}) and page range that you must cite verbatim in your reply. Call this whenever the user asks a substantive regulatory question. You may call it multiple times with different queries to cover compound questions.`,
    {
      query: z
        .string()
        .min(2)
        .describe("Natural-language search query. Be specific — e.g., 'system boundaries for embedded emissions' beats 'emissions'."),
      k: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Number of excerpts to return. Defaults to 6."),
    },
    async (args) => {
      try {
        const k = args.k ?? 6;
        const chunks = await search(args.query, framework, { k });
        const sources = chunks.map(chunkToSource);
        opts.onSearchHit?.(sources);
        const text = chunks.length
          ? formatRetrievedExcerpts(chunks)
          : "No matching excerpts found in the guidance document for this query.";
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `search_guidance failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Use `any` schema so tools with different Zod input shapes can coexist in
  // one array — this matches CreateSdkMcpServerOptions['tools'] in the SDK.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: SdkMcpToolDefinition<any>[] = [searchGuidance];

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
        .optional()
        .describe(
          `Optional caption shown beneath the diagram. Good place to put a citation like 'Source: ${info.sectionExample} (page N)'.`
        ),
    });

    const proposeInsert = tool(
      "propose_insert",
      "Insert one or more blocks into the user's report at a specific location. Call this exactly once per writing task, after you have searched the guidance for any factual claims you intend to make. The insertion appears to the user as a highlighted preview that they can accept or reject — do not call this for ordinary chat answers.",
      {
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
      },
      async (args) => {
        if (args.after_block_id !== null && !outlineIds.has(args.after_block_id)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `after_block_id "${args.after_block_id}" is not in the outline. Pick one of the IDs in square brackets, or use null to prepend.`,
              },
            ],
            isError: true,
          };
        }
        onProposal({
          after_block_id: args.after_block_id,
          blocks: args.blocks,
          rationale: args.rationale,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: "Proposal accepted into the editor. The user will review it.",
            },
          ],
        };
      }
    );

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
      source_page: z.number().int().optional().describe("1-based page number where the value appears."),
      confidence: z.number().min(0).max(1).optional(),
    });

    const proposeExtraction = tool(
      "propose_extraction",
      "Submit the metrics you extracted from the document. Call this EXACTLY ONCE, at the end, after you have read the whole document. Every data point must cite a verbatim source_excerpt. Never invent values that are not present in the document.",
      {
        period: z.object({
          code: z.string().min(1).describe("Short period code, e.g. 'FY2025' or '2025-03'."),
          label: z.string().min(1).describe("Human label, e.g. 'Fiscal Year 2025'."),
          start_date: z.string().optional().describe("ISO date if determinable."),
          end_date: z.string().optional(),
        }),
        parameters: z.array(proposedParameter).describe("Every distinct metric found. Reuse existing codes; do not duplicate."),
        data_points: z.array(proposedDataPoint).describe("One per parameter per period, with provenance."),
        notes: z.string().optional().describe("Anything ambiguous the reviewer should know."),
      },
      async (args) => {
        const codes = new Set(args.parameters.map((p) => p.code));
        const orphans = args.data_points
          .map((d) => d.parameter_code)
          .filter((c) => !codes.has(c));
        // Orphans are allowed only if they reference an existing org parameter —
        // we can't verify that here, so warn rather than reject. The app-side
        // commit route re-validates against the org catalogue.
        onExtraction({
          period: args.period,
          parameters: args.parameters,
          data_points: args.data_points,
          notes: args.notes,
        });
        const warn = orphans.length
          ? ` Note: ${orphans.length} data point(s) reference codes not in the parameters list — make sure those are existing parameters.`
          : "";
        return {
          content: [
            {
              type: "text" as const,
              text: `Extraction proposal accepted (${args.parameters.length} parameters, ${args.data_points.length} data points). The user will review it.${warn}`,
            },
          ],
        };
      }
    );

    tools.push(proposeExtraction);
  }

  return createSdkMcpServer({
    name: framework,
    version: "1.0.0",
    tools,
  });
}

// Tool name strings for the runner's allowedTools list. Framework-scoped
// because the SDK prefixes tool names with the MCP server name.
export function toolSearchGuidance(framework: Framework): string {
  return `mcp__${framework}__search_guidance`;
}
export function toolProposeInsert(framework: Framework): string {
  return `mcp__${framework}__propose_insert`;
}
export function toolProposeExtraction(framework: Framework): string {
  return `mcp__${framework}__propose_extraction`;
}
