// Sculptor — generates a company's "business context" narrative by researching
// its website/domain with an LLM. Server-only.
//
// It uses Claude with the server-side `web_search` tool so the model actually
// reads the company's public web presence (homepage, about, products,
// sustainability pages) rather than relying solely on training data, then
// writes a concise, structured narrative that grounds the AI assistant in what
// the company does and its sustainability-relevant footprint.

import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "@/lib/ai/anthropic";
import { BUSINESS_CONTEXT_MAX } from "@/lib/types/onboarding";

// Opus is reserved elsewhere for reasoning-heavy work; for Sculptor we want
// strong synthesis of web results into prose, so Sonnet 4.6 is the right
// balance of quality and latency. The web_search tool does the heavy lifting.
const SCULPTOR_MODEL = "claude-sonnet-4-6";

// Cap web searches so a single generation can't run away on cost/latency.
const MAX_WEB_SEARCHES = 5;

const SYSTEM_PROMPT = [
  "You are Sculptor, a research assistant that writes a company's 'business context' for a sustainability (VSME / CDP) reporting platform.",
  "",
  "Your task: research the company from its name and website, then write a concise, factual business-context document that will be used to ground an AI assistant when it answers questions and drafts sustainability disclosures for this company.",
  "",
  "Use the web_search tool to read the company's public web presence — homepage, about/company page, products/services, locations, and any sustainability/ESG pages. Prefer the company's own website as the source of truth; corroborate with reputable secondary sources where useful.",
  "",
  "Write the result as clean Markdown with these sections (omit a section only if you genuinely found nothing for it — never invent facts):",
  "- **Overview** — what the company does, in 2-3 sentences.",
  "- **Sector & business model** — industry, products/services, how it makes money.",
  "- **Operations & footprint** — sites/facilities, geographies, rough scale (employees, locations), and any operations relevant to environmental impact (manufacturing, logistics, energy-intensive processes, etc.).",
  "- **Sustainability-relevant notes** — known ESG commitments, certifications, material environmental/social topics for this kind of business. If the company has published nothing, say so and describe the topics typically material for its sector.",
  "",
  "Rules:",
  "- Be factual and specific. Do NOT fabricate figures, certifications, or commitments. If you are unsure, say it's unconfirmed or omit it.",
  "- Keep it tight: aim for 250-450 words. This is context, not a brochure.",
  "- Write in neutral third person. No marketing language, no headers above the sections listed, no preamble like 'Here is the context'.",
  `- Hard limit: the entire output must be under ${BUSINESS_CONTEXT_MAX} characters.`,
].join("\n");

export interface SculptorInput {
  companyName: string;
  websiteUrl?: string;
}

export interface SculptorResult {
  /** The generated business-context markdown. */
  businessContext: string;
  /** Source URLs the model cited via web search, de-duplicated. */
  sources: string[];
}

/**
 * Run Sculptor for a company. Throws on an Anthropic/network error or if the
 * model returns no usable text (callers map this to a 5xx/422 response).
 */
export async function runSculptor({
  companyName,
  websiteUrl,
}: SculptorInput): Promise<SculptorResult> {
  const client = getAnthropicClient();

  const userPrompt = [
    `Company name: ${companyName}`,
    websiteUrl ? `Website: ${websiteUrl}` : "Website: (not provided — find it)",
    "",
    "Research this company and write its business context now.",
  ].join("\n");

  const webSearchTool: Anthropic.Messages.ToolUnion = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: MAX_WEB_SEARCHES,
  };

  const message = await client.messages.create({
    model: SCULPTOR_MODEL,
    max_tokens: 2048,
    // Single cached system block — the instructions are static across calls.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [webSearchTool],
    messages: [{ role: "user", content: userPrompt }],
  });

  // Collect the assistant's final prose (text blocks) and any cited URLs.
  const textParts: string[] = [];
  const sources = new Set<string>();

  for (const block of message.content) {
    if (block.type === "text") {
      textParts.push(block.text);
      // Citations carry the source URLs the model actually used.
      const citations = (block as { citations?: unknown }).citations;
      if (Array.isArray(citations)) {
        for (const c of citations) {
          const url = (c as { url?: unknown })?.url;
          if (typeof url === "string" && url) sources.add(url);
        }
      }
    } else if (block.type === "web_search_tool_result") {
      const content = (block as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const r of content) {
          const url = (r as { url?: unknown })?.url;
          if (typeof url === "string" && url) sources.add(url);
        }
      }
    }
  }

  const businessContext = textParts.join("").trim().slice(0, BUSINESS_CONTEXT_MAX);

  if (!businessContext) {
    throw new Error("Sculptor produced no business context. Please try again.");
  }

  return { businessContext, sources: [...sources] };
}
