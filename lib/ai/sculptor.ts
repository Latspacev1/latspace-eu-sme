// Sculptor — generates a company's "business context" narrative by researching
// its website/domain with an LLM. Server-only.
//
// It uses the OpenAI Responses API with the hosted `web_search` tool so the
// model actually reads the company's public web presence (homepage, about,
// products, sustainability pages) rather than relying solely on training data,
// then writes a concise, structured narrative that grounds the AI assistant in
// what the company does and its sustainability-relevant footprint.

import { getOpenAIClient } from "@/lib/ai/openai";
import { BUSINESS_CONTEXT_MAX } from "@/lib/types/onboarding";

// gpt-4.1 gives strong synthesis of web results into prose at good latency; the
// hosted web_search tool does the heavy lifting of gathering the facts.
const SCULPTOR_MODEL = "gpt-4.1";

const SYSTEM_PROMPT = [
  "You are Sculptor, a research assistant that writes a company's 'business context' for a sustainability (VSME / CDP) reporting platform.",
  "",
  "Your task: research the company from its name and website, then write a concise, factual business-context document that will be used to ground an AI assistant when it answers questions and drafts sustainability disclosures for this company.",
  "",
  "Use the web_search tool to read the company's public web presence — homepage, about/company page, products/services, locations, and any sustainability/ESG pages. Prefer the company's own website as the source of truth; corroborate with reputable secondary sources where useful. Do not run more than 5 searches.",
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
 * Run Sculptor for a company. Throws on an OpenAI/network error or if the model
 * returns no usable text (callers map this to a 5xx/422 response).
 */
export async function runSculptor({
  companyName,
  websiteUrl,
}: SculptorInput): Promise<SculptorResult> {
  const client = getOpenAIClient();

  const userPrompt = [
    `Company name: ${companyName}`,
    websiteUrl ? `Website: ${websiteUrl}` : "Website: (not provided — find it)",
    "",
    "Research this company and write its business context now.",
  ].join("\n");

  const response = await client.responses.create({
    model: SCULPTOR_MODEL,
    max_output_tokens: 2048,
    instructions: SYSTEM_PROMPT,
    tools: [{ type: "web_search" }],
    input: [{ role: "user", content: userPrompt }],
  });

  // Collect the assistant's final prose and any cited URLs. The Responses API
  // returns the answer as `message` items whose `output_text` content parts
  // carry `url_citation` annotations; we read both defensively.
  const sources = new Set<string>();

  for (const item of response.output ?? []) {
    if ((item as { type?: string }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const annotations = (part as { annotations?: unknown }).annotations;
      if (!Array.isArray(annotations)) continue;
      for (const a of annotations) {
        const ann = a as { type?: unknown; url?: unknown };
        if (ann.type === "url_citation" && typeof ann.url === "string" && ann.url) {
          sources.add(ann.url);
        }
      }
    }
  }

  const businessContext = (response.output_text ?? "").trim().slice(0, BUSINESS_CONTEXT_MAX);

  if (!businessContext) {
    throw new Error("Sculptor produced no business context. Please try again.");
  }

  return { businessContext, sources: [...sources] };
}
